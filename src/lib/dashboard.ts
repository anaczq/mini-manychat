import "server-only";
import { desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { asWeb, schema } from "@/db";
import { delta } from "@/lib/format";

const { commentEvents, keywords, linkClicks, settings, connection } = schema;
const DAY = 86400_000;

export type ActivityItem = {
  id: string;
  username: string;
  picture: string | null;
  text: string;
  keyword: string | null;
  status: string;
  tone: "sucesso" | "info" | "alerta" | "erro" | "neutro";
  at: Date;
};

/** Rótulo e cor do status de um evento, do ponto de vista de quem lê o painel. */
export function describeEvent(e: { status: string; dmStatus: string; dmReadAt: Date | null; replyStatus: string }): Pick<ActivityItem, "status" | "tone"> {
  if (e.dmReadAt) return { status: "DM lido", tone: "info" };
  if (e.dmStatus === "sent") return { status: "DM enviado", tone: "sucesso" };
  if (e.status === "done" && e.replyStatus === "sent") return { status: "Respondido", tone: "sucesso" };
  if (e.status === "queued" || e.status === "processing" || e.status === "retry") return { status: "Na fila", tone: "alerta" };
  if (e.dmStatus.startsWith("failed") || e.dmStatus === "unknown" || e.status === "failed") return { status: "Erro no DM", tone: "erro" };
  const map: Record<string, string> = {
    duplicate: "Duplicado",
    rate_limited_user: "Anti-spam",
    no_match: "Sem palavra",
    ignored_self: "Própria conta",
    skipped_paused: "Pausado",
    paused_quota: "Cota do mês",
    expired: "Expirado",
    partial: "Parcial",
  };
  return { status: map[e.status] ?? e.status, tone: e.status === "partial" ? "alerta" : "neutro" };
}

export async function getDashboard(userId: string) {
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY);
  const since14 = new Date(now - 14 * DAY);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return asWeb(userId, async (tx) => {
    const [agg] = await tx
      .select({
        matched7: sql<number>`count(*) filter (where ${commentEvents.keywordId} is not null and ${commentEvents.createdAt} >= ${since7})::int`,
        matchedPrev: sql<number>`count(*) filter (where ${commentEvents.keywordId} is not null and ${commentEvents.createdAt} < ${since7})::int`,
        sent7: sql<number>`count(*) filter (where ${commentEvents.dmStatus} = 'sent' and ${commentEvents.createdAt} >= ${since7})::int`,
        failed7: sql<number>`count(*) filter (where ${commentEvents.dmStatus} like 'failed%' and ${commentEvents.createdAt} >= ${since7})::int`,
        sentMonth: sql<number>`count(*) filter (where ${commentEvents.dmStatus} = 'sent' and ${commentEvents.dmSentAt} >= ${monthStart})::int`,
      })
      .from(commentEvents)
      .where(gte(commentEvents.createdAt, since14));

    const [clicks] = await tx
      .select({ c7: sql<number>`count(*) filter (where ${linkClicks.firstClickedAt} >= ${since7})::int` })
      .from(linkClicks)
      .where(gte(linkClicks.firstClickedAt, since7));

    // Série diária (7 pontos) para os minigráficos.
    const daily = await tx
      .select({
        day: sql<string>`to_char(date_trunc('day', ${commentEvents.createdAt}), 'YYYY-MM-DD')`,
        matched: sql<number>`count(*) filter (where ${commentEvents.keywordId} is not null)::int`,
        sent: sql<number>`count(*) filter (where ${commentEvents.dmStatus} = 'sent')::int`,
      })
      .from(commentEvents)
      .where(gte(commentEvents.createdAt, since7))
      .groupBy(sql`1`);
    const dailyClicks = await tx
      .select({ day: sql<string>`to_char(date_trunc('day', ${linkClicks.firstClickedAt}), 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(linkClicks)
      .where(gte(linkClicks.firstClickedAt, since7))
      .groupBy(sql`1`);
    const days = Array.from({ length: 7 }, (_, i) => new Date(now - (6 - i) * DAY).toISOString().slice(0, 10));
    const series = (pick: (d: string) => number) => days.map(pick);

    const recent = await tx
      .select({
        id: commentEvents.id,
        username: commentEvents.commenterUsername,
        picture: commentEvents.commenterPicture,
        text: commentEvents.commentText,
        keyword: keywords.name,
        terms: keywords.terms,
        status: commentEvents.status,
        dmStatus: commentEvents.dmStatus,
        dmReadAt: commentEvents.dmReadAt,
        replyStatus: commentEvents.replyStatus,
        at: commentEvents.createdAt,
      })
      .from(commentEvents)
      .leftJoin(keywords, eq(keywords.id, commentEvents.keywordId))
      .where(isNotNull(commentEvents.keywordId))
      .orderBy(desc(commentEvents.createdAt))
      .limit(6);

    const autos = await tx
      .select({
        id: keywords.id,
        name: keywords.name,
        active: keywords.active,
        // Nome qualificado: o Drizzle não qualifica colunas numa query de uma tabela só.
        week: sql<number>`(select count(*)::int from comment_events ce where ce.keyword_id = "keywords"."id" and ce.created_at >= ${since7})`,
        sent: sql<number>`(select count(*)::int from comment_events ce where ce.keyword_id = "keywords"."id" and ce.created_at >= ${since7} and ce.dm_status = 'sent')`,
        errors: sql<number>`(select count(*)::int from comment_events ce where ce.keyword_id = "keywords"."id" and ce.created_at >= ${since7} and (ce.dm_status like 'failed%' or ce.status = 'failed'))`,
        clicks: sql<number>`(select count(*)::int from link_clicks lc where lc.keyword_id = "keywords"."id" and lc.first_clicked_at >= ${since7})`,
      })
      .from(keywords)
      .where(eq(keywords.active, true))
      .orderBy(desc(sql`4`))
      .limit(3);
    const [{ activeCount }] = await tx
      .select({ activeCount: sql<number>`count(*)::int` })
      .from(keywords)
      .where(eq(keywords.active, true));

    const [conf] = await tx.select().from(settings);
    const [conn] = await tx.select().from(connection);

    const sentTotal = agg.sent7 + agg.failed7;
    return {
      kpis: {
        matched: { value: agg.matched7, delta: delta(agg.matched7, agg.matchedPrev), series: series((d) => daily.find((x) => x.day === d)?.matched ?? 0) },
        sent: {
          value: agg.sent7,
          delta: sentTotal ? `${Math.round((agg.sent7 / sentTotal) * 100)}% entregues` : "—",
          series: series((d) => daily.find((x) => x.day === d)?.sent ?? 0),
        },
        clicks: {
          value: clicks?.c7 ?? 0,
          delta: agg.sent7 ? `${Math.round(((clicks?.c7 ?? 0) / agg.sent7) * 100)}% dos DMs` : "—",
          series: series((d) => dailyClicks.find((x) => x.day === d)?.n ?? 0),
        },
      },
      quota: { used: agg.sentMonth, limit: conf?.monthlyDmBudget ?? 10000 },
      recent: recent.map<ActivityItem>((r) => ({
        id: r.id,
        username: r.username ?? "alguém",
        picture: r.picture,
        text: `comentou “${(r.text ?? "").slice(0, 60)}”`,
        keyword: r.terms?.[0] ?? null,
        at: r.at,
        ...describeEvent(r),
      })),
      automations: autos,
      activeCount,
      paused: conf ? !conf.automationEnabled : false,
      healthy: conn?.healthStatus === "healthy",
      username: conn?.username ?? null,
      weekResponses: agg.sent7,
      // Funil dos últimos 7 dias: com palavra → DM tentado → DM entregue → clique.
      funnel: { matched: agg.matched7, attempted: sentTotal, sent: agg.sent7, clicks: clicks?.c7 ?? 0 },
    };
  });
}
