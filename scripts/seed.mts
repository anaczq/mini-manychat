// Cria a conta única do painel (PAINEL_EMAIL), as configurações padrão e a conexão com a conta Instagram da Zernio.
// Idempotente: pode rodar de novo sem duplicar nada.
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { zernioAccount } from "./lib/zernio-account.mts";

config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

const { PAINEL_EMAIL, SENHA_PAINEL, ZERNIO_API_KEY, ZERNIO_ACCOUNT_ID, DATABASE_URL_AUTH, DATABASE_URL_WEB, DATABASE_URL_WORKER } = process.env;
for (const [k, v] of Object.entries({ PAINEL_EMAIL, ZERNIO_API_KEY, DATABASE_URL_AUTH, DATABASE_URL_WEB, DATABASE_URL_WORKER })) {
  if (!v) throw new Error(`${k} não definida`);
}
if (SENHA_PAINEL && !/^[0-9a-f]+:[0-9a-f]+$/.test(SENHA_PAINEL)) {
  throw new Error("SENHA_PAINEL não é um hash: rode `pnpm hash-senha`");
}
// SENHA_PAINEL só define a senha inicial (só é exigida na primeira vez). Depois ela vive em account.password e muda pelo painel ou por
// `pnpm trocar-senha`; o seed não sobrescreve.

async function asUser(url: string, userId: string, fn: (q: Pool["query"]) => Promise<void>) {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id', $1, true)", [userId]);
    await fn(client.query.bind(client) as Pool["query"]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// 0. Conta Instagram conectada na Zernio: o nome no painel vem dela.
const acc = await zernioAccount(ZERNIO_API_KEY!, ZERNIO_ACCOUNT_ID);

// 1. Conta + credencial (papel app_auth)
const authPool = new Pool({ connectionString: DATABASE_URL_AUTH });
let userId: string;
try {
  const found = await authPool.query<{ id: string }>(`select id from "user" where email = $1`, [PAINEL_EMAIL]);
  const others = await authPool.query<{ n: string }>(`select count(*)::text n from "user" where email <> $1`, [PAINEL_EMAIL]);
  if (others.rows[0].n !== "0") throw new Error("Já existe outro usuário no banco; o painel é de uma pessoa só.");
  if (found.rows[0]) {
    userId = found.rows[0].id;
    await authPool.query(`update "user" set name = $1, updated_at = now() where id = $2`, [acc.username, userId]);
    console.log("conta já existia; senha mantida");
  } else {
    if (!SENHA_PAINEL) throw new Error("Primeira vez: rode `pnpm hash-senha` para definir SENHA_PAINEL");
    userId = randomUUID();
    await authPool.query(`insert into "user" (id, name, email, email_verified) values ($1, $2, $3, true)`, [userId, acc.username, PAINEL_EMAIL]);
    await authPool.query(
      `insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, SENHA_PAINEL],
    );
    console.log("conta criada");
  }
} finally {
  await authPool.end();
}

// 2. Configurações padrão (papel app_web)
await asUser(DATABASE_URL_WEB!, userId, async (q) => {
  await q(`insert into settings (user_id) values ($1) on conflict (user_id) do nothing`, [userId]);
});
console.log("configurações padrão ok");

// 3. Conexão com a conta Instagram da Zernio (papel app_worker)
await asUser(DATABASE_URL_WORKER!, userId, async (q) => {
  await q(
    `insert into connection (user_id, zernio_account_id, username, ig_user_id, profile_picture, health_status, last_health_at)
     values ($1, $2, $3, $4, $5, 'healthy', now())
     on conflict (user_id) do update set zernio_account_id = excluded.zernio_account_id, username = excluded.username,
       ig_user_id = excluded.ig_user_id, profile_picture = excluded.profile_picture`,
    [userId, acc.id, acc.username, acc.igUserId, acc.picture],
  );
});
console.log(`conexão ok: @${acc.username}`);
