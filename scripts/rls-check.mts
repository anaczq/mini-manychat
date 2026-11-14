// Teste de RLS e permissões contra o banco real (PRD CA16–CA18). Não altera dados: tudo roda em
// transações desfeitas no final. Uso: pnpm test:rls
import { config } from "dotenv";
import { Pool, type PoolClient, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

type Check = { name: string; role: "WEB" | "WORKER" | "AUTH"; userId?: string; sql: string; expect: "zero" | "denied" | "rows" };

let failures = 0;

async function withClient(url: string, fn: (c: PoolClient) => Promise<void>) {
  const pool = new Pool({ connectionString: url });
  const c = await pool.connect();
  try {
    await fn(c);
  } finally {
    c.release();
    await pool.end();
  }
}

async function run(check: Check) {
  await withClient(process.env[`DATABASE_URL_${check.role}`]!, async (c) => {
    await c.query("begin");
    try {
      if (check.userId) await c.query("select set_config('app.user_id', $1, true)", [check.userId]);
      const r = await c.query(check.sql);
      const ok = check.expect === "zero" ? r.rowCount === 0 || Number(r.rows[0]?.n ?? 0) === 0 : check.expect === "rows";
      report(check, ok, check.expect === "denied" ? "a operação foi permitida" : `${r.rowCount} linhas`);
    } catch (err) {
      const denied = /permission denied|row-level security|violates/i.test(String(err));
      report(check, check.expect === "denied" ? denied : false, String(err).slice(0, 80));
    } finally {
      await c.query("rollback");
    }
  });
}

function report(check: Check, ok: boolean, detail: string) {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${check.name}${ok ? "" : ` — ${detail}`}`);
}

// Usuária real (para os testes que devem ver dados).
let userId = "";
await withClient(process.env.DATABASE_URL_AUTH!, async (c) => {
  userId = (await c.query(`select id from "user" limit 1`)).rows[0]?.id ?? "";
});

const checks: Check[] = [
  // Falha fechada: sem app.user_id, nada aparece (CA16).
  { name: "web sem sessão não vê automações", role: "WEB", sql: "select count(*)::int n from keywords", expect: "zero" },
  { name: "web sem sessão não vê histórico", role: "WEB", sql: "select count(*)::int n from comment_events", expect: "zero" },
  { name: "worker sem app.user_id não vê conexão", role: "WORKER", sql: "select count(*)::int n from connection", expect: "zero" },
  { name: "web com outro user_id não vê nada", role: "WEB", userId: "00000000-0000-0000-0000-000000000000", sql: "select count(*)::int n from keywords", expect: "zero" },
  // Sem GRANT: o painel não toca tabelas de login nem tokens (CA17/CA18).
  { name: "web não lê tabela de usuários", role: "WEB", userId, sql: `select * from "user"`, expect: "denied" },
  { name: "web não lê sessões", role: "WEB", userId, sql: "select * from session", expect: "denied" },
  { name: "web não lê segredos do 2FA", role: "WEB", userId, sql: "select * from two_factor", expect: "denied" },
  { name: "web não lê webhook_deliveries", role: "WEB", userId, sql: "select * from webhook_deliveries", expect: "denied" },
  { name: "web não lê tokens de link", role: "WEB", userId, sql: "select * from link_tokens", expect: "denied" },
  { name: "worker não lê tabela de usuários", role: "WORKER", userId, sql: `select * from "user"`, expect: "denied" },
  { name: "auth não lê automações", role: "AUTH", userId, sql: "select * from keywords", expect: "denied" },
  // Escrita restrita.
  { name: "web não apaga histórico", role: "WEB", userId, sql: "delete from comment_events", expect: "denied" },
  { name: "web não muda status do DM", role: "WEB", userId, sql: "update comment_events set dm_status = 'sent'", expect: "denied" },
  { name: "audit_log não aceita UPDATE", role: "WEB", userId, sql: "update audit_log set action = 'x'", expect: "denied" },
  { name: "audit_log não aceita DELETE", role: "WEB", userId, sql: "delete from audit_log", expect: "denied" },
  { name: "web não insere em nome de outra pessoa", role: "WEB", userId, sql: "insert into settings (user_id) values ('outra-pessoa')", expect: "denied" },
  // E o caminho normal funciona.
  { name: "web com sessão vê as próprias configurações", role: "WEB", userId, sql: "select * from settings", expect: "rows" },
];

if (!userId) {
  console.error("Nenhum usuário no banco: rode pnpm db:seed antes.");
  process.exit(1);
}
for (const c of checks) await run(c);
console.log(failures ? `\n${failures} verificação(ões) falharam` : `\nRLS ok: ${checks.length} verificações`);
process.exit(failures ? 1 : 0);
