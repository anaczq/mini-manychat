"use server";

import { revalidatePath } from "next/cache";
import { enforce, RateLimitedError } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";
import { setButtonsAllowed } from "@/lib/account";
import { audit } from "@/lib/audit";
import { wipeHistory } from "@/lib/data";
import { limitsInput, updateSettings } from "@/lib/settings";
import type { ActionResult } from "./result";

async function guarded(fn: (userId: string) => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await enforce("painelEscrita", user.id);
    const r = await fn(user.id);
    revalidatePath("/", "layout");
    return r ?? { ok: true };
  } catch (err) {
    if (err instanceof RateLimitedError) return { ok: false, error: "Muitas alterações seguidas. Tente em instantes." };
    console.error(JSON.stringify({ event: "settings_action_failed", message: err instanceof Error ? err.message : "unknown" }));
    return { ok: false, error: "Não foi possível salvar agora." };
  }
}

export async function setAutomationEnabledAction(enabled: boolean) {
  return guarded(async (userId) => {
    if (typeof enabled !== "boolean") return { ok: false, error: "Pedido inválido" };
    await updateSettings(userId, { automationEnabled: enabled });
    await audit(userId, enabled ? "automacoes_ligadas" : "automacoes_pausadas");
  });
}

export async function setButtonsAllowedAction(allowed: boolean) {
  return guarded(async (userId) => {
    if (typeof allowed !== "boolean") return { ok: false, error: "Pedido inválido" };
    await setButtonsAllowed(userId, allowed);
    await audit(userId, allowed ? "botoes_dm_ligados" : "botoes_dm_desligados");
  });
}

export async function saveLimitsAction(raw: unknown) {
  return guarded(async (userId) => {
    const parsed = limitsInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Valores inválidos" };
    await updateSettings(userId, parsed.data);
    await audit(userId, "limites_alterados");
  });
}

export async function wipeHistoryAction(confirmation: string) {
  return guarded(async (userId) => {
    if (confirmation !== "APAGAR") return { ok: false, error: "Digite APAGAR para confirmar" };
    await wipeHistory(userId);
    await audit(userId, "historico_apagado");
  });
}
