import { exportAutomations } from "@/lib/data";
import { requireApiUser } from "@/lib/session";

export async function GET() {
  const user = await requireApiUser("painelLeitura");
  if (user instanceof Response) return user;
  const data = await exportAutomations(user.userId);
  return new Response(JSON.stringify({ exportadoEm: new Date().toISOString(), automacoes: data }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="automacoes-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
