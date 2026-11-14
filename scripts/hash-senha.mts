// Gera o hash scrypt da senha inicial do painel e grava em SENHA_PAINEL no .env.local (o `pnpm db:seed` copia para o banco).
// A senha não é exibida nem salva. Para trocar depois: Configurações › Segurança ou `pnpm trocar-senha`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { readHidden } from "./lib/read-hidden.mts";

const ENV_FILE = ".env.local";

const first = await readHidden("Senha do painel (mín. 8 caracteres): ");
if (first.length < 8) {
  console.error("Senha curta demais: use pelo menos 8 caracteres.");
  process.exit(1);
}
const second = await readHidden("Repita a senha: ");
if (first !== second) {
  console.error("As senhas não conferem.");
  process.exit(1);
}

const line = `SENHA_PAINEL=${await hashPassword(first)}`;
const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const next = /^SENHA_PAINEL=.*$/m.test(current)
  ? current.replace(/^SENHA_PAINEL=.*$/m, line)
  : `${current}${current.endsWith("\n") || current === "" ? "" : "\n"}${line}\n`;
writeFileSync(ENV_FILE, next, { mode: 0o600 });

console.log(`\nPronto: o hash foi gravado em SENHA_PAINEL no ${ENV_FILE}. Rode pnpm db:seed para levar a senha ao banco.`);
