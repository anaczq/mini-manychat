"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { markForRetry } from "@/lib/history";
import { processCommentEvent } from "@/lib/processor";
import { enforce, RateLimitedError } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./result";

export async function retryEventAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await enforce("painelEscrita", user.id);
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Evento inválido" };
    const updated = await markForRetry(user.id, id);
    if (!updated.length) return { ok: false, error: "Este evento não pode ser reprocessado." };
    // O painel só marca para retry (RLS); o envio roda com o papel do worker, depois da resposta.
    after(() => processCommentEvent(user.id, id));
    revalidatePath("/historico");
    return { ok: true };
  } catch (err) {
    if (err instanceof RateLimitedError) return { ok: false, error: "Muitas ações seguidas. Tente em instantes." };
    return { ok: false, error: "Não foi possível reprocessar agora." };
  }
}
