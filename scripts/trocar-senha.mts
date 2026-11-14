// Esqueceu a senha: grava uma nova direto no banco (papel app_auth) e encerra todas as sessões.
// Sem rota pública de reset (PRD RF02): só quem tem DATABASE_URL_AUTH consegue rodar. 2FA continua igual.
import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import ws from "ws";
import { readHidden } from "./lib/read-hidden.mts";

config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

const { PAINEL_EMAIL, DATABASE_URL_AUTH } = process.env;
if (!PAINEL_EMAIL) throw new Error("PAINEL_EMAIL não definida");
if (!DATABASE_URL_AUTH) throw new Error("DATABASE_URL_AUTH não definida");

console.log(`Banco: ${new URL(DATABASE_URL_AUTH).host}\nConta: ${PAINEL_EMAIL}\n`);
const first = await readHidden("Nova senha (mín. 8 caracteres): ");
if (first.length < 8) {
  console.error("Senha curta demais: use pelo menos 8 caracteres.");
  process.exit(1);
}
const second = await readHidden("Repita a senha: ");
if (first !== second) {
  console.error("As senhas não conferem.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL_AUTH });
const client = await pool.connect();
try {
  await client.query("begin");
  const { rows } = await client.query<{ id: string }>(`select id from "user" where email = $1`, [PAINEL_EMAIL]);
  if (!rows[0]) throw new Error("Usuária não encontrada: rode `pnpm db:seed` primeiro.");
  const userId = rows[0].id;
  const updated = await client.query(
    `update account set password = $1, updated_at = now() where user_id = $2 and provider_id = 'credential'`,
    [await hashPassword(first), userId],
  );
  if (!updated.rowCount) throw new Error("Credencial não encontrada: rode `pnpm db:seed` primeiro.");
  await client.query(`delete from session where user_id = $1`, [userId]);
  await client.query("select set_config('app.user_id', $1, true)", [userId]);
  await client.query(`insert into audit_log (user_id, action) values ($1, 'senha_redefinida')`, [userId]);
  await client.query("commit");
} catch (err) {
  await client.query("rollback");
  throw err;
} finally {
  client.release();
  await pool.end();
}

console.log("\nPronto: senha trocada e todas as sessões encerradas. Entre de novo com a senha nova + código 2FA.");
