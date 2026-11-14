import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { asWorker, schema, type Tx } from "@/db";
import type { DmStatus, EventStatus, ReplyStatus } from "@/db/schema";
import { type MatchableKeyword, pickKeyword } from "@/lib/matching";
import { enqueueComment } from "@/lib/queue";
import { allow, allowUpTo } from "@/lib/ratelimit";
import { replyToComment, sendAttachment, sendPrivateReply, ZernioError } from "@/lib/zernio";

const { commentEvents, connection, dispatches, keywordPosts, keywordReplies, keywords, settings } = schema;

const SEVEN_DAYS_MS = 7 * 86400_000;
// Margem para a janela de 7 dias da Meta (PRD §7.5): não tenta Private Reply depois de 6d23h.
const PRIVATE_REPLY_DEADLINE_MS = SEVEN_DAYS_MS - 3600_000;
// Backoff com jitter: 30 s, 2 min, 8 min, 30 min, 2 h, 6 h.
const BACKOFF_S = [30, 120, 480, 1800, 7200, 21600];

type Event = typeof commentEvents.$inferSelect;

function log(event: string, data: Record<string, string | number | boolean | null | undefined>) {
  // Só IDs e códigos; nunca texto de comentário, username ou segredos (PRD RNF05).
  console.log(JSON.stringify({ event, ...data }));
}

function nextAttempt(attempts: number, minSeconds = 0) {
  const base = BACKOFF_S[Math.min(attempts, BACKOFF_S.length - 1)];
  const jitter = Math.round(base * 0.2 * Math.random());
  return new Date(Date.now() + Math.max(base + jitter, minSeconds) * 1000);
}

type Run = <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;

// Cada passo é gravado na própria transação: se o DM saiu, o registro dele não é desfeito por um erro depois.
async function finish(run: Run, id: string, patch: Partial<Event>) {
  await run((tx) =>
    tx
      .update(commentEvents)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(commentEvents.id, id)),
  );
}

async function scheduleRetry(run: Run, ev: Event, reason: string, minSeconds = 0) {
  const attempts = ev.attempts + 1;
  if (attempts > BACKOFF_S.length) return finish(run, ev.id, { status: "failed", attempts });
  log("comment_retry", { id: ev.id, reason, attempts });
  const at = nextAttempt(ev.attempts, minSeconds);
  await finish(run, ev.id, { status: "retry", attempts, nextAttemptAt: at });
  // A fila entrega na hora do backoff. Se o envio falhar, o cron pega o evento pelo next_attempt_at.
  await enqueueComment({ userId: ev.userId, eventId: ev.id }, (at.getTime() - Date.now()) / 1000, attempts);
}

function pickReply(replies: { id: string; text: string }[], lastId: string | null) {
  const pool = replies.length > 1 ? replies.filter((r) => r.id !== lastId) : replies;
  return pool[Math.floor(Math.random() * pool.length)];
}

type Keyword = typeof keywords.$inferSelect;
type Settings = typeof settings.$inferSelect | undefined;
type Connection = typeof connection.$inferSelect;
/** Um passo que reagendou ou encerrou o evento devolve STOP: o processamento para ali. */
const STOP = Symbol("stop");

export function buildDm(ev: Pick<Event, "commenterUsername">, kw: Pick<Keyword, "dmText" | "dmLinkUrl" | "buttonLabel" | "assetId">) {
  const firstName = ev.commenterUsername ?? "";
  let text = kw.dmText.replaceAll("{{first_name}}", firstName).replace(/\s+([!,.?])/g, "$1").trim();
  let buttonUrl: string | undefined;
  // Link: vai o endereço do próprio destino (um link do painel na conversa parece estranho para quem recebe).
  // Arquivo: não vai aqui. Sai como anexo quando a pessoa responder (deliverMaterialOnReply).
  if (kw.dmLinkUrl) {
    if (kw.buttonLabel) buttonUrl = kw.dmLinkUrl;
    else text = `${text}\n\n${kw.dmLinkUrl}`;
  }
  return { text, buttonUrl, awaitsReply: !kw.dmLinkUrl && !!kw.assetId };
}

/** Erro definitivo da Zernio no DM → status gravado. Retentável não passa por aqui. */
export function dmFailureStatus(err: Pick<ZernioError, "privateReplyConsumed" | "outcomeUnknown">): DmStatus {
  if (err.privateReplyConsumed) return "failed_consumed";
  if (err.outcomeUnknown) return "unknown";
  return "failed";
}

export function finalStatus(dm: DmStatus, reply: ReplyStatus): EventStatus {
  const dmOk = dm === "sent" || dm === "skipped";
  const replyOk = reply === "sent" || reply === "skipped";
  return dmOk && replyOk ? "done" : dmOk || replyOk ? "partial" : "failed";
}

// 1. Trava: só um processamento por vez para o mesmo evento (ou retoma um travado há 5+ min).
async function claim(run: Run, eventId: string): Promise<Event | undefined> {
  const [ev] = await run((tx) =>
    tx
      .update(commentEvents)
      .set({ status: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(commentEvents.id, eventId),
          sql`(${commentEvents.status} in ('queued','retry') or (${commentEvents.status} = 'processing' and ${commentEvents.updatedAt} <= now() - interval '5 minutes'))`,
        ),
      )
      .returning(),
  );
  return ev;
}

// 2. Qual automação dispara (se alguma). Quando o evento volta da fila (retry), a automação já foi escolhida.
async function matchKeyword(run: Run, ev: Event): Promise<Keyword | undefined> {
  const active = await run((tx) => tx.select().from(keywords).where(eq(keywords.active, true)));
  const posts = active.length
    ? await run((tx) => tx.select().from(keywordPosts).where(inArray(keywordPosts.keywordId, active.map((k) => k.id))))
    : [];
  const matchable: (MatchableKeyword & { row: Keyword })[] = active.map((k) => ({
    id: k.id,
    termsNormalized: k.termsNormalized,
    matchMode: k.matchMode as MatchableKeyword["matchMode"],
    scope: k.scope as MatchableKeyword["scope"],
    postIds: posts.filter((p) => p.keywordId === k.id).map((p) => p.platformPostId),
    createdAt: k.createdAt,
    row: k,
  }));
  const hit = ev.keywordId
    ? matchable.find((m) => m.id === ev.keywordId) ?? null
    : pickKeyword(matchable, ev.commentText ?? "", ev.platformPostId);
  return hit?.row;
}

// 3. Anti-spam (só na primeira passagem) e "1 DM por pessoa por palavra por post". Devolve o motivo do bloqueio, se houver.
async function reserveDispatch(run: Run, userId: string, ev: Event, kw: Keyword, conf: Settings): Promise<EventStatus | null> {
  const flood = await allow("comentariosPorPessoa", ev.commenterId);
  if (!flood.ok) return "rate_limited_user";
  const inserted = await run((tx) =>
    tx
      .insert(dispatches)
      .values({ userId, commenterId: ev.commenterId, keywordId: kw.id, platformPostId: ev.platformPostId, commentEventId: ev.id })
      .onConflictDoNothing()
      .returning({ id: dispatches.id }),
  );
  if (!inserted.length) return "duplicate";
  if (kw.dmEnabled) {
    const perUser = await allowUpTo("dmPorPessoa", conf?.perUserDailyCap ?? 3, "24 h", ev.commenterId);
    if (!perUser.ok) return "rate_limited_user";
  }
  return null;
}

// 4. Direct (Private Reply). Nunca reenvia se já existe dm_message_id.
async function sendDm(run: Run, userId: string, ev: Event, kw: Keyword, conn: Connection, conf: Settings): Promise<DmStatus | typeof STOP> {
  if (!kw.dmEnabled) return "skipped";
  if (ev.dmStatus !== "pending") return ev.dmStatus;

  // Cota mensal (Zernio grátis = 10 mil DMs): ao atingir, para de enviar DM até o mês virar.
  const [{ sentMonth }] = await run((tx) =>
    tx
      .select({ sentMonth: sql<number>`count(*)::int` })
      .from(commentEvents)
      .where(sql`${commentEvents.dmStatus} = 'sent' and ${commentEvents.dmSentAt} >= date_trunc('month', now())`),
  );
  if (sentMonth >= (conf?.monthlyDmBudget ?? 10000)) {
    await finish(run, ev.id, { status: "paused_quota" });
    return STOP;
  }
  const budget = await allowUpTo("privateReplyHora", conf?.outboundHourlyBudget ?? 600, "1 h", conn.zernioAccountId);
  const zernio = budget.ok ? await allow("zernioSaida", "global") : budget;
  if (!zernio.ok) {
    await scheduleRetry(run, ev, "orcamento_saida", zernio.retryAfterSeconds);
    return STOP;
  }

  try {
    const dm = buildDm(ev, kw);
    const buttons = dm.buttonUrl && conn.buttonsAllowed ? [{ title: kw.buttonLabel!, url: dm.buttonUrl }] : undefined;
    const res = await sendPrivateReply({
      accountId: conn.zernioAccountId,
      postId: ev.platformPostId,
      commentId: ev.igCommentId,
      message: buttons ? dm.text : dm.buttonUrl ? `${dm.text}\n\n${dm.buttonUrl}` : dm.text,
      buttons,
    });
    await finish(run, ev.id, {
      dmStatus: "sent",
      dmMessageId: res.messageId ?? null,
      dmSentAt: new Date(),
      dmErrorCode: null,
      materialStatus: dm.awaitsReply ? "awaiting_reply" : null,
    });
    log("dm_sent", { id: ev.id });
    return "sent";
  } catch (err) {
    if (!(err instanceof ZernioError)) throw err;
    if (err.retryable && !err.privateReplyConsumed) {
      await scheduleRetry(run, ev, `zernio_${err.status}`, err.retryAfterSeconds ?? 0);
      return STOP;
    }
    const dmStatus = dmFailureStatus(err);
    // Botão recusado para não seguidor (subcode 1545133): desliga botões dali em diante (RF17).
    if (JSON.stringify(err.details ?? {}).includes("1545133")) {
      await run((tx) => tx.update(connection).set({ buttonsAllowed: false }).where(eq(connection.userId, userId)));
    }
    await finish(run, ev.id, { dmStatus, dmErrorCode: err.code ?? String(err.status) });
    log("dm_failed", { id: ev.id, status: err.status, code: err.code ?? null });
    return dmStatus;
  }
}

// 5. Resposta pública, com Idempotency-Key (retentar não duplica).
async function sendReply(run: Run, ev: Event, kw: Keyword, conn: Connection, dmStatus: DmStatus): Promise<ReplyStatus | typeof STOP> {
  if (!kw.publicReplyEnabled) return "skipped";
  if (ev.replyStatus !== "pending" && ev.replyStatus !== "failed") return ev.replyStatus;

  const replies = await run((tx) =>
    tx.select({ id: keywordReplies.id, text: keywordReplies.text }).from(keywordReplies).where(eq(keywordReplies.keywordId, kw.id)),
  );
  const reply = replies.length ? pickReply(replies, kw.lastReplyId) : null;
  if (!reply) return "skipped";

  const budget = await allow("respostaPublicaHora", conn.zernioAccountId);
  const zernio = budget.ok ? await allow("zernioSaida", "global") : budget;
  if (!zernio.ok) {
    await scheduleRetry(run, ev, "orcamento_resposta", zernio.retryAfterSeconds);
    return STOP;
  }
  try {
    await replyToComment({
      accountId: conn.zernioAccountId,
      postId: ev.platformPostId,
      commentId: ev.igCommentId,
      message: reply.text,
      idempotencyKey: `reply-${ev.id}`,
    });
    await run((tx) => tx.update(keywords).set({ lastReplyId: reply.id }).where(eq(keywords.id, kw.id)));
    await finish(run, ev.id, { replyStatus: "sent", replyErrorCode: null });
    return "sent";
  } catch (err) {
    if (!(err instanceof ZernioError)) throw err;
    await finish(run, ev.id, { replyStatus: "failed", replyErrorCode: err.retryable ? String(err.status) : (err.code ?? String(err.status)) });
    if (err.retryable) {
      await scheduleRetry(run, { ...ev, dmStatus }, `resposta_${err.status}`, err.retryAfterSeconds ?? 0);
      return STOP;
    }
    return "failed";
  }
}

/** Processa um comentário já gravado (PRD §2.2, worker). Idempotente: pode rodar mais de uma vez. */
export async function processCommentEvent(userId: string, eventId: string): Promise<void> {
  const run: Run = (fn) => asWorker(userId, fn);
  const ev = await claim(run, eventId);
  if (!ev) return;

  const [conf] = await run((tx) => tx.select().from(settings));
  if (conf && !conf.automationEnabled) return finish(run, ev.id, { status: "skipped_paused" });
  if (Date.now() - ev.commentCreatedAt.getTime() > PRIVATE_REPLY_DEADLINE_MS) return finish(run, ev.id, { status: "expired" });

  const kw = await matchKeyword(run, ev);
  if (!kw) return finish(run, ev.id, { status: "no_match" });

  if (!ev.keywordId) {
    const blocked = await reserveDispatch(run, userId, ev, kw, conf);
    if (blocked) return finish(run, ev.id, { status: blocked, keywordId: kw.id });
    await finish(run, ev.id, { keywordId: kw.id });
    ev.keywordId = kw.id;
  }

  const [conn] = await run((tx) => tx.select().from(connection));
  if (!conn) return scheduleRetry(run, ev, "sem_conexao", 300);

  const dmStatus = await sendDm(run, userId, ev, kw, conn, conf);
  if (dmStatus === STOP) return;
  const replyStatus = await sendReply(run, ev, kw, conn, dmStatus);
  if (replyStatus === STOP) return;

  // 6. Estado final.
  await finish(run, ev.id, { status: finalStatus(dmStatus, replyStatus), dmStatus, replyStatus, nextAttemptAt: null });
}

/** Eventos parados (retry vencido ou queued antigo). Usado pelo cron e após cada webhook. */
export async function dueEventIds(userId: string, limit = 20): Promise<string[]> {
  return asWorker(userId, async (tx) => {
    const rows = await tx
      .select({ id: commentEvents.id })
      .from(commentEvents)
      .where(
        sql`(${commentEvents.status} = 'retry' and ${commentEvents.nextAttemptAt} <= now())
          or (${commentEvents.status} = 'queued' and ${commentEvents.createdAt} <= now() - interval '1 minute')
          or (${commentEvents.status} = 'processing' and ${commentEvents.updatedAt} <= now() - interval '5 minutes')`,
      )
      .limit(limit);
    return rows.map((r) => r.id);
  });
}

/**
 * A pessoa respondeu o DM: se há um arquivo esperando essa resposta, manda como anexo (sem link).
 * Idempotente: a linha é reservada (awaiting_reply → sending) antes de enviar; falha devolve para awaiting_reply.
 * Um "sending" parado há 5+ min (função caiu) volta a ser elegível na próxima resposta da pessoa.
 */
export async function deliverMaterialOnReply(userId: string, commenterId: string, conversationId: string): Promise<void> {
  const run: Run = (fn) => asWorker(userId, fn);
  const [ev] = await run((tx) =>
    tx
      .update(commentEvents)
      .set({ materialStatus: "sending", updatedAt: new Date() })
      .where(
        eq(
          commentEvents.id,
          tx
            .select({ id: commentEvents.id })
            .from(commentEvents)
            .where(
              and(
                eq(commentEvents.commenterId, commenterId),
                // "sending" parado há 5+ min: a função caiu no meio do envio; libera de novo (idempotency-key evita duplicar).
                sql`(${commentEvents.materialStatus} = 'awaiting_reply' or (${commentEvents.materialStatus} = 'sending' and ${commentEvents.updatedAt} <= now() - interval '5 minutes'))`,
              ),
            )
            .orderBy(desc(commentEvents.dmSentAt))
            .limit(1),
        ),
      )
      .returning(),
  );
  if (!ev?.keywordId) return;

  const [kw] = await run((tx) => tx.select().from(keywords).where(eq(keywords.id, ev.keywordId!)));
  const asset = kw?.assetId ? (await run((tx) => tx.select().from(schema.assets).where(eq(schema.assets.id, kw.assetId!))))[0] : undefined;
  const [conn] = await run((tx) => tx.select().from(connection));
  if (!asset || !conn) {
    await finish(run, ev.id, { materialStatus: "failed" });
    return log("material_missing", { id: ev.id });
  }
  try {
    await sendAttachment({
      accountId: conn.zernioAccountId,
      conversationId,
      url: asset.blobUrl,
      type: asset.mime.startsWith("image/") ? "image" : "file",
      idempotencyKey: `material:${ev.id}`,
    });
    await finish(run, ev.id, { materialStatus: "sent", materialSentAt: new Date() });
    log("material_sent", { id: ev.id });
  } catch (err) {
    await finish(run, ev.id, { materialStatus: "awaiting_reply" });
    log("material_failed", { id: ev.id, status: err instanceof ZernioError ? err.status : null, code: err instanceof ZernioError ? (err.code ?? null) : null });
  }
}
