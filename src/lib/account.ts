import "server-only";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { asWeb, asWorker, schema } from "@/db";
import { env } from "@/lib/env";
import { accountHealth, listInstagramAccounts } from "@/lib/zernio";

const { connection, analyticsSnapshots } = schema;
const PROFILE_TTL_MS = 12 * 3600_000;
const HEALTH_TTL_MS = 60 * 60 * 1000;

/**
 * Atualiza foto, @ e ID do Instagram a partir da Zernio. As URLs de foto do Instagram expiram,
 * então isso roda no máximo a cada 12 h (ou quando forçado).
 */
export async function syncAccountProfile(userId: string, force = false) {
  const [conn] = await asWeb(userId, (tx) => tx.select().from(connection));
  if (!conn) return;
  if (!force && conn.profilePicture && conn.lastHealthAt && Date.now() - conn.lastHealthAt.getTime() < PROFILE_TTL_MS) return;
  const acc = (await listInstagramAccounts()).find((a) => a._id === conn.zernioAccountId);
  if (!acc) return;
  const picture = acc.profilePicture?.startsWith("https://") ? acc.profilePicture : null;
  await asWorker(userId, (tx) =>
    tx
      .update(connection)
      .set({ username: acc.username, igUserId: acc.platformUserId ?? conn.igUserId, profilePicture: picture, lastHealthAt: new Date() })
      .where(eq(connection.userId, userId)),
  );
}

export async function accountForSidebar(userId: string) {
  const [conn] = await asWeb(userId, (tx) => tx.select({ username: connection.username, picture: connection.profilePicture }).from(connection));
  return conn ?? null;
}

export type ConnectionView = {
  username: string;
  picture: string | null;
  zernioAccountId: string;
  health: string;
  tokenValid: boolean | null;
  tokenExpiresAt: string | null;
  permissions: { scope: string; granted: boolean }[];
  lastWebhookAt: Date | null;
  buttonsAllowed: boolean;
  webhookUrl: string;
  recentWebhook: boolean;
  tokenDaysLeft: number | null;
};

type Health = { status: string; tokenValid: boolean | null; tokenExpiresAt: string | null; permissions: ConnectionView["permissions"] };
// Guardada em analytics_snapshots (mesmo cache do Analytics); range_days 0 não colide com 7/30/90.
const HEALTH_KIND = "account_health";

/** Busca a saúde na Zernio e grava no cache e em connection.health_status (papel do worker). */
async function refreshHealth(userId: string, zernioAccountId: string): Promise<Health> {
  const h = await accountHealth(zernioAccountId);
  const perms = (h as { permissions?: Record<string, { scope: string; granted: boolean }[]> }).permissions ?? {};
  const health: Health = {
    status: h.status,
    tokenValid: h.tokenStatus?.valid ?? null,
    tokenExpiresAt: h.tokenStatus?.expiresAt ?? null,
    permissions: Object.values(perms).flat(),
  };
  const fetchedAt = new Date();
  await asWorker(userId, async (tx) => {
    await tx
      .insert(analyticsSnapshots)
      .values({ userId, kind: HEALTH_KIND, rangeDays: 0, payload: health, fetchedAt })
      .onConflictDoUpdate({ target: [analyticsSnapshots.userId, analyticsSnapshots.kind, analyticsSnapshots.rangeDays], set: { payload: health, fetchedAt } });
    await tx.update(connection).set({ healthStatus: health.status, lastHealthAt: fetchedAt }).where(eq(connection.userId, userId));
  });
  return health;
}

/**
 * Conexão com a saúde da Zernio em cache de 1 h (stale-while-revalidate): mostra o último estado na hora
 * e atualiza depois da resposta. Só espera a Zernio na primeira vez.
 */
export async function getConnection(userId: string): Promise<ConnectionView | null> {
  const [conn, snap] = await asWeb(userId, async (tx) => {
    const [c] = await tx.select().from(connection);
    const [h] = await tx
      .select()
      .from(analyticsSnapshots)
      .where(and(eq(analyticsSnapshots.kind, HEALTH_KIND), eq(analyticsSnapshots.rangeDays, 0)));
    return [c, h] as const;
  });
  if (!conn) return null;

  let health = snap?.payload as Health | undefined;
  // Só cacheia conexão saudável: com problema, quem abre a tela provavelmente está reconectando
  // na Zernio, então consulta na hora para o conserto aparecer na primeira visita.
  const healthy = health?.status === "healthy" && health.tokenValid !== false;
  if (!health || !healthy) {
    // Mantém o último estado conhecido se a Zernio não responder.
    health = (await refreshHealth(userId, conn.zernioAccountId).catch(() => undefined)) ?? health;
  } else if (Date.now() - snap!.fetchedAt.getTime() > HEALTH_TTL_MS) {
    after(() => refreshHealth(userId, conn.zernioAccountId).catch(() => undefined));
  }
  const tokenExpiresAt = health?.tokenExpiresAt ?? null;

  return {
    username: conn.username,
    picture: conn.profilePicture,
    zernioAccountId: conn.zernioAccountId,
    health: health?.status ?? conn.healthStatus,
    tokenValid: health?.tokenValid ?? null,
    tokenExpiresAt,
    permissions: health?.permissions ?? [],
    lastWebhookAt: conn.lastWebhookAt,
    buttonsAllowed: conn.buttonsAllowed,
    webhookUrl: `${env().PUBLIC_URL ?? env().APP_URL}/api/webhooks/zernio`,
    recentWebhook: !!conn.lastWebhookAt && Date.now() - conn.lastWebhookAt.getTime() < 24 * 3600_000,
    tokenDaysLeft: tokenExpiresAt ? Math.max(0, Math.round((new Date(tokenExpiresAt).getTime() - Date.now()) / 86400_000)) : null,
  };
}

export async function setButtonsAllowed(userId: string, allowed: boolean) {
  await asWeb(userId, (tx) => tx.update(connection).set({ buttonsAllowed: allowed }).where(eq(connection.userId, userId)));
}
