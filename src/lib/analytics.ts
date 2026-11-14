import "server-only";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { after } from "next/server";
import { asWeb, asWorker, schema } from "@/db";
import { zernioAnalytics } from "@/lib/zernio";

const { commentEvents, keywords, linkClicks, postsCache, analyticsSnapshots, connection } = schema;
const DAY = 86400_000;
const SNAPSHOT_TTL_MS = 6 * 3600_000;

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

const IGNORED = sql`${commentEvents.status} not in ('ignored_self','ignored_test','ignored_live')`;

/** Bloco 1–5 da §3.1: tudo calculado do nosso banco. */
export async function getAutomationAnalytics(userId: string, days: RangeDays) {
  const since = new Date(Date.now() - days * DAY);
  const prevSince = new Date(Date.now() - 2 * days * DAY);

  return asWeb(userId, async (tx) => {
    const totals = async (from: Date, to: Date) => {
      const [r] = await tx
        .select({
          received: sql<number>`count(*)::int`,
          matched: sql<number>`count(*) filter (where ${commentEvents.keywordId} is not null)::int`,
          sent: sql<number>`count(*) filter (where ${commentEvents.dmStatus} = 'sent')::int`,
          failed: sql<number>`count(*) filter (where ${commentEvents.dmStatus} like 'failed%' or ${commentEvents.dmStatus} = 'unknown')::int`,
          read: sql<number>`count(*) filter (where ${commentEvents.dmReadAt} is not null)::int`,
          replied: sql<number>`count(*) filter (where ${commentEvents.dmRepliedAt} is not null)::int`,
          blocked: sql<number>`count(*) filter (where ${commentEvents.status} in ('duplicate','rate_limited_user'))::int`,
          p50: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from ${commentEvents.dmSentAt} - ${commentEvents.commentCreatedAt}))`,
          p95: sql<number | null>`percentile_cont(0.95) within group (order by extract(epoch from ${commentEvents.dmSentAt} - ${commentEvents.commentCreatedAt}))`,
        })
        .from(commentEvents)
        .where(and(IGNORED, gte(commentEvents.createdAt, from), sql`${commentEvents.createdAt} < ${to}`));
      const [c] = await tx
        .select({ clicked: sql<number>`count(*)::int` })
        .from(linkClicks)
        .where(and(gte(linkClicks.firstClickedAt, from), sql`${linkClicks.firstClickedAt} < ${to}`));
      return { ...r, clicked: c.clicked };
    };
    const now = new Date();
    const cur = await totals(since, now);
    const prev = await totals(prevSince, since);

    const daily = await tx
      .select({
        day: sql<string>`to_char(date_trunc('day', ${commentEvents.dmSentAt} at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)::int`,
      })
      .from(commentEvents)
      .where(and(eq(commentEvents.dmStatus, "sent"), gte(commentEvents.dmSentAt, since)))
      .groupBy(sql`1`);

    const byKeyword = await tx
      .select({
        id: keywords.id,
        name: keywords.name,
        term: sql<string>`${keywords.terms}[1]`,
        sent: sql<number>`count(${commentEvents.id}) filter (where ${commentEvents.dmStatus} = 'sent')::int`,
        read: sql<number>`count(${commentEvents.id}) filter (where ${commentEvents.dmReadAt} is not null)::int`,
        replied: sql<number>`count(${commentEvents.id}) filter (where ${commentEvents.dmRepliedAt} is not null)::int`,
        failed: sql<number>`count(${commentEvents.id}) filter (where ${commentEvents.dmStatus} like 'failed%')::int`,
        clicked: sql<number>`(select count(*)::int from link_clicks lc where lc.keyword_id = "keywords"."id" and lc.first_clicked_at >= ${since})`,
      })
      .from(keywords)
      .leftJoin(commentEvents, and(eq(commentEvents.keywordId, keywords.id), gte(commentEvents.createdAt, since)))
      .groupBy(keywords.id)
      .orderBy(sql`4 desc`);

    const heat = await tx
      .select({
        dow: sql<number>`extract(isodow from ${commentEvents.commentCreatedAt} at time zone 'America/Sao_Paulo')::int`,
        bucket: sql<number>`(extract(hour from ${commentEvents.commentCreatedAt} at time zone 'America/Sao_Paulo')::int / 3)`,
        n: sql<number>`count(*)::int`,
      })
      .from(commentEvents)
      .where(and(isNotNull(commentEvents.keywordId), gte(commentEvents.createdAt, since)))
      .groupBy(sql`1`, sql`2`);

    const byPost = await tx
      .select({
        postId: commentEvents.platformPostId,
        caption: postsCache.caption,
        thumbnailUrl: postsCache.thumbnailUrl,
        postedAt: postsCache.postedAt,
        matched: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) filter (where ${commentEvents.dmStatus} = 'sent')::int`,
        clicked: sql<number>`count(lc.id)::int`,
      })
      .from(commentEvents)
      .leftJoin(postsCache, eq(postsCache.platformPostId, commentEvents.platformPostId))
      .leftJoin(sql`link_clicks lc`, sql`lc.comment_event_id = ${commentEvents.id}`)
      .where(and(isNotNull(commentEvents.keywordId), gte(commentEvents.createdAt, since)))
      .groupBy(commentEvents.platformPostId, postsCache.caption, postsCache.thumbnailUrl, postsCache.postedAt)
      .orderBy(sql`4 desc`)
      .limit(5);

    const days_ = Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * DAY).toISOString().slice(0, 10));
    const grid = Array.from({ length: 7 }, (_, d) => Array.from({ length: 8 }, (_, b) => heat.find((h) => h.dow === d + 1 && h.bucket === b)?.n ?? 0));

    return { cur, prev, daily: days_.map((d) => ({ day: d, n: daily.find((x) => x.day === d)?.n ?? 0 })), byKeyword, heat: grid, byPost };
  });
}

/* ───────── Instagram e Direct (Zernio), com cache em analytics_snapshots ───────── */

type Kind = "ig_dashboard" | "ig_insights" | "ig_followers" | "ig_online" | "ig_demographics" | "inbox_volume" | "inbox_response";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function fetchKind(kind: Kind, accountId: string, days: RangeDays) {
  const toDate = ymd(new Date());
  const fromDate = ymd(new Date(Date.now() - (days - 1) * DAY));
  switch (kind) {
    case "ig_dashboard":
      return zernioAnalytics("dashboard", { platform: "instagram", fromDate, toDate, compare: "previous_period", topPosts: 5 });
    case "ig_insights":
      return zernioAnalytics("instagram/account-insights", { accountId, fromDate, toDate });
    case "ig_followers":
      // A Zernio aceita no máximo 89 dias de histórico de seguidores.
      return zernioAnalytics("instagram/follower-history", {
        accountId,
        fromDate: ymd(new Date(Date.now() - (Math.min(days, 89) - 1) * DAY)),
        toDate,
        metricType: "time_series",
      });
    case "ig_online":
      return zernioAnalytics("instagram/online-followers", { accountId });
    case "ig_demographics":
      return zernioAnalytics("instagram/demographics", { accountId });
    case "inbox_volume":
      return zernioAnalytics("inbox/volume", { accountId, fromDate, toDate });
    case "inbox_response":
      return zernioAnalytics("inbox/response-time", { accountId, fromDate, toDate });
  }
}

const KINDS: Kind[] = ["ig_dashboard", "ig_insights", "ig_followers", "ig_online", "ig_demographics", "inbox_volume", "inbox_response"];

/** Busca na Zernio os tipos pedidos e grava em analytics_snapshots. Falhas individuais são ignoradas. */
async function refreshSnapshots(userId: string, days: RangeDays, kinds: Kind[]) {
  const [conn] = await asWeb(userId, (tx) => tx.select({ id: connection.zernioAccountId }).from(connection));
  if (!conn) return [];
  const results = await Promise.allSettled(kinds.map((k) => fetchKind(k, conn.id, days)));
  const rows = kinds.flatMap((k, i) => {
    const r = results[i];
    return r.status === "fulfilled" ? [{ userId, kind: k, rangeDays: days, payload: r.value as object, fetchedAt: new Date() }] : [];
  });
  if (rows.length) {
    await asWorker(userId, async (tx) => {
      for (const row of rows) {
        await tx
          .insert(analyticsSnapshots)
          .values(row)
          .onConflictDoUpdate({ target: [analyticsSnapshots.userId, analyticsSnapshots.kind, analyticsSnapshots.rangeDays], set: { payload: row.payload, fetchedAt: row.fetchedAt } });
      }
    });
  }
  return rows;
}

/**
 * Stale-while-revalidate: o que já está no cache é mostrado na hora, mesmo vencido, e a atualização
 * roda depois da resposta (after). Só espera a Zernio o que nunca foi buscado ou o "Atualizar agora".
 */
export async function getInstagramAnalytics(userId: string, days: RangeDays, forceRefresh = false) {
  const cached = await asWeb(userId, (tx) => tx.select().from(analyticsSnapshots).where(eq(analyticsSnapshots.rangeDays, days)));
  const byKind = new Map(cached.map((c) => [c.kind as Kind, c]));
  const missing = KINDS.filter((k) => forceRefresh || !byKind.has(k));
  const expired = KINDS.filter((k) => !missing.includes(k) && Date.now() - byKind.get(k)!.fetchedAt.getTime() > SNAPSHOT_TTL_MS);

  if (missing.length) for (const row of await refreshSnapshots(userId, days, missing)) byKind.set(row.kind, row);
  if (expired.length) after(() => refreshSnapshots(userId, days, expired).catch(() => {}));

  const get = <T>(k: Kind) => byKind.get(k)?.payload as T | undefined;
  const fetchedAt = [...byKind.values()].reduce<Date | null>((min, c) => (!min || c.fetchedAt < min ? c.fetchedAt : min), null);
  const dashboard = get<{
    totals?: Record<string, number>;
    previousTotals?: Record<string, number>;
    followers?: { current?: number; gained?: number };
    daily?: { date: string; reach?: number; views?: number; engagement?: number }[];
    topPosts?: ZernioPost[];
    recentPosts?: ZernioPost[];
  }>("ig_dashboard");

  // Os posts da Zernio não trazem legenda/thumbnail: casamos pela data de publicação com o cache de posts.
  const posts = dashboard?.topPosts?.length ? await asWeb(userId, (tx) => tx.select().from(postsCache)) : [];
  const topPosts = (dashboard?.topPosts ?? []).map((p) => {
    const match = posts.find((c) => c.postedAt && p.publishedAt && sameMoment(c.postedAt, new Date(p.publishedAt)));
    const m = p.metrics ?? {};
    return {
      caption: match?.caption ?? "",
      thumbnailUrl: match?.thumbnailUrl ?? null,
      permalink: match?.permalink ?? null,
      interactions: (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0),
      reach: m.reach ?? 0,
      engagementRate: m.engagementRate,
    };
  });

  const followers = get<{ metrics?: Record<string, { total?: number; values?: { date: string; value: number }[] }> }>("ig_followers")?.metrics;

  // Média de seguidores online em cada hora (0–23) nos dias que a Meta devolveu.
  const onlineDays = get<{ days?: { hours?: Record<string, number> }[] }>("ig_online")?.days ?? [];
  const online = onlineDays.length
    ? Array.from({ length: 24 }, (_, h) => Math.round(onlineDays.reduce((s, d) => s + (d.hours?.[h] ?? 0), 0) / onlineDays.length))
    : [];

  return {
    fetchedAt,
    dashboard,
    daily: dashboard?.daily ?? [],
    zernioPosts: [...(dashboard?.topPosts ?? []), ...(dashboard?.recentPosts ?? [])],
    insights: get<{ metrics?: Record<string, { total?: number }> }>("ig_insights"),
    followers: {
      current: followers?.follower_count?.total ?? dashboard?.followers?.current,
      gained: followers?.followers_gained?.total,
      lost: followers?.followers_lost?.total,
      series: followers?.follower_count?.values ?? [],
    },
    online,
    demographics: get<{ demographics?: Record<string, { dimension: string; value: number }[]> }>("ig_demographics"),
    inboxVolume: get<{ summary?: Record<string, number>; timeseries?: { date: string; received?: number; sent?: number }[] }>("inbox_volume"),
    inboxResponse: get<{
      summary?: { medianSeconds?: number; p90Seconds?: number; sampleSize?: number };
      histogram?: { bucket: string; count: number }[];
    }>("inbox_response"),
    topPosts,
  };
}

export type ZernioPost = { postId?: string; publishedAt?: string; metrics?: Record<string, number> };

/** A Zernio e o cache de posts registram a publicação com segundos de diferença. */
export function sameMoment(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) < 120_000;
}
