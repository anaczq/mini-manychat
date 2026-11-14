import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createOTP } from "@better-auth/utils/otp";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authDb, schema } from "@/db";
import { auth, authAudit } from "@/lib/auth";
import { env } from "@/lib/env";

export const resetInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().transform((c) => c.replace(/\s/g, "")).pipe(z.string().min(6).max(32)),
  newPassword: z.string().min(8).max(128),
});

// Hash antes do timingSafeEqual: tamanho fixo, então a comparação não vaza nem o comprimento do e-mail.
const sha256 = (s: string) => createHash("sha256").update(s).digest();

/**
 * "Esqueci a senha" sem e-mail: o código do app autenticador (ou um código de backup) prova que é a dona.
 * Devolve false para qualquer falha, sem dizer qual (e-mail, código ou 2FA ausente).
 */
export async function resetPasswordWith2fa(input: z.infer<typeof resetInput>, ip: string | null): Promise<boolean> {
  // E-mail errado não sai cedo: faz as mesmas consultas, decifra e confere o código igual e só recusa no fim;
  // senão o tempo de resposta denunciaria qual é o e-mail da dona.
  const emailOk = timingSafeEqual(sha256(input.email), sha256(env().PAINEL_EMAIL.toLowerCase()));
  const db = authDb();
  const [u] = await db.select().from(schema.user).where(eq(schema.user.email, env().PAINEL_EMAIL));
  if (!u?.twoFactorEnabled) return false;
  const [tf] = await db.select().from(schema.twoFactor).where(eq(schema.twoFactor.userId, u.id));
  if (!tf?.verified) return false;

  const ctx = await auth().$context;
  const key = ctx.secretConfig;
  let remainingBackupCodes: string | null = null;
  if (/^\d{6}$/.test(input.code)) {
    const secret = await symmetricDecrypt({ key, data: tf.secret });
    if (!(await createOTP(secret, { period: 30, digits: 6 }).verify(input.code)) || !emailOk) return false;
  } else {
    const codes: unknown = JSON.parse(await symmetricDecrypt({ key, data: tf.backupCodes }));
    if (!Array.isArray(codes) || !codes.includes(input.code) || !emailOk) return false;
    // Código de backup vale uma vez só.
    remainingBackupCodes = await symmetricEncrypt({ key, data: JSON.stringify(codes.filter((c) => c !== input.code)) });
  }

  const hash = await ctx.password.hash(input.newPassword);
  await db.transaction(async (tx) => {
    if (remainingBackupCodes) await tx.update(schema.twoFactor).set({ backupCodes: remainingBackupCodes }).where(eq(schema.twoFactor.id, tf.id));
    await tx.update(schema.account).set({ password: hash, updatedAt: new Date() }).where(eq(schema.account.userId, u.id));
    // Senha nova derruba todas as sessões abertas.
    await tx.delete(schema.session).where(eq(schema.session.userId, u.id));
  });
  await authAudit(u.id, "senha_redefinida_2fa", ip);
  return true;
}
