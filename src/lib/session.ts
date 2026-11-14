import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { type LimitName, limitResponse } from "@/lib/ratelimit";

// Layout e página pedem a sessão na mesma requisição: uma consulta ao banco só.
const getSession = cache(async () => auth().api.getSession({ headers: await headers() }));

/** Sessão validada no servidor. Sem sessão → /login; sem 2FA ativo → /configurar-2fa (PRD RF01). */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.twoFactorEnabled) redirect("/configurar-2fa");
  return session.user;
}

/** Sessão sem exigir 2FA: só para a própria tela de configurar o 2FA. */
export async function requireSessionWithout2fa() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/** Para route handlers (sem redirect): sessão com 2FA + rate limit. Devolve a Response de erro pronta (401 ou 429). */
export async function requireApiUser(limit: LimitName): Promise<{ userId: string } | Response> {
  const session = await getSession();
  if (!session?.user.twoFactorEnabled) return new Response(null, { status: 401 });
  return (await limitResponse(limit, session.user.id)) ?? { userId: session.user.id };
}
