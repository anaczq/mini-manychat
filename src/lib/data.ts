import "server-only";
import { sql } from "drizzle-orm";
import { asWeb, asWorker, schema } from "@/db";

const { commentEvents, keywords, keywordReplies, keywordPosts } = schema;

/** Apaga o histórico (eventos, cliques e entregas). O painel não tem DELETE: roda com o papel do worker. */
export async function wipeHistory(userId: string) {
  await asWorker(userId, async (tx) => {
    await tx.delete(commentEvents);
    await tx.delete(schema.webhookDeliveries);
  });
}

/** Backup das automações em JSON (sem dados de quem comentou). */
export async function exportAutomations(userId: string) {
  return asWeb(userId, async (tx) => {
    const ks = await tx.select().from(keywords);
    const rs = await tx.select().from(keywordReplies);
    const ps = await tx.select().from(keywordPosts);
    return ks.map((k) => ({
      name: k.name,
      terms: k.terms,
      matchMode: k.matchMode,
      scope: k.scope,
      postIds: ps.filter((p) => p.keywordId === k.id).map((p) => p.platformPostId),
      dmEnabled: k.dmEnabled,
      dmText: k.dmText,
      dmLinkUrl: k.dmLinkUrl,
      buttonLabel: k.buttonLabel,
      publicReplyEnabled: k.publicReplyEnabled,
      replies: rs.filter((r) => r.keywordId === k.id).map((r) => r.text),
      active: k.active,
    }));
  });
}

/** Retenção de 90 dias (PRD RNF06): roda no cron diário com o papel do worker. */
export async function purgeOld(userId: string) {
  return asWorker(userId, async (tx) => {
    const r = await tx.delete(commentEvents).where(sql`${commentEvents.createdAt} < now() - interval '90 days'`).returning({ id: commentEvents.id });
    await tx.delete(schema.webhookDeliveries).where(sql`${schema.webhookDeliveries.receivedAt} < now() - interval '90 days'`);
    await tx.delete(schema.linkTokens).where(sql`${schema.linkTokens.expiresAt} < now()`);
    return r.length;
  });
}
