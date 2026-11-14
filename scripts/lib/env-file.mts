import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";

export const ENV_FILE = ".env.local";

export function readLocalEnv(): Record<string, string> {
  return existsSync(ENV_FILE) ? parse(readFileSync(ENV_FILE, "utf8")) : {};
}

/** Grava (ou apaga, com value = null) uma linha do .env.local sem mexer nas outras. */
export function upsertLocalEnv(name: string, value: string | null) {
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const pattern = new RegExp(`^${name}=.*\\n?`, "m");
  let next = current.replace(pattern, "");
  if (value !== null) next = `${next}${next.endsWith("\n") || next === "" ? "" : "\n"}${name}=${value}\n`;
  writeFileSync(ENV_FILE, next, { mode: 0o600 });
}
