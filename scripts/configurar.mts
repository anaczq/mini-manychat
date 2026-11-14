// Configuração completa do Mini Manychat, do zero até o painel pronto. Idempotente: pode rodar de novo.
// Pré-requisitos: projeto ligado (`pnpm exec vercel link`) com Neon e Upstash conectados no painel da Vercel.
// Uso: pnpm configurar --email voce@exemplo.com --zernio sk_... [--conta <ID da conta na Zernio>]
// Sem os argumentos, pergunta no terminal. Sem terminal (rodando pelo Claude), gera uma senha provisória.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import ws from "ws";
import { readLocalEnv, upsertLocalEnv } from "./lib/env-file.mts";
import { readHidden } from "./lib/read-hidden.mts";
import { ENVIRONMENTS, pullEnv, shell, vercelEnvNames, vercelEnvSet } from "./lib/vercel-env.mts";
import { zernioAccount } from "./lib/zernio-account.mts";

neonConfig.webSocketConstructor = ws;

const { values: args } = parseArgs({ options: { email: { type: "string" }, zernio: { type: "string" }, conta: { type: "string" } } });
const interactive = !!process.stdin.isTTY;

function step(n: number, text: string) {
  console.log(`\n[${n}/6] ${text}`);
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function ask(question: string): Promise<string> {
  if (!interactive) return "";
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer;
}

function run(script: string) {
  execFileSync("pnpm", ["-s", script], { stdio: "inherit", shell });
}

// 1. Projeto na Vercel com banco e Redis
step(1, "Conferindo o projeto na Vercel");
if (!existsSync(".vercel/project.json")) fail("Projeto não ligado na Vercel. Rode `pnpm exec vercel link` antes.");
let names = vercelEnvNames();
const missing = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "KV_REST_API_URL", "KV_REST_API_TOKEN"].filter((n) => !names.has(n));
if (missing.length) {
  fail(
    `Faltam variáveis da Vercel: ${missing.join(", ")}.\n` +
      "  Conecte no painel da Vercel → projeto → Storage: Neon (Postgres) e Upstash (Redis), região São Paulo.",
  );
}
console.log("✓ projeto ligado, Neon e Upstash conectados");

// 2. Login e Zernio
step(2, "Conferindo e-mail e conta do Instagram na Zernio");
const local = readLocalEnv();
const email = args.email ?? local.PAINEL_EMAIL ?? (await ask("E-mail para entrar no painel: "));
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Informe um e-mail válido com --email");
const zernioKey = args.zernio ?? local.ZERNIO_API_KEY ?? (await ask("Chave da API da Zernio (começa com sk_): "));
if (!zernioKey.startsWith("sk_")) fail("A chave da Zernio começa com sk_. Informe com --zernio");
const accountId = args.conta ?? local.ZERNIO_ACCOUNT_ID;
const account = await zernioAccount(zernioKey, accountId).catch((err: Error) => fail(err.message));
console.log(`✓ Instagram: @${account.username}`);

for (const e of ENVIRONMENTS) {
  vercelEnvSet("PAINEL_EMAIL", email, e);
  vercelEnvSet("ZERNIO_API_KEY", zernioKey, e);
  if (accountId) vercelEnvSet("ZERNIO_ACCOUNT_ID", accountId, e);
}
console.log("✓ e-mail e chave da Zernio gravados na Vercel");

// 3. Segredos e banco
step(3, "Gerando segredos e criando as tabelas");
run("secrets");
pullEnv();
run("db:migrate");
names = vercelEnvNames();
if (!names.has("DATABASE_URL_WEB") || !names.has("DATABASE_URL_WORKER") || !names.has("DATABASE_URL_AUTH")) {
  run("db:roles");
}
pullEnv();

// 4. Senha (só na primeira vez)
step(4, "Senha do painel");
const env = readLocalEnv();
const pool = new Pool({ connectionString: env.DATABASE_URL_AUTH });
const exists = (await pool.query(`select 1 from "user" where email = $1`, [email])).rowCount === 1;
await pool.end();

let provisional: string | undefined;
if (exists) {
  console.log("✓ conta já existe; senha mantida (para trocar: Configurações › Segurança)");
} else {
  let password: string;
  if (interactive) {
    password = await readHidden("Escolha a senha do painel (mín. 8 caracteres): ");
    if (password.length < 8) fail("Senha curta demais: use pelo menos 8 caracteres.");
    if ((await readHidden("Repita a senha: ")) !== password) fail("As senhas não conferem.");
  } else {
    password = provisional = randomBytes(12).toString("base64url");
  }
  upsertLocalEnv("SENHA_PAINEL", await hashPassword(password));
}

// 5. Conta, configurações e conexão com o Instagram
step(5, "Criando a conta e ligando o Instagram");
try {
  run("db:seed");
} finally {
  // O hash só serve para o primeiro seed; depois a senha vive no banco.
  upsertLocalEnv("SENHA_PAINEL", null);
}

// 6. Conferência de segurança do banco
step(6, "Conferindo a segurança do banco (RLS)");
run("test:rls");

console.log(`
✓ Tudo pronto.

  Rode:   pnpm dev
  Abra:   http://localhost:3000
  E-mail: ${email}${provisional ? `\n  Senha provisória: ${provisional}\n  → troque em Configurações › Segurança logo depois de entrar` : ""}

  No primeiro login o painel pede o 2FA: tenha um app autenticador no celular
  (Google Authenticator, 1Password, Authy…) e guarde os códigos de backup.
`);
