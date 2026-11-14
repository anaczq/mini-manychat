import { timingSafeEqual } from "node:crypto";
import { authDb, schema } from "@/db";
import { env } from "@/lib/env";
import { dueEventIds, processCommentEvent } from "@/lib/processor";
import { syncAccountProfile } from "@/lib/account";
import { purgeOld } from "@/lib/data";

function authorized(request: Request) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return !!secret && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

// Retentativas (backoff) de eventos parados + retenção de 90 dias. Chamado pelo Vercel Cron.
export async function GET(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  const users = await authDb().select({ id: schema.user.id }).from(schema.user);
  let processed = 0;
  let purged = 0;
  for (const u of users) {
    purged += await purgeOld(u.id);
    await syncAccountProfile(u.id, true).catch(() => undefined);
    for (const id of await dueEventIds(u.id, 30)) {
      await processCommentEvent(u.id, id);
      processed++;
    }
  }
  return Response.json({ processed, purged });
}
