import { execFileSync } from "node:child_process";
import { ENV_FILE, readLocalEnv, upsertLocalEnv } from "./env-file.mts";

// Preview fica de fora: o CLI exige escolher branch de forma interativa nesse ambiente.
export const ENVIRONMENTS = ["production", "development"] as const;

/** Grava (substituindo) uma variável na Vercel sem imprimir o valor. */
export function vercelEnvSet(name: string, value: string, environment: (typeof ENVIRONMENTS)[number]) {
  try {
    execFileSync("vercel", ["env", "rm", name, environment, "--yes"], { stdio: "ignore" });
  } catch {
    // ainda não existia
  }
  const args = ["env", "add", name, environment];
  if (environment !== "development") args.push("--sensitive");
  execFileSync("vercel", args, { input: value, stdio: ["pipe", "ignore", "inherit"] });
}

export function vercelEnvNames(): Set<string> {
  const out = execFileSync("vercel", ["env", "ls"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return new Set(out.split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((n) => /^[A-Z_]+$/.test(n)));
}

// Só existem no computador (túnel): sobrevivem ao `vercel env pull`, que reescreve o .env.local.
const LOCAL_ONLY = ["PUBLIC_URL"] as const;

/** Traz as variáveis de development da Vercel para o .env.local, mantendo as que só existem localmente. */
export function pullEnv() {
  const keep = readLocalEnv();
  execFileSync("vercel", ["env", "pull", ENV_FILE, "--yes"], { stdio: ["ignore", "ignore", "inherit"] });
  for (const name of LOCAL_ONLY) if (keep[name]) upsertLocalEnv(name, keep[name]);
}
