import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { headers } from "next/headers";
import { ALLOWED } from "@/lib/assets";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { enforce, RateLimitedError } from "@/lib/ratelimit";

// Emite o token de upload direto para o Blob (o arquivo não passa pela função: limite de 4,5 MB da Vercel).
export async function POST(request: Request) {
  const token = env().BLOB_READ_WRITE_TOKEN;
  if (!token) return Response.json({ error: "Armazenamento de arquivos não configurado" }, { status: 503 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth().api.getSession({ headers: await headers() });
        if (!session?.user.twoFactorEnabled) throw new Error("Não autorizado");
        await enforce("upload", session.user.id);
        if (!pathname.startsWith(`materiais/${session.user.id}/`)) throw new Error("Caminho inválido");
        return {
          allowedContentTypes: Object.keys(ALLOWED),
          maximumSizeInBytes: Math.max(...Object.values(ALLOWED).map((a) => a.maxBytes)),
          addRandomSuffix: true,
        };
      },
      // O registro é feito pela Server Action depois do upload (funciona também sem URL pública em dev).
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (err) {
    const status = err instanceof RateLimitedError ? 429 : 400;
    return Response.json({ error: err instanceof Error ? err.message : "Falha no upload" }, { status });
  }
}
