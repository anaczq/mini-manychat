import "server-only";
import { and, count, desc, eq, gte, type SQL, sql } from "drizzle-orm";
import { asWeb, schema } from "@/db";
import { describeEvent } from "@/lib/dashboard";

const { commentEvents, keywords, linkClicks } = schema;

export const STATUS_FILTERS = {
  enviado: { label: "Enviado", where: sql`${commentEvents.dmStatus} = 'sent'` },
  lido: { label: "Lido", where: sql`${commentEvents.dmReadAt} is not null` },
  fila: { label: "Na fila", where: sql`${commentEvents.status} in ('queued','processing','retry')` },
  erro: { label: "Erro", where: sql`(${commentEvents.status} in ('failed','partial') or ${commentEvents.dmStatus} like 'failed%' or ${commentEvents.dmStatus} = 'unknown')` },
  ignorado: { label: "Ignorado", where: sql`${commentEvents.status} in ('no_match','ignored_self','ignored_live','ignored_test','duplicate','rate_limited_user','skipped_paused','paused_quota','expired')` },
} as const;

export const PERIODS = { hoje: 1, "7d": 7, "30d": 30, "90d": 90 } as const;

export type HistoryFilters = { status?: keyof typeof STATUS_FILTERS; palavra?: string; periodo?: keyof typeof PERIODS; page: number };

const PAGE_SIZE = 25;

function whereFor(f: HistoryFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (f.status) parts.push(STATUS_FILTERS[f.status].where);
  if (f.palavra) parts.push(eq(commentEvents.keywordId, f.palavra));
  parts.push(gte(commentEvents.createdAt, new Date(Date.now() - PERIODS[f.periodo ?? "7d"] * 86400_000)));
  return and(...parts);
}

export async function listHistory(userId: string, f: HistoryFilters) {
  return asWeb(userId, async (tx) => {
    const where = whereFor(f);
    const [{ total }] = await tx.select({ total: count() }).from(commentEvents).where(where);
    const rows = await tx
      .select({
        id: commentEvents.id,
        username: commentEvents.commenterUsername,
        picture: commentEvents.commenterPicture,
        text: commentEvents.commentText,
        terms: keywords.terms,
        status: commentEvents.status,
        dmStatus: commentEvents.dmStatus,
        dmReadAt: commentEvents.dmReadAt,
        replyStatus: commentEvents.replyStatus,
        at: commentEvents.createdAt,
      })
      .from(commentEvents)
      .leftJoin(keywords, eq(keywords.id, commentEvents.keywordId))
      .where(where)
      .orderBy(desc(commentEvents.createdAt))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE);
    const keywordOptions = await tx.select({ id: keywords.id, name: keywords.name }).from(keywords).orderBy(keywords.name);
    return {
      total,
      pageSize: PAGE_SIZE,
      keywordOptions,
      rows: rows.map((r) => ({
        id: r.id,
        username: r.username ?? "alguém",
        picture: r.picture,
        text: r.text ?? "",
        keyword: r.terms?.[0] ?? null,
        at: r.at,
        dm: describeDm(r),
        reply: describeReply(r.replyStatus),
      })),
    };
  });
}

type Tone = "sucesso" | "alerta" | "erro" | "neutro" | "info";

function describeDm(r: { status: string; dmStatus: string; dmReadAt: Date | null; replyStatus: string }): { label: string; tone: Tone } {
  const d = describeEvent(r);
  if (r.dmStatus === "skipped") return { label: "Sem DM", tone: "neutro" };
  if (d.status === "DM enviado") return { label: "Enviado", tone: "sucesso" };
  if (d.status === "DM lido") return { label: "Lido", tone: "sucesso" };
  if (d.status === "Erro no DM") return { label: r.dmStatus === "unknown" ? "Incerto" : "Erro", tone: "erro" };
  return { label: d.status, tone: d.tone === "info" ? "sucesso" : d.tone };
}

function describeReply(s: string): { label: string; tone: Tone } {
  const map: Record<string, { label: string; tone: Tone }> = {
    sent: { label: "Enviada", tone: "sucesso" },
    failed: { label: "Erro", tone: "erro" },
    skipped: { label: "—", tone: "neutro" },
    pending: { label: "Aguardando", tone: "neutro" },
  };
  return map[s] ?? { label: s, tone: "neutro" };
}

const ERROR_HELP: Record<string, string> = {
  failed_consumed: "A Meta só permite 1 resposta privada por comentário, e ela já foi usada. Não dá para reenviar.",
  unknown: "A Meta deu erro depois de receber o DM; ele provavelmente chegou. Confira no Direct antes de reenviar.",
  failed: "O Instagram recusou o DM (a pessoa pode ter bloqueado mensagens ou apagado o comentário).",
};

export async function getHistoryEvent(userId: string, id: string) {
  return asWeb(userId, async (tx) => {
    const [r] = await tx
      .select({ ev: commentEvents, keywordName: keywords.name, terms: keywords.terms, matchMode: keywords.matchMode })
      .from(commentEvents)
      .leftJoin(keywords, eq(keywords.id, commentEvents.keywordId))
      .where(eq(commentEvents.id, id));
    if (!r) return null;
    const [click] = await tx.select().from(linkClicks).where(eq(linkClicks.commentEventId, id));
    const e = r.ev;
    const timeline: { at: Date; text: string }[] = [{ at: e.createdAt, text: "Webhook recebido · assinatura ok" }];
    if (r.keywordName) timeline.push({ at: e.createdAt, text: `Palavra ${r.terms?.[0]} (${r.matchMode === "exact" ? "exato" : "contém"})` });
    if (e.dmSentAt) timeline.push({ at: e.dmSentAt, text: "DM enviado" });
    if (e.dmErrorCode) timeline.push({ at: e.updatedAt, text: `DM → erro ${e.dmErrorCode}` });
    if (e.replyStatus === "sent") timeline.push({ at: e.updatedAt, text: "Resposta pública enviada" });
    if (e.dmReadAt) timeline.push({ at: e.dmReadAt, text: "DM lido" });
    if (click) timeline.push({ at: click.firstClickedAt, text: `Clicou no link${click.clickCount > 1 ? ` (${click.clickCount}x)` : ""}` });
    if (e.dmRepliedAt) timeline.push({ at: e.dmRepliedAt, text: "Respondeu o DM" });
    if (e.status === "retry" && e.nextAttemptAt) timeline.push({ at: e.nextAttemptAt, text: "Próxima tentativa agendada" });
    timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

    const withinWindow = Date.now() - e.commentCreatedAt.getTime() < 7 * 86400_000 - 3600_000;
    return {
      id: e.id,
      username: e.commenterUsername ?? "alguém",
      picture: e.commenterPicture,
      text: e.commentText ?? "",
      createdAt: e.createdAt,
      keyword: r.terms?.[0] ?? null,
      postId: e.platformPostId,
      attempts: e.attempts,
      dm: describeDm(e),
      reply: describeReply(e.replyStatus),
      errorHelp: ERROR_HELP[e.dmStatus] ?? (e.dmErrorCode ? `Erro ${e.dmErrorCode}` : null),
      errorCode: e.dmErrorCode,
      timeline,
      // Reprocessar só faz sentido em falha comum, dentro da janela da Meta (RF15).
      canRetry: e.status === "failed" && e.dmStatus !== "failed_consumed" && e.dmStatus !== "unknown" && withinWindow,
      retryBlockedReason:
        e.status !== "failed"
          ? null
          : e.dmStatus === "failed_consumed"
            ? "Indisponível: resposta privada já consumida"
            : e.dmStatus === "unknown"
              ? "Indisponível: o DM pode ter chegado"
              : !withinWindow
                ? "Indisponível: passou a janela de 7 dias da Meta"
                : null,
    };
  });
}

export async function markForRetry(userId: string, id: string) {
  return asWeb(userId, (tx) =>
    tx
      .update(commentEvents)
      .set({ status: "retry", nextAttemptAt: new Date(), updatedAt: new Date() })
      .where(and(eq(commentEvents.id, id), eq(commentEvents.status, "failed")))
      .returning({ id: commentEvents.id }),
  );
}

export async function exportHistoryCsv(userId: string, f: HistoryFilters) {
  return asWeb(userId, async (tx) => {
    const rows = await tx
      .select({
        at: commentEvents.createdAt,
        username: commentEvents.commenterUsername,
        keyword: keywords.name,
        status: commentEvents.status,
        dm: commentEvents.dmStatus,
        reply: commentEvents.replyStatus,
        read: commentEvents.dmReadAt,
      })
      .from(commentEvents)
      .leftJoin(keywords, eq(keywords.id, commentEvents.keywordId))
      .where(whereFor(f))
      .orderBy(desc(commentEvents.createdAt))
      .limit(10_000);
    const esc = (v: unknown) => {
      const s = v instanceof Date ? v.toISOString() : String(v ?? "");
      // Evita injeção de fórmula ao abrir no Excel/Sheets.
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const header = ["data", "pessoa", "automacao", "status", "dm", "resposta", "lido_em"];
    return [header.join(","), ...rows.map((r) => [r.at, r.username, r.keyword, r.status, r.dm, r.reply, r.read].map(esc).join(","))].join("\n");
  });
}
