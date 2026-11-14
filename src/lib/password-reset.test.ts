import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco, cifra e OTP falsos: cada passo caro entra no "trace", e as gravações vão para "writes".
const trace = vi.hoisted(() => [] as string[]);
const writes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: () => ({ PAINEL_EMAIL: "Dona@Exemplo.com" }) }));
vi.mock("drizzle-orm", () => ({ eq: () => undefined }));
vi.mock("@/db", () => {
  const schema = { user: {}, twoFactor: {}, account: {}, session: {} };
  const rows = new Map<unknown, unknown[]>([
    [schema.user, [{ id: "u1", twoFactorEnabled: true }]],
    [schema.twoFactor, [{ id: "tf1", verified: true, secret: "totp", backupCodes: JSON.stringify(["backup-1234"]) }]],
  ]);
  const tx = { update: () => ({ set: () => ({ where: writes }) }), delete: () => ({ where: writes }) };
  const db = {
    select: () => ({ from: (t: unknown) => ({ where: async () => (trace.push("select"), rows.get(t)) }) }),
    transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
  };
  return { authDb: () => db, schema };
});
vi.mock("better-auth/crypto", () => ({
  symmetricDecrypt: async ({ data }: { data: string }) => (trace.push("decrypt"), data),
  symmetricEncrypt: async ({ data }: { data: string }) => data,
}));
vi.mock("@better-auth/utils/otp", () => ({
  createOTP: () => ({ verify: async (code: string) => (trace.push("verify"), code === "123456") }),
}));
vi.mock("@/lib/auth", () => ({
  auth: () => ({ $context: Promise.resolve({ secretConfig: "k", password: { hash: async () => "hash" } }) }),
  authAudit: vi.fn(),
}));

const { resetInput, resetPasswordWith2fa } = await import("./password-reset");

const input = (email: string, code: string) => resetInput.parse({ email, code, newPassword: "senha-nova-123" });

describe("resetPasswordWith2fa", () => {
  beforeEach(() => {
    trace.length = 0;
    vi.clearAllMocks();
  });

  it("e-mail errado faz o mesmo trabalho que o certo (o tempo não denuncia o e-mail)", async () => {
    expect(await resetPasswordWith2fa(input("dona@exemplo.com", "000000"), null)).toBe(false);
    const certo = trace.splice(0);
    expect(await resetPasswordWith2fa(input("outra@exemplo.com", "000000"), null)).toBe(false);
    expect(certo).toEqual(["select", "select", "decrypt", "verify"]);
    expect(trace).toEqual(certo);
  });

  it("e-mail errado com código válido é recusado e o código de backup não é gasto", async () => {
    expect(await resetPasswordWith2fa(input("outra@exemplo.com", "123456"), null)).toBe(false);
    expect(await resetPasswordWith2fa(input("outra@exemplo.com", "backup-1234"), null)).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });

  it("e-mail certo (sem diferenciar maiúsculas) e código válido trocam a senha", async () => {
    expect(await resetPasswordWith2fa(input(" Dona@Exemplo.com", "123 456"), null)).toBe(true);
    expect(writes).toHaveBeenCalled();
  });
});
