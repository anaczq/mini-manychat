import { z } from "zod";
import { exportHistoryCsv, PERIODS, STATUS_FILTERS } from "@/lib/history";
import { requireApiUser } from "@/lib/session";

const q = z.object({
  status: z.enum(Object.keys(STATUS_FILTERS) as [keyof typeof STATUS_FILTERS]).optional().catch(undefined),
  palavra: z.string().uuid().optional().catch(undefined),
  periodo: z.enum(Object.keys(PERIODS) as [keyof typeof PERIODS]).optional().catch(undefined),
});

export async function GET(request: Request) {
  const user = await requireApiUser("painelLeitura");
  if (user instanceof Response) return user;
  const f = q.parse(Object.fromEntries(new URL(request.url).searchParams));
  const csv = await exportHistoryCsv(user.userId, { ...f, page: 1 });
  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="historico-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
