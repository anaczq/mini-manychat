import { sql } from "drizzle-orm";
import { asWorker } from "@/db";
import { limitResponse } from "@/lib/ratelimit";

const NOT_FOUND_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link indisponível</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f5f5f5;font-family:system-ui,sans-serif;color:#292929}
main{max-width:360px;background:#fff;border-radius:8px;padding:32px;text-align:center}h1{font-size:20px}p{color:#707070;font-size:14px}</style></head>
<body><main><h1>Este link não está mais disponível</h1><p>Comente de novo no post para receber o material atualizado no seu Direct.</p></main></body></html>`;

function notFound() {
  return new Response(NOT_FOUND_HTML, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

// PRD §7.4.1: destino vem do banco (nunca da URL), só https, conta o clique sem guardar IP.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return notFound();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = await limitResponse("link", ip);
  if (limited) return limited;

  // A função SECURITY DEFINER resolve o token sem precisar de sessão nem de app.user_id.
  const result = await asWorker("", (tx) => tx.execute<{ url: string | null }>(sql`select app_resolve_link(${token}) as url`));
  const url = result.rows[0]?.url;
  if (!url || !url.startsWith("https://")) return notFound();

  return new Response(null, {
    status: 302,
    headers: { location: url, "referrer-policy": "no-referrer", "cache-control": "no-store" },
  });
}
