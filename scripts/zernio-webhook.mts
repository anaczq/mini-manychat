// Cria ou atualiza o webhook "mini-manychat" na Zernio apontando para <url>/api/webhooks/zernio.
// Uso: pnpm zernio:webhook https://seu-tunel.trycloudflare.com --local   (túnel: também grava PUBLIC_URL no .env.local)
//      pnpm zernio:webhook https://seu-app.vercel.app                     (produção)
// O segredo vem de ZERNIO_WEBHOOK_SECRET e não é impresso.
import { config } from "dotenv";
import { upsertLocalEnv } from "./lib/env-file.mts";

config({ path: ".env.local" });

const NAME = "mini-manychat";
const EVENTS = ["comment.received", "message.received", "message.read", "message.delivered"];

const base = process.argv[2];
if (!base || !base.startsWith("https://")) throw new Error("Informe a URL pública https:// (túnel ou domínio)");
const { ZERNIO_API_KEY, ZERNIO_WEBHOOK_SECRET } = process.env;
if (!ZERNIO_API_KEY || !ZERNIO_WEBHOOK_SECRET) throw new Error("ZERNIO_API_KEY e ZERNIO_WEBHOOK_SECRET são obrigatórias");

const origin = base.replace(/\/$/, "");
const url = `${origin}/api/webhooks/zernio`;
const headers = { Authorization: `Bearer ${ZERNIO_API_KEY}`, "Content-Type": "application/json" };
const api = "https://zernio.com/api/v1/webhooks";

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${api}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Zernio ${method} ${path} → ${res.status}: ${String(json.error ?? "")}`);
  return json;
}

const { webhooks = [] } = (await call("GET", "/settings")) as { webhooks?: { _id?: string; id?: string; name: string }[] };
const existing = webhooks.find((w) => w.name === NAME);
const payload = { name: NAME, url, secret: ZERNIO_WEBHOOK_SECRET, events: EVENTS, isActive: true };

let webhookId: string;
if (existing) {
  webhookId = (existing._id ?? existing.id)!;
  await call("PUT", "/settings", { webhookId, ...payload });
  console.log(`webhook atualizado → ${url}`);
} else {
  const created = (await call("POST", "/settings", payload)) as { webhook?: { _id?: string; id?: string } };
  webhookId = (created.webhook?._id ?? created.webhook?.id)!;
  console.log(`webhook criado → ${url}`);
}

const test = (await call("POST", "/test", { webhookId })) as { success?: boolean; message?: string };
console.log(`evento de teste: ${test.success ? "entregue" : "falhou"} ${test.message ?? ""}`);

if (process.argv.includes("--local")) {
  upsertLocalEnv("PUBLIC_URL", origin);
  console.log(`PUBLIC_URL=${origin} gravada no .env.local (reinicie o pnpm dev)`);
}
