import "server-only";
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import { authDb, schema } from "@/db";
import { env } from "@/lib/env";

function createAuth() {
  const e = env();
  const production = e.NODE_ENV === "production";
  return betterAuth({
    appName: "Mini Manychat",
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.APP_URL],
    database: drizzleAdapter(authDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Usuária única, criada por `pnpm db:seed`. Sem cadastro e sem reset por e-mail (PRD D3).
      // Hash scrypt da senha em account.password; troca pelo painel ou por `pnpm trocar-senha`.
      disableSignUp: true,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 10,
      // Cookie assinado com a sessão: evita ir ao banco a cada navegação. Uma sessão revogada
      // continua valendo por no máximo 2 min.
      cookieCache: { enabled: true, maxAge: 60 * 2 },
    },
    // PRD §7.5: storage no banco (memória não funciona em serverless).
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/email": { window: 15 * 60, max: 5 },
        "/two-factor/*": { window: 5 * 60, max: 5 },
        "/change-password": { window: 15 * 60, max: 5 },
        "/sign-up/*": false,
      },
    },
    advanced: {
      useSecureCookies: production,
      defaultCookieAttributes: { httpOnly: true, secure: production, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/change-password" || isAPIError(ctx.context.returned)) return;
        const session = ctx.context.session;
        if (session) await authAudit(session.user.id, "senha_alterada", session.session.ipAddress);
      }),
    },
    databaseHooks: {
      session: {
        create: {
          // Cada sessão nova = login completo, exceto a recriada pela troca de senha.
          after: async (session, ctx) => {
            if (ctx?.path === "/change-password") return;
            await authAudit(session.userId, "login", session.ipAddress);
          },
        },
      },
    },
    plugins: [
      twoFactor({ issuer: "Mini Manychat", backupCodeOptions: { amount: 10 } }),
      nextCookies(),
    ],
  });
}

// O audit_log exige app.user_id (RLS). IP nunca em claro: HMAC com o segredo da app, só para comparar entre si.
export async function authAudit(userId: string, action: string, ip: string | null | undefined) {
  const ipHash = ip ? createHmac("sha256", env().BETTER_AUTH_SECRET).update(ip).digest("hex").slice(0, 32) : null;
  await authDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.insert(schema.auditLog).values({ userId, action, ipHash });
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function auth() {
  instance ??= createAuth();
  return instance;
}
