import "server-only";
import { desc, max, sql } from "drizzle-orm";
import { after } from "next/server";
import { asWeb, schema } from "@/db";
import { listRecentPosts } from "@/lib/zernio";

export type PickerPost = {
  id: string;
  caption: string;
  thumbnailUrl: string | null;
  permalink: string | null;
  isReel: boolean;
  postedAt: string | null;
};

const { connection, postsCache } = schema;

const CACHE_TTL_MS = 10 * 60 * 1000;

/** Busca os 25 posts mais recentes na Zernio (~10 s) e grava no cache. Se a Zernio falhar, o cache fica como está. */
async function refreshPosts(userId: string, zernioAccountId: string) {
  try {
    const fresh = await listRecentPosts(zernioAccountId);
    if (fresh.length) {
      const now = new Date();
      const rows = fresh.map((p) => ({
        userId,
        platformPostId: p.id,
        caption: p.message.slice(0, 500),
        mediaType: p.mediaType ?? null,
        thumbnailUrl: p.picture ?? null,
        permalink: p.permalink ?? null,
        postedAt: p.createdTime ? new Date(p.createdTime) : null,
        fetchedAt: now,
      }));
      await asWeb(userId, (tx) =>
        tx
          .insert(postsCache)
          .values(rows)
          .onConflictDoUpdate({
            target: postsCache.platformPostId,
            set: {
              caption: sql`excluded.caption`,
              mediaType: sql`excluded.media_type`,
              thumbnailUrl: sql`excluded.thumbnail_url`,
              permalink: sql`excluded.permalink`,
              postedAt: sql`excluded.posted_at`,
              fetchedAt: sql`excluded.fetched_at`,
            },
          }),
      );
    }
  } catch (err) {
    console.error(JSON.stringify({ event: "posts_fetch_failed", message: err instanceof Error ? err.message : "unknown" }));
  }
}

/** Os posts do cache (recentes da Zernio + já vistos em comentários). */
export async function getPostsForPicker(userId: string): Promise<{ posts: PickerPost[]; username: string | null; live: boolean }> {
  const conn = await asWeb(userId, (tx) => tx.select().from(connection).limit(1));
  const account = conn[0];
  let live = false;

  const [{ newest } = { newest: null }] = await asWeb(userId, (tx) =>
    tx.select({ newest: max(postsCache.fetchedAt) }).from(postsCache),
  );
  if (account && (!newest || Date.now() - newest.getTime() > CACHE_TTL_MS)) {
    if (newest) {
      // Cache velho: a página abre na hora com ele e a Zernio atualiza depois da resposta.
      after(() => refreshPosts(userId, account.zernioAccountId));
    } else {
      // Cache vazio (primeira vez): não há o que mostrar, então espera a Zernio.
      await refreshPosts(userId, account.zernioAccountId);
      live = true;
    }
  }

  const cached = await asWeb(userId, (tx) => tx.select().from(postsCache).orderBy(desc(postsCache.postedAt)).limit(60));
  return {
    username: account?.username ?? null,
    live,
    posts: cached.map((p) => ({
      id: p.platformPostId,
      caption: p.caption ?? "",
      thumbnailUrl: p.thumbnailUrl,
      permalink: p.permalink,
      isReel: /reel|video/i.test(p.mediaType ?? ""),
      postedAt: p.postedAt?.toISOString() ?? null,
    })),
  };
}
