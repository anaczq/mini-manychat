import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { asWeb, schema } from "@/db";

const { settings } = schema;

export async function getSettings(userId: string) {
  const [s] = await asWeb(userId, (tx) => tx.select().from(settings));
  return s ?? null;
}

export const limitsInput = z.object({
  perUserDailyCap: z.coerce.number().int().min(1).max(20),
  outboundHourlyBudget: z.coerce.number().int().min(10).max(700),
  monthlyDmBudget: z.coerce.number().int().min(100).max(1_000_000),
});

export async function updateSettings(userId: string, patch: Partial<typeof settings.$inferInsert>) {
  await asWeb(userId, (tx) => tx.update(settings).set(patch).where(eq(settings.userId, userId)));
}
