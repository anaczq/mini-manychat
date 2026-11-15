"use client";

import Link from "next/link";
import { useState } from "react";
import { resetPasswordAction } from "@/app/actions/senha";
import { AuthScreen, authButton, Field, FormError } from "@/components/auth-card";
import { NewPasswordFields } from "@/components/password-field";
import { Button, buttonClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [valid, setValid] = useState(false);

  async function onSubmit(form: FormData) {
    if (pending) return;
    setPending(true);
    setError(null);
    const r = await resetPasswordAction(form);
    setPending(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
  }

  if (done) {
    return (
      <AuthScreen
        painel="recuperar"
        eyebrow="02 · Recuperar acesso"
        title="Senha redefinida"
        subtitle="Todas as sessões foram encerradas. Entre com a senha nova e o código 2FA."
      >
        <Link href="/login" className={buttonClass("primary", authButton)}>
          Ir para o login
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      painel="recuperar"
      eyebrow="02 · Recuperar acesso"
      title="Esqueci a senha"
      subtitle={backup ? "Use um dos seus códigos de backup para provar que é você." : "Use o código do seu app autenticador para provar que é você."}
    >
      {error && <FormError>{error}</FormError>}
      <form action={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Field label="E-mail" name="email" type="email" autoComplete="username" placeholder="voce@email.com" required />
          <NewPasswordFields onValidChange={setValid} />
          <Field
            key={backup ? "backup" : "totp"}
            label={backup ? "Código de backup" : "Código 2FA"}
            name="code"
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            placeholder={backup ? "XXXXX-XXXXX" : "000 000"}
            className="font-mono text-[13px]!"
            required
          />
        </div>
        <div className="flex flex-col gap-3.5">
          <Button type="submit" disabled={pending || !valid} className={authButton}>
            {pending ? "Redefinindo…" : "Redefinir senha"}
          </Button>
          <div className="flex justify-between gap-3 text-sm font-medium">
            <button type="button" onClick={() => setBackup((v) => !v)} className="text-primary">
              {backup ? "Usar o app autenticador" : "Usar código de backup"}
            </button>
            <Link href="/login" className="text-muted hover:text-ink">
              Voltar ao login
            </Link>
          </div>
        </div>
      </form>
    </AuthScreen>
  );
}
