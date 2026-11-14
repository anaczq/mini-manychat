"use client";

import Link from "next/link";
import { useState } from "react";
import { resetPasswordAction } from "@/app/actions/senha";
import { AuthScreen, Field, FormError } from "@/components/auth-card";
import { NewPasswordFields } from "@/components/password-field";
import { Button } from "@/components/ui";

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
      <AuthScreen>
        <h1 className="text-xl font-bold">Senha redefinida</h1>
        <p className="text-sm text-muted">Todas as sessões foram encerradas. Entre com a senha nova e o código 2FA.</p>
        <Link href="/login">
          <Button className="h-10 w-full">Ir para o login</Button>
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <h1 className="text-xl font-bold">Esqueci a senha</h1>
      <p className="text-sm text-muted">
        {backup ? "Use um dos seus códigos de backup para provar que é você." : "Use o código do seu app autenticador para provar que é você."}
      </p>
      {error && <FormError>{error}</FormError>}
      <form action={onSubmit} className="flex flex-col gap-4">
        <Field label="E-mail" name="email" type="email" autoComplete="username" required />
        <NewPasswordFields onValidChange={setValid} />
        <Field
          key={backup ? "backup" : "totp"}
          label={backup ? "Código de backup" : "Código 2FA"}
          name="code"
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={backup ? "XXXXX-XXXXX" : "000 000"}
          required
        />
        <Button type="submit" disabled={pending || !valid} className="h-10 w-full">
          {pending ? "Redefinindo…" : "Redefinir senha"}
        </Button>
      </form>
      <div className="flex justify-between text-sm font-medium">
        <button type="button" onClick={() => setBackup((v) => !v)} className="text-primary">
          {backup ? "Usar o app autenticador" : "Usar código de backup"}
        </button>
        <Link href="/login" className="text-muted">
          Voltar ao login
        </Link>
      </div>
    </AuthScreen>
  );
}
