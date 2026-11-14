"use server";

import { revalidatePath } from "next/cache";
import { getInstagramAnalytics, RANGES, type RangeDays } from "@/lib/analytics";
import { enforce, RateLimitedError } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./result";

/** "Atualizar agora": no máximo 1x a cada 10 min (cada atualização faz 7 chamadas à Zernio). */
export async function refreshAnalyticsAction(days: number): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!RANGES.includes(days as RangeDays)) return { ok: false, error: "Período inválido" };
    await enforce("analyticsRefresh", user.id);
    await getInstagramAnalytics(user.id, days as RangeDays, true);
    revalidatePath("/analytics");
    return { ok: true };
  } catch (err) {
    if (err instanceof RateLimitedError) return { ok: false, error: `Já atualizado há pouco. Tente em ${Math.ceil(err.retryAfterSeconds / 60)} min.` };
    return { ok: false, error: "Não foi possível atualizar agora." };
  }
}
