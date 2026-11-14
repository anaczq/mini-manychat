import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * X-Zernio-Signature = HMAC-SHA256 do corpo cru com o segredo, em hex minúsculo (PRD §7.4).
 * Comparação em tempo constante; qualquer formato inesperado é recusado.
 */
export function verifyZernioSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function signForTests(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}
