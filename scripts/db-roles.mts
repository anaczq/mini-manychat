// Define (ou rotaciona) as senhas dos papéis app_web, app_worker e app_auth e grava as URLs
// de conexão nas variáveis da Vercel. Nenhuma senha é impressa.
// Depois rode `vercel env pull .env.local --yes` para trazer as URLs para o ambiente local.
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { ENVIRONMENTS, vercelEnvSet } from "./lib/vercel-env.mts";

config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

const ROLES = { app_web: "DATABASE_URL_WEB", app_worker: "DATABASE_URL_WORKER", app_auth: "DATABASE_URL_AUTH" } as const;

const owner = process.env.DATABASE_URL_UNPOOLED;
const pooled = process.env.DATABASE_URL;
if (!owner || !pooled) throw new Error("DATABASE_URL e DATABASE_URL_UNPOOLED são obrigatórias (rode vercel env pull)");

function urlFor(role: string, password: string) {
  const u = new URL(pooled!);
  u.username = role;
  u.password = password;
  u.searchParams.set("sslmode", "require");
  u.searchParams.set("channel_binding", "require");
  return u.toString();
}

const pool = new Pool({ connectionString: owner });
try {
  for (const [role, envName] of Object.entries(ROLES)) {
    const password = randomBytes(32).toString("base64url");
    // Identificador fixo (lista acima) e senha sem aspas: base64url só tem [A-Za-z0-9_-].
    await pool.query(`ALTER ROLE ${role} WITH LOGIN PASSWORD '${password}'`);
    const url = urlFor(role, password);
    for (const e of ENVIRONMENTS) vercelEnvSet(envName, url, e);
    console.log(`${role}: senha definida e ${envName} gravada na Vercel (${ENVIRONMENTS.join(", ")})`);
  }
} finally {
  await pool.end();
}
