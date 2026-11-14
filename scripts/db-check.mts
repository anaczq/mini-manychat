// Confere tabelas, RLS e papéis do banco (sem imprimir segredos).
import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });
const t = await pool.query(
  `select c.relname, c.relrowsecurity rls, c.relforcerowsecurity force,
          (select count(*) from pg_policies p where p.tablename = c.relname) policies
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by 1`,
);
console.table(t.rows);
const r = await pool.query(
  `select rolname, rolcanlogin, rolbypassrls from pg_roles where rolname in ('app_web','app_worker','app_auth') order by 1`,
);
console.table(r.rows);
await pool.end();
