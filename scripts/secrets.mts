// Gera os segredos aleatórios do app na Vercel, só os que ainda não existem. Nenhum valor é impresso.
// Depois rode `vercel env pull .env.local --yes`.
import { randomBytes } from "node:crypto";
import { ENVIRONMENTS, vercelEnvNames, vercelEnvSet } from "./lib/vercel-env.mts";

const SECRETS = {
  BETTER_AUTH_SECRET: () => randomBytes(32).toString("base64"),
  ZERNIO_WEBHOOK_SECRET: () => randomBytes(32).toString("hex"),
  CRON_SECRET: () => randomBytes(32).toString("hex"),
};

const existing = vercelEnvNames();
for (const [name, make] of Object.entries(SECRETS)) {
  if (existing.has(name)) {
    console.log(`${name}: já existe, mantido`);
    continue;
  }
  const value = make();
  for (const e of ENVIRONMENTS) vercelEnvSet(name, value, e);
  console.log(`${name}: criado (${ENVIRONMENTS.join(", ")})`);
}
