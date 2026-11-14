import "server-only";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { asWeb, schema } from "@/db";
import { env } from "@/lib/env";

export const ALLOWED = {
  // Sem PDF: o Instagram não aceita documento no Direct (chegava como link). Só imagem vai como anexo.
  "image/png": { maxBytes: 8 * 1024 * 1024, magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/jpeg": { maxBytes: 8 * 1024 * 1024, magic: [0xff, 0xd8, 0xff] },
} as const;

export type AllowedMime = keyof typeof ALLOWED;

export type AssetView = { id: string; name: string; mime: string; sizeBytes: number; url: string };

const BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;

/** Detecta o tipo pelos primeiros bytes, não pela extensão nem pelo Content-Type declarado (PRD §7.6). */
export function sniff(bytes: Uint8Array): AllowedMime | null {
  for (const [mime, { magic }] of Object.entries(ALLOWED) as [AllowedMime, (typeof ALLOWED)[AllowedMime]][]) {
    if (magic.every((b, i) => bytes[i] === b)) return mime;
  }
  return null;
}

/**
 * Registra um arquivo que o navegador acabou de enviar ao Blob. Confere host, tamanho e assinatura;
 * se algo não bater, apaga o arquivo e recusa.
 */
export async function registerAsset(userId: string, url: string, name: string): Promise<AssetView> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !BLOB_HOST.test(u.hostname) || !u.pathname.startsWith(`/materiais/${userId}/`)) {
    throw new Error("Endereço de arquivo inválido");
  }
  const res = await fetch(url, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
  const mime = sniff(bytes);
  if (!mime || !total || total > ALLOWED[mime].maxBytes) {
    await del(url, { token: env().BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    throw new Error(mime ? "Arquivo maior que o permitido" : "Tipo não aceito. Envie PNG ou JPG.");
  }
  const safeName = name.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120) || "arquivo";
  const [row] = await asWeb(userId, (tx) =>
    tx
      .insert(schema.assets)
      .values({ userId, blobUrl: url, name: safeName, mime, sizeBytes: total, sha256: "-" })
      .returning(),
  );
  return { id: row.id, name: row.name, mime: row.mime, sizeBytes: row.sizeBytes, url: row.blobUrl };
}

export async function getAsset(userId: string, id: string): Promise<AssetView | null> {
  const [a] = await asWeb(userId, (tx) => tx.select().from(schema.assets).where(eq(schema.assets.id, id)));
  return a ? { id: a.id, name: a.name, mime: a.mime, sizeBytes: a.sizeBytes, url: a.blobUrl } : null;
}
