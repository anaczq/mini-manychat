"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthScreen, Field, FormError } from "@/components/auth-card";
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
    <AuthScreen>
      <h1 className="text-xl font-bold">Entrar no painel</h1>
      {error && <FormError>{error}</FormError>}
      <form action={onSubmit} className="flex flex-col gap-4">
        <Field label="E-mail" name="email" type="email" autoComplete="username" required />
        <PasswordField label="Senha" name="password" autoComplete="current-password" required minLength={8} />
        <Button type="submit" disabled={pending} className="h-10 w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <Link href="/login/esqueci" className="self-center text-sm font-medium text-primary">
        Esqueci a senha
      </Link>
    </AuthScreen>
  );
}
