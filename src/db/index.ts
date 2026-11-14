import "server-only";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { env } from "@/lib/env";
import * as schema from "./schema";

type Db = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Um pool por papel do Postgres (PRD §5.2). Nenhum deles tem BYPASSRLS.
const pools = new Map<string, Db>();

function db(url: string): Db {
  let d = pools.get(url);
  if (!d) {
    // Mesmo casing do drizzle.config.ts: colunas sem nome explícito viram snake_case.
    d = drizzle({ client: new Pool({ connectionString: url, max: 5 }), schema, casing: "snake_case" });
    pools.set(url, d);
  }
  return d;
}

/** Papel app_auth: só as tabelas do Better Auth. */
export const authDb = () => db(env().DATABASE_URL_AUTH);

/**
 * Roda `fn` numa transação com `app.user_id` definido (SET LOCAL), que é o que as políticas de RLS leem.
 * Sem isso as políticas devolvem zero linhas (falha fechada).
 */
async function withUserOn<T>(d: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return d.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/** Papel app_web: rotas do painel, sempre a partir da sessão validada. */
export const asWeb = <T>(userId: string, fn: (tx: Tx) => Promise<T>) => withUserOn(db(env().DATABASE_URL_WEB), userId, fn);

/** Papel app_worker: webhook, fila e crons. */
export const asWorker = <T>(userId: string, fn: (tx: Tx) => Promise<T>) => withUserOn(db(env().DATABASE_URL_WORKER), userId, fn);

/** Resolve o dono de uma conta Zernio sem sessão (função SECURITY DEFINER mínima). */
export async function ownerOfZernioAccount(zernioAccountId: string): Promise<string | null> {
  const res = await db(env().DATABASE_URL_WORKER).execute<{ owner: string | null }>(
    sql`select app_owner_of_account(${zernioAccountId}) as owner`,
  );
  return res.rows[0]?.owner ?? null;
}

export { schema };
