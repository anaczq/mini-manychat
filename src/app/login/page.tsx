"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthScreen, authButton, Field, FormError } from "@/components/auth-card";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    if (pending) return;
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setPending(false);
      return setError(authErrorMessage(error));
    }
    // Com 2FA ativo, o plugin redireciona sozinho para /login/2fa.
    if (data && !("twoFactorRedirect" in data && data.twoFactorRedirect)) router.replace("/");
  }

  return (
    <AuthScreen eyebrow="01 · Acesso" title="Entrar no painel" subtitle="Use o e-mail e a senha da sua conta. O código 2FA vem em seguida.">
      {error && <FormError>{error}</FormError>}
      <form action={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Field label="E-mail" name="email" type="email" autoComplete="username" placeholder="voce@email.com" required />
          <PasswordField label="Senha" name="password" autoComplete="current-password" placeholder="Sua senha" required minLength={8} />
        </div>
        <div className="flex flex-col items-center gap-3.5">
          <Button type="submit" disabled={pending} className={authButton}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
          <Link href="/login/esqueci" className="text-sm font-medium text-primary">
            Esqueci a senha
          </Link>
        </div>
      </form>
    </AuthScreen>
  );
}
