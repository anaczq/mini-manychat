import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// Limites do PRD §7.5. Estado no Upstash (memória não serve em serverless).
const LIMITS = {
  painelEscrita: Ratelimit.slidingWindow(30, "1 m"),
  painelLeitura: Ratelimit.slidingWindow(120, "1 m"),
  upload: Ratelimit.slidingWindow(10, "1 h"),
  link: Ratelimit.slidingWindow(30, "1 m"),
  // "Esqueci a senha": chave global (usuária única), então trocar de IP não dá mais tentativas.
  redefinirSenha: Ratelimit.slidingWindow(5, "15 m"),
  // Teto diário, também global: limita quem tenta adivinhar o código 2FA a 20 chutes/dia (~2%/ano de acerto).
  // Contrapartida: um estranho pode travar o reset por até 24 h; aí a saída é `pnpm trocar-senha`.
  redefinirSenhaDia: Ratelimit.slidingWindow(20, "24 h"),
  analyticsRefresh: Ratelimit.slidingWindow(1, "10 m"),
  // Anti-spam por pessoa que comenta (PRD §7.5).
  dmPorPessoa: Ratelimit.slidingWindow(3, "24 h"),
  comentariosPorPessoa: Ratelimit.slidingWindow(10, "10 m"),
  // Orçamento de saída: Zernio grátis = 60 req/min; Meta = 750 private replies/h.
  zernioSaida: Ratelimit.tokenBucket(45, "1 m", 45),
  privateReplyHora: Ratelimit.slidingWindow(600, "1 h"),
  respostaPublicaHora: Ratelimit.slidingWindow(300, "1 h"),
} as const;

export type LimitName = keyof typeof LIMITS;

let redis: Redis | undefined;
const limiters = new Map<LimitName, Ratelimit>();

function limiter(name: LimitName) {
  redis ??= new Redis({ url: env().KV_REST_API_URL, token: env().KV_REST_API_TOKEN });
  let l = limiters.get(name);
  if (!l) {
    l = new Ratelimit({ redis, limiter: LIMITS[name], prefix: `rl:${name}` });
    limiters.set(name, l);
  }
  return l;
}

export class RateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Muitas requisições. Tente de novo em instantes.");
  }
}

/** Lança RateLimitedError (para Server Actions) quando o limite estoura. */
export async function enforce(name: LimitName, key: string) {
  const r = await limiter(name).limit(key);
  if (!r.success) throw new RateLimitedError(Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)));
}

/** Para o worker: true se passou; false se estourou (sem lançar). */
export async function allow(name: LimitName, key: string): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const r = await limiter(name).limit(key);
  return { ok: r.success, retryAfterSeconds: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
}

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];
const dynamic = new Map<string, Ratelimit>();

/** Limite com teto configurável (vem das Configurações): um limitador por valor. */
export async function allowUpTo(name: LimitName, max: number, window: Window, key: string) {
  redis ??= new Redis({ url: env().KV_REST_API_URL, token: env().KV_REST_API_TOKEN });
  const id = `${name}:${max}:${window}`;
  let l = dynamic.get(id);
  if (!l) {
    l = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(max, window), prefix: `rl:${name}` });
    dynamic.set(id, l);
  }
  const r = await l.limit(key);
  return { ok: r.success, retryAfterSeconds: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
}

/** Versão para Route Handlers: devolve a resposta 429 com Retry-After, ou null se passou. */
export async function limitResponse(name: LimitName, key: string): Promise<Response | null> {
  const r = await limiter(name).limit(key);
  if (r.success) return null;
  const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
  return new Response("Muitas requisições", { status: 429, headers: { "Retry-After": String(retryAfter) } });
}
