import { requireApiUser } from "@/lib/session";
import { sendWebhookTest } from "@/lib/zernio";

// Botão "Enviar evento de teste" (Configurações › Instagram).
export async function POST() {
  const user = await requireApiUser("painelEscrita");
  if (user instanceof Response) return user;
  const ok = await sendWebhookTest().catch(() => false);
  return new Response(null, { status: ok ? 204 : 502 });
}
