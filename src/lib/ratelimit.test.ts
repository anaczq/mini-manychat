import { beforeEach, describe, expect, it, vi } from "vitest";

// Ratelimit falso: conta chamadas por chave e respeita o "max" de cada limite.
const calls = vi.hoisted(() => new Map<string, number>());
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = (max: number, window: string) => ({ max, window });
    static tokenBucket = (refill: number, window: string, max: number) => ({ max, window, refill });
    constructor(private readonly opts: { limiter: { max: number }; prefix: string }) {}
    async limit(key: string) {
      const k = `${this.opts.prefix}:${key}`;
      const n = (calls.get(k) ?? 0) + 1;
      calls.set(k, n);
      return { success: n <= this.opts.limiter.max, reset: Date.now() + 30_000 };
    }
  }
  return { Ratelimit };
});
vi.mock("@/lib/env", () => ({ env: () => ({ KV_REST_API_URL: "https://x", KV_REST_API_TOKEN: "t" }) }));

const { allow, enforce, limitResponse, RateLimitedError } = await import("./ratelimit");

describe("rate limits (PRD §7.5)", () => {
  beforeEach(() => calls.clear());

  it("painel: 30 escritas por minuto, a 31ª é barrada com tempo de espera", async () => {
    for (let i = 0; i < 30; i++) await enforce("painelEscrita", "user_1");
    await expect(enforce("painelEscrita", "user_1")).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("limites são por chave (outra sessão não é afetada)", async () => {
    for (let i = 0; i < 30; i++) await enforce("painelEscrita", "user_1");
    await expect(enforce("painelEscrita", "user_2")).resolves.toBeUndefined();
  });

  it("anti-spam: no máximo 3 DMs por pessoa em 24 h (CA22)", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await allow("dmPorPessoa", "igsid_1")).ok);
    expect(results).toEqual([true, true, true, false]);
  });

  it("anti-flood: 10 comentários por pessoa em 10 min", async () => {
    let last = true;
    for (let i = 0; i < 11; i++) last = (await allow("comentariosPorPessoa", "igsid_1")).ok;
    expect(last).toBe(false);
  });

  it("saída: Private Replies limitadas a 600/h (abaixo dos 750 da Meta)", async () => {
    let blockedAt = 0;
    for (let i = 1; i <= 601; i++) if (!(await allow("privateReplyHora", "acc")).ok) blockedAt = i;
    expect(blockedAt).toBe(601);
  });

  it("rota pública de link: 31º acesso no minuto → 429 com Retry-After", async () => {
    for (let i = 0; i < 30; i++) expect(await limitResponse("link", "1.2.3.4")).toBeNull();
    const res = await limitResponse("link", "1.2.3.4");
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
