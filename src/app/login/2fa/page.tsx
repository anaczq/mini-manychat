"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthScreen, authButton, Field, FormError } from "@/components/auth-card";
import { Button } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export default function TwoFactorPage() {
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    if (pending) return;
    setPending(true);
    setError(null);
    const code = String(form.get("code")).replace(/\s/g, "");
    const { error } = backup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });
    // No sucesso o botão fica travado até a navegação: um segundo envio usaria o cookie do 2FA já
    // consumido e mostraria erro mesmo com o login feito.
    if (error) {
      setPending(false);
      return setError(authErrorMessage(error));
    }
    router.replace("/");
  }

  return (
    <AuthScreen
      eyebrow="01 · Acesso · 2FA"
      title="Verificação em duas etapas"
      subtitle={backup ? "Digite um dos seus códigos de backup." : "Digite o código de 6 dígitos do seu app autenticador."}
    >
      {error && <FormError>{error}</FormError>}
      <form action={onSubmit} className="flex flex-col gap-6">
        <Field
          key={backup ? "backup" : "totp"}
          label={backup ? "Código de backup" : "Código"}
          name="code"
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={backup ? "XXXX-XXXX" : "000 000"}
          className="font-mono text-[13px]!"
          required
          autoFocus
        />
        <div className="flex flex-col gap-3.5">
          <Button type="submit" disabled={pending} className={authButton}>
            {pending ? "Verificando…" : "Verificar"}
          </Button>
          <button type="button" onClick={() => setBackup((v) => !v)} className="self-center text-sm font-medium text-primary">
            {backup ? "Usar o app autenticador" : "Usar código de backup"}
          </button>
        </div>
      </form>
    </AuthScreen>
  );
}
