// Traz as variáveis da Vercel para o .env.local sem perder o PUBLIC_URL do túnel. Use no lugar de `vercel env pull`.
import { pullEnv } from "./lib/vercel-env.mts";

pullEnv();
console.log(".env.local atualizado com as variáveis da Vercel");
