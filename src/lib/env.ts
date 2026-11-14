import "server-only";
import { z } from "zod";

// PRD §7.3: conexão com o Neon só com TLS + channel binding. O app não inicia sem isso.
const pgUrl = z
  .string()
  .url()
  .refine((u) => u.includes("sslmode=require") && u.includes("channel_binding=require"), {
    message: "a URL do Postgres precisa de sslmode=require e channel_binding=require",
  });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  // URL pública (túnel em dev, domínio em produção) usada nos links do DM. Padrão: APP_URL.
  PUBLIC_URL: z.string().url().optional(),

  DATABASE_URL_WEB: pgUrl,
  DATABASE_URL_WORKER: pgUrl,
  DATABASE_URL_AUTH: pgUrl,

  BETTER_AUTH_SECRET: z.string().min(32),
  PAINEL_EMAIL: z.string().email(),

  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string().min(1),

  ZERNIO_API_KEY: z.string().startsWith("sk_"),
  ZERNIO_ACCOUNT_ID: z.string().optional(),
  ZERNIO_WEBHOOK_SECRET: z.string().min(32).optional(),

  CRON_SECRET: z.string().min(32).optional(),
  // Vercel Blob (materiais em imagem). Sem ele, o editor só aceita link.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Só os nomes das variáveis, nunca os valores.
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Variáveis de ambiente inválidas:\n  ${problems}`);
  }
  cached = parsed.data;
  return cached;
}
