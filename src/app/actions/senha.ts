"use server";

import { headers } from "next/headers";
import { resetInput, resetPasswordWith2fa } from "@/lib/password-reset";
import { enforce, RateLimitedError } from "@/lib/ratelimit";
import type { ActionResult } from "./result";

/** Pública (tela de login): sem sessão. Limite global de 5 tentativas a cada 15 min e 20 por dia. */
export async function resetPasswordAction(form: FormData): Promise<ActionResult> {
  try {
    await enforce("redefinirSenha", "global");
    await enforce("redefinirSenhaDia", "global");
    const parsed = resetInput.safeParse({ email: form.get("email"), code: form.get("code"), newPassword: form.get("newPassword") });
    if (!parsed.success) return { ok: false, error: "Confira os campos: a senha nova precisa de pelo menos 8 caracteres." };
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    if (!(await resetPasswordWith2fa(parsed.data, ip))) return { ok: false, error: "E-mail ou código incorretos." };
    return { ok: true };
  } catch (err) {
    if (err instanceof RateLimitedError) {
      const espera = err.retryAfterSeconds > 3600 ? `${Math.ceil(err.retryAfterSeconds / 3600)} h` : `${Math.ceil(err.retryAfterSeconds / 60)} min`;
      return { ok: false, error: `Muitas tentativas. Tente de novo em ${espera} ou use o comando pnpm trocar-senha.` };
    }
    console.error(JSON.stringify({ event: "password_reset_failed", message: err instanceof Error ? err.message : "unknown" }));
    return { ok: false, error: "Não foi possível redefinir agora. Tente de novo." };
  }
}
