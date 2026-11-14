import "server-only";
import { desc } from "drizzle-orm";
import { asWeb, schema } from "@/db";

const { auditLog } = schema;

/** Registra uma ação no audit_log (só INSERT; IP guardado como hash). */
export async function audit(userId: string, action: string, ipHash?: string | null) {
  await asWeb(userId, (tx) => tx.insert(auditLog).values({ userId, action, ipHash: ipHash ?? null }));
}

export async function listAudit(userId: string) {
  return asWeb(userId, (tx) => tx.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100));
}
