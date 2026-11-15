import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Rotas que não exigem sessão: login, API do Better Auth, webhooks/crons (têm assinatura própria) e o redirecionador de links.
const PUBLIC = [/^\/login(\/|$)/, /^\/api\/auth\//, /^\/api\/webhooks\//, /^\/api\/cron\//, /^\/api\/queues\//, /^\/l\//];

function csp(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Atributos style="" (barras de progresso, tamanhos) não aceitam nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.cdninstagram.com https://*.fbcdn.net https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    // Upload direto ao Vercel Blob (navegador → API do Blob).
    "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Checagem otimista (só presença do cookie). A validação real da sessão e do 2FA é feita no layout do painel.
  if (!PUBLIC.some((r) => r.test(pathname)) && !getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|icon.svg|apple-icon.png|marca/|icones/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
