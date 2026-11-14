// Copia as variáveis que só existem no seu .env.local (login e Zernio) para a produção da Vercel.
// Os valores não são impressos. Uso: pnpm env:push [APP_URL]
import { config } from "dotenv";
import { vercelEnvSet } from "./lib/vercel-env.mts";

const fromFile = config({ path: ".env.local", processEnv: {} }).parsed ?? {};
const NAMES = ["PAINEL_EMAIL", "ZERNIO_API_KEY", "ZERNIO_ACCOUNT_ID"] as const;

for (const name of NAMES) {
  const value = fromFile[name];
  if (!value) {
    if (name === "ZERNIO_ACCOUNT_ID") continue;
    throw new Error(`${name} não está no .env.local`);
  }
  vercelEnvSet(name, value, "production");
  console.log(`${name}: gravada em production`);
}

const appUrl = process.argv[2];
if (appUrl) {
  if (!appUrl.startsWith("https://")) throw new Error("APP_URL precisa ser https://");
  vercelEnvSet("APP_URL", appUrl.replace(/\/$/, ""), "production");
  console.log(`APP_URL: ${appUrl}`);
}
