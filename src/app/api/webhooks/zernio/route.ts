import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { asWorker, ownerOfZernioAccount, schema, type Tx } from "@/db";
import { env } from "@/lib/env";
import { deliverMaterialOnReply, dueEventIds, processCommentEvent } from "@/lib/processor";
import { enqueueComment } from "@/lib/queue";
import { verifyZernioSignature } from "@/lib/webhook-signature";
import { commentReceived, envelope, MAX_EVENT_AGE_MS, messageReceived, messageStatus } from "@/lib/webhook-events";

const { commentEvents, connection, webhookDeliveries } = schema;
const MAX_BODY_BYTES = 1024 * 1024;
const HANDLED = new Set(["comment.received", "message.read", "message.delivered", "message.received"]);

const ok = () => new Response(null, { status: 200 });

// PRD §7.4: assinatura antes de qualquer leitura do JSON; resposta 200 rápida; processamento depois (after).
export async function POST(request: Request) {
  const secret = env().ZERNIO_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook não configurado", { status: 503 });
  if (!request.headers.get("content-type")?.includes("application/json")) return new Response(null, { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  if (!verifyZernioSignature(raw, request.headers.get("x-zernio-signature"), secret)) {
    return new Response(null, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const head = envelope.safeParse(body);
  if (!head.success) return new Response(null, { status: 400 });
  if (!HANDLED.has(head.data.event)) return ok();
  if (Date.now() - new Date(head.data.timestamp).getTime() > MAX_EVENT_AGE_MS) return ok();

  const accountId = (body as { account?: { id?: unknown } }).account?.id;
  if (typeof accountId !== "string") return new Response(null, { status: 400 });
  const forced = env().ZERNIO_ACCOUNT_ID;
  if (forced && forced !== accountId) return ok();
  const userId = await ownerOfZernioAccount(accountId);
  if (!userId) return ok(); // conta que não é a nossa (CA05)

  // Idempotência nº 1: o mesmo evento da Zernio só entra uma vez. A marca do evento e o registro que ele
  // gera vão na mesma transação: se algo falhar no meio, nada fica gravado e o reenvio da Zernio é aceito.
  const markDelivered = async (tx: Tx) => {
    const r = await tx.insert(webhookDeliveries).values({ eventId: head.data.id, userId }).onConflictDoNothing().returning();
    if (!r.length) return false;
    await tx.update(connection).set({ lastWebhookAt: new Date() }).where(eq(connection.userId, userId));
    return true;
  };

  if (head.data.event === "comment.received") {
    const parsed = commentReceived.safeParse(body);
    if (!parsed.success) return new Response(null, { status: 400 });
    const { comment } = parsed.data;
    if (comment.platform !== "instagram") return ok();

    const row = await asWorker(userId, async (tx) => {
      if (!(await markDelivered(tx))) return null;
      const [conn] = await tx.select({ igUserId: connection.igUserId }).from(connection);
      const own = comment.author.isOwnAccount === true || (!!conn?.igUserId && comment.author.id === conn.igUserId);
      const status = parsed.data.test ? "ignored_test" : own ? "ignored_self" : comment.isLive ? "ignored_live" : "queued";

      // Idempotência nº 2: um registro por comentário.
      const [inserted] = await tx
        .insert(commentEvents)
        .values({
          userId,
          igCommentId: comment.id,
          platformPostId: comment.platformPostId,
          commenterId: comment.author.id,
          commenterUsername: comment.author.username ?? null,
          // Só https: a URL vai para um <img> no painel.
          commenterPicture: comment.author.picture?.startsWith("https://") ? comment.author.picture : null,
          commentText: comment.text.slice(0, 500),
          commentCreatedAt: new Date(comment.createdAt),
          status,
        })
        .onConflictDoNothing()
        .returning({ id: commentEvents.id, status: commentEvents.status });
      return inserted ?? null;
    });

    if (row?.status === "queued") {
      after(async () => {
        if (await enqueueComment({ userId, eventId: row.id })) return;
        // Fila indisponível (ou dev local sem `vercel link`): processa aqui mesmo, como antes da fila.
        await processCommentEvent(userId, row.id);
        for (const id of await dueEventIds(userId, 5)) await processCommentEvent(userId, id);
      });
    }
    return ok();
  }

  if (head.data.event === "message.read" || head.data.event === "message.delivered") {
    const parsed = messageStatus.safeParse(body);
    await asWorker(userId, async (tx) => {
      if (!(await markDelivered(tx))) return;
      if (!parsed.success || parsed.data.event !== "message.read") return;
      const ids = [parsed.data.message.id, parsed.data.message.platformMessageId].filter(Boolean) as string[];
      await tx
        .update(commentEvents)
        .set({ dmReadAt: new Date(), updatedAt: new Date() })
        .where(and(isNull(commentEvents.dmReadAt), or(...ids.map((id) => eq(commentEvents.dmMessageId, id)))));
    });
    return ok();
  }

  // message.received: a pessoa respondeu no Direct → conversa iniciada (RF20).
  const parsed = messageReceived.safeParse(body);
  const participant = parsed.success && parsed.data.message.direction !== "outgoing" ? parsed.data.conversation.participantId : undefined;
  const fresh = await asWorker(userId, async (tx) => {
    if (!(await markDelivered(tx))) return false;
    if (!participant) return true;
    const [last] = await tx
      .select({ id: commentEvents.id })
      .from(commentEvents)
      .where(and(eq(commentEvents.commenterId, participant), eq(commentEvents.dmStatus, "sent"), isNull(commentEvents.dmRepliedAt)))
      .orderBy(desc(commentEvents.dmSentAt))
      .limit(1);
    if (last) await tx.update(commentEvents).set({ dmRepliedAt: sql`now()`, updatedAt: new Date() }).where(eq(commentEvents.id, last.id));
    return true;
  });
  // Arquivo esperando a resposta: sai como anexo, depois do 200 para a Zernio.
  const conversationId = parsed.data?.message.conversationId;
  if (fresh && participant && conversationId) after(() => deliverMaterialOnReply(userId, participant, conversationId));
  return ok();
}
