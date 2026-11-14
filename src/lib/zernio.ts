import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";

const BASE = "https://zernio.com/api/v1";

export class ZernioError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    readonly details: Record<string, unknown> | undefined,
    readonly retryAfterSeconds: number | undefined,
  ) {
    super(`Zernio ${status}${code ? ` (${code})` : ""}`);
  }

  /** 400 com privateReplyConsumed: a única resposta privada do comentário já foi gasta. Nunca retentar. */
  get privateReplyConsumed() {
    return this.details?.privateReplyConsumed === true;
  }

  /** 502 com privateReplyOutcome=unknown: pode ter sido entregue. Não retentar automaticamente. */
  get outcomeUnknown() {
    return this.details?.privateReplyOutcome === "unknown";
  }

  get retryable() {
    return (this.status === 429 || this.status >= 500) && !this.outcomeUnknown;
  }
}

const errorBody = z
  .object({ code: z.string().optional(), details: z.record(z.string(), z.unknown()).optional() })
  .passthrough();

async function call<T>(schema: z.ZodType<T>, path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${env().ZERNIO_API_KEY}`);
  if (init.body) headers.set("Content-Type", "application/json");
  if (init.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);

  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const body = errorBody.safeParse(await res.json().catch(() => ({})));
    const retryAfter = Number(res.headers.get("Retry-After"));
    throw new ZernioError(res.status, body.data?.code, body.data?.details, Number.isFinite(retryAfter) ? retryAfter : undefined);
  }
  return schema.parse(await res.json());
}

/* ───────── Contas ───────── */

const accountsSchema = z.object({
  accounts: z.array(
    z
      .object({
        _id: z.string(),
        platform: z.string(),
        username: z.string(),
        isActive: z.boolean(),
        platformUserId: z.string().optional(),
        profilePicture: z.string().nullable().optional(),
      })
      .passthrough(),
  ),
});

export async function listInstagramAccounts() {
  const { accounts } = await call(accountsSchema, "/accounts");
  return accounts.filter((a) => a.platform === "instagram" && a.isActive);
}

const healthSchema = z
  .object({
    status: z.string(),
    tokenStatus: z.object({ valid: z.boolean(), expiresAt: z.string().nullable().optional() }).partial().optional(),
  })
  .passthrough();

export const accountHealth = (accountId: string) => call(healthSchema, `/accounts/${encodeURIComponent(accountId)}/health`);

/* ───────── Posts ───────── */

const postsSchema = z.object({
  posts: z.array(
    z
      .object({
        id: z.string(),
        message: z.string().optional().default(""),
        createdTime: z.string().optional(),
        permalink: z.string().optional(),
        picture: z.string().optional(),
        mediaType: z.string().optional(),
        commentCount: z.number().optional(),
      })
      .passthrough(),
  ),
});

/** Os 25 posts/reels mais recentes, lidos ao vivo do Instagram. */
export async function listRecentPosts(accountId: string) {
  const { posts } = await call(postsSchema, `/accounts/${encodeURIComponent(accountId)}/posts`);
  return posts;
}

/* ───────── Envio (PRD §2.2 passos 5 e 6) ───────── */

const privateReplySchema = z.object({ messageId: z.string().optional() }).passthrough();

export function sendPrivateReply(input: { accountId: string; postId: string; commentId: string; message: string; buttons?: { title: string; url: string }[] }) {
  const body: Record<string, unknown> = { accountId: input.accountId, message: input.message };
  if (input.buttons?.length) body.buttons = input.buttons.map((b) => ({ type: "url", title: b.title, url: b.url }));
  return call(privateReplySchema, `/inbox/comments/${encodeURIComponent(input.postId)}/${encodeURIComponent(input.commentId)}/private-reply`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const inboxMessageSchema = z.object({ data: z.object({ messageId: z.string().optional() }).passthrough().optional() }).passthrough();

/** Mensagem dentro de uma conversa já aberta (a pessoa respondeu), com o arquivo como anexo de verdade. */
export function sendAttachment(input: { accountId: string; conversationId: string; url: string; type: "image" | "file"; idempotencyKey: string }) {
  return call(inboxMessageSchema, `/inbox/conversations/${encodeURIComponent(input.conversationId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ accountId: input.accountId, attachmentUrl: input.url, attachmentType: input.type }),
    idempotencyKey: input.idempotencyKey,
  });
}

const replySchema = z.object({}).passthrough();

export function replyToComment(input: { accountId: string; postId: string; commentId: string; message: string; idempotencyKey: string }) {
  return call(replySchema, `/inbox/comments/${encodeURIComponent(input.postId)}`, {
    method: "POST",
    body: JSON.stringify({ accountId: input.accountId, commentId: input.commentId, message: input.message }),
    idempotencyKey: input.idempotencyKey,
  });
}

/* ───────── Webhook ───────── */

const webhooksSchema = z.object({ webhooks: z.array(z.object({ _id: z.string().optional(), id: z.string().optional(), name: z.string() }).passthrough()).default([]) });

/** Pede para a Zernio enviar o evento de teste ao webhook "mini-manychat". */
export async function sendWebhookTest(): Promise<boolean> {
  const { webhooks } = await call(webhooksSchema, "/webhooks/settings");
  const hook = webhooks.find((w) => w.name === "mini-manychat");
  const webhookId = hook?._id ?? hook?.id;
  if (!webhookId) return false;
  const r = await call(z.object({ success: z.boolean().optional() }).passthrough(), "/webhooks/test", {
    method: "POST",
    body: JSON.stringify({ webhookId }),
  });
  return r.success !== false;
}

/* ───────── Analytics (lidos e guardados em cache pelo app; formato pode variar, por isso passthrough) ───────── */

export function zernioAnalytics(path: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]);
  return call(z.record(z.string(), z.unknown()), `/analytics/${path}?${qs}`);
}
