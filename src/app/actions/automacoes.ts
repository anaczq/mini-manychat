"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  automationInput,
  deleteAutomation,
  duplicateAutomation,
  findTermConflicts,
  saveAutomation,
  setAutomationActive,
} from "@/lib/automations";
import { enforce, RateLimitedError } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./result";

const idSchema = z.string().uuid();

async function guard() {
  const user = await requireUser();
  await enforce("painelEscrita", user.id);
  return user;
}

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof RateLimitedError) return { ok: false, error: `Muitas alterações seguidas. Tente de novo em ${err.retryAfterSeconds}s.` };
  console.error(JSON.stringify({ event: "automation_action_failed", message: err instanceof Error ? err.message : "unknown" }));
  return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
}

export async function saveAutomationAction(
  id: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string; conflicts: string[] }>> {
  try {
    const user = await guard();
    if (id !== null && !idSchema.safeParse(id).success) return { ok: false, error: "Automação inválida" };
    const parsed = automationInput.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return { ok: false, error: "Corrija os itens marcados antes de salvar", fieldErrors };
    }
    const savedId = await saveAutomation(user.id, id, parsed.data);
    const conflicts = parsed.data.active ? await findTermConflicts(user.id, savedId, parsed.data) : [];
    revalidatePath("/automacoes");
    revalidatePath("/");
    return { ok: true, data: { id: savedId, conflicts } };
  } catch (err) {
    return fail(err);
  }
}

export async function toggleAutomationAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const user = await guard();
    if (!idSchema.safeParse(id).success || typeof active !== "boolean") return { ok: false, error: "Pedido inválido" };
    await setAutomationActive(user.id, id, active);
    revalidatePath("/automacoes");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function duplicateAutomationAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await guard();
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Pedido inválido" };
    const newId = await duplicateAutomation(user.id, id);
    if (!newId) return { ok: false, error: "Automação não encontrada" };
    revalidatePath("/automacoes");
    return { ok: true, data: { id: newId } };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteAutomationAction(id: string, confirmation: string): Promise<ActionResult> {
  try {
    const user = await guard();
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Pedido inválido" };
    if (confirmation !== "EXCLUIR") return { ok: false, error: "Digite EXCLUIR para confirmar" };
    await deleteAutomation(user.id, id);
    revalidatePath("/automacoes");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
