import { beforeEach, describe, expect, it, vi } from "vitest";
import { signForTests, verifyZernioSignature } from "@/lib/webhook-signature";

const SECRET = "s".repeat(64);
const db = vi.hoisted(() => ({ asWorker: vi.fn(), ownerOfZernioAccount: vi.fn() }));
const processor = vi.hoisted(() => ({ processCommentEvent: vi.fn(), dueEventIds: vi.fn(async () => []) }));

vi.mock("@/lib/env", () => ({ env: () => ({ ZERNIO_WEBHOOK_SECRET: SECRET }) }));
vi.mock("@/db", () => ({ ...db, schema: { commentEvents: {}, connection: {}, webhookDeliveries: {} } }));
vi.mock("@/lib/processor", () => processor);
vi.mock("@/lib/queue", () => ({ enqueueComment: vi.fn(async () => true) }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));

const { POST } = await import("./route");

function request(body: unknown, headers: Record<string, string> = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/webhooks/zernio", {
    method: "POST",
    body: raw,
    headers: { "content-type": "application/json", ...headers },
  });
}

const event = { id: "evt_1", event: "comment.received", timestamp: new Date().toISOString(), account: { id: "acc_1", platform: "instagram" } };

describe("verifyZernioSignature", () => {
  it("aceita a assinatura certa e recusa qualquer outra", () => {
    const raw = JSON.stringify(event);
    expect(verifyZernioSignature(raw, signForTests(raw, SECRET), SECRET)).toBe(true);
    expect(verifyZernioSignature(raw, signForTests(raw, "outro-segredo"), SECRET)).toBe(false);
    expect(verifyZernioSignature(`${raw} `, signForTests(raw, SECRET), SECRET)).toBe(false);
    expect(verifyZernioSignature(raw, null, SECRET)).toBe(false);
    expect(verifyZernioSignature(raw, "abc", SECRET)).toBe(false);
  });
});

describe("POST /api/webhooks/zernio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem assinatura → 401 e nada é gravado (CA04)", async () => {
    const res = await POST(request(event));
    expect(res.status).toBe(401);
    expect(db.ownerOfZernioAccount).not.toHaveBeenCalled();
    expect(db.asWorker).not.toHaveBeenCalled();
  });

  it("assinatura errada → 401 e nada é gravado (CA04)", async () => {
    const raw = JSON.stringify(event);
    const res = await POST(request(raw, { "x-zernio-signature": signForTests(raw, "invasor") }));
    expect(res.status).toBe(401);
    expect(db.asWorker).not.toHaveBeenCalled();
  });

  it("Content-Type diferente de JSON → 415", async () => {
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: "{}", headers: { "content-type": "text/plain" } }));
    expect(res.status).toBe(415);
  });

  it("evento de outra conta Zernio → 200 sem gravar (CA05)", async () => {
    db.ownerOfZernioAccount.mockResolvedValueOnce(null);
    const raw = JSON.stringify(event);
    const res = await POST(request(raw, { "x-zernio-signature": signForTests(raw, SECRET) }));
    expect(res.status).toBe(200);
    expect(db.asWorker).not.toHaveBeenCalled();
  });

  it("evento antigo (> 72 h, replay) → 200 sem gravar", async () => {
    const old = { ...event, timestamp: new Date(Date.now() - 80 * 3600_000).toISOString() };
    const raw = JSON.stringify(old);
    const res = await POST(request(raw, { "x-zernio-signature": signForTests(raw, SECRET) }));
    expect(res.status).toBe(200);
    expect(db.ownerOfZernioAccount).not.toHaveBeenCalled();
  });

  it("comentário com formato inválido → 400 sem marcar o evento (o reenvio da Zernio ainda entra)", async () => {
    db.ownerOfZernioAccount.mockResolvedValue("user_1");
    const raw = JSON.stringify({ ...event, comment: { id: "c1" } });
    const res = await POST(request(raw, { "x-zernio-signature": signForTests(raw, SECRET) }));
    expect(res.status).toBe(400);
    expect(db.asWorker).not.toHaveBeenCalled();
  });

  it("evento repetido (mesmo id) → 200 e não processa de novo (CA09)", async () => {
    db.ownerOfZernioAccount.mockResolvedValue("user_1");
    db.asWorker.mockResolvedValueOnce(false); // insert em webhook_deliveries não inseriu: já existia
    const raw = JSON.stringify({
      ...event,
      comment: { id: "c1", platformPostId: "p1", platform: "instagram", text: "ebook", createdAt: new Date().toISOString(), author: { id: "u9" } },
    });
    const res = await POST(request(raw, { "x-zernio-signature": signForTests(raw, SECRET) }));
    expect(res.status).toBe(200);
    expect(processor.processCommentEvent).not.toHaveBeenCalled();
  });
});
