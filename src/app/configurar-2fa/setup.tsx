"use client";

import clsx from "clsx";
import { Check, Copy, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { AuthScreen, Field, FormError } from "@/components/auth-card";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

type Step = "senha" | "escanear" | "codigos";

function Steps({ current }: { current: Step }) {
  const steps: [Step, string][] = [
    ["escanear", "Escanear"],
    ["senha", "Confirmar"],
    ["codigos", "Guardar códigos"],
  ];
  const order: Step[] = ["senha", "escanear", "codigos"];
  return (
    <ol className="flex items-center gap-2 text-[13px]">
      {steps.map(([key, label], i) => {
        const active = order.indexOf(current) >= i;
        return (
          <li key={key} className="flex items-center gap-1.5">
            <span className={clsx("grid size-5 place-items-center rounded-full text-[11px] font-bold", active ? "bg-primary text-white" : "bg-subtle text-muted")}>
              {i + 1}
            </span>
            <span className={active ? "font-semibold" : "text-muted"}>{label}</span>
            {i < 2 && <span className="mx-1 h-px w-4 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Setup2fa() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("senha");
  const [qr, setQr] = useState<string>();
  const [secret, setSecret] = useState<string>();
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(form: FormData) {
    setPending(true);
    setError(null);
    const { data, error } = await authClient.twoFactor.enable({ password: String(form.get("password")) });
    setPending(false);
    if (error || !data) return setError(authErrorMessage(error));
    if (data.method !== "totp") return setError("Resposta inesperada ao ativar o 2FA. Tente de novo.");
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 296 }));
    setSecret(new URL(data.totpURI).searchParams.get("secret") ?? undefined);
    setCodes(data.backupCodes);
    setStep("escanear");
  }

  async function confirm(form: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: String(form.get("code")).replace(/\s/g, "") });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setStep("codigos");
  }

  function download() {
    const blob = new Blob([`Códigos de backup · Mini Manychat\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mini-manychat-codigos-backup.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <AuthScreen>
      <Steps current={step} />
      {error && <FormError>{error}</FormError>}

      {step === "senha" && (
        <>
          <h1 className="text-xl font-bold">Ative a verificação em duas etapas</h1>
          <p className="text-sm text-muted">Obrigatório para acessar o painel. Confirme sua senha para gerar o QR code.</p>
          <form action={start} className="flex flex-col gap-4">
            <PasswordField label="Senha" name="password" autoComplete="current-password" required />
            <Button type="submit" disabled={pending} className="h-10 w-full">
              {pending ? "Gerando…" : "Continuar"}
            </Button>
          </form>
        </>
      )}

      {step === "escanear" && (
        <>
          <h1 className="text-xl font-bold">Escaneie o QR code</h1>
          <p className="text-sm text-muted">Use o Google Authenticator, 1Password ou similar.</p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {qr && <img src={qr} alt="QR code para o app autenticador" className="size-[148px] rounded-md border border-border" />}
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-semibold">Não consegue escanear?</p>
              <p className="text-xs text-muted">Digite esta chave no app:</p>
              <button
                type="button"
                onClick={() => secret && navigator.clipboard.writeText(secret)}
                className="flex items-center gap-1.5 break-all rounded-md bg-subtle px-2 py-1.5 text-left font-mono text-xs font-semibold"
              >
                {secret} <Copy className="size-3.5 shrink-0 text-muted" />
              </button>
            </div>
          </div>
          <form action={confirm} className="flex flex-col gap-4">
            <Field label="Código de 6 dígitos do app" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000 000" required />
            <Button type="submit" disabled={pending} className="h-10 w-full">
              {pending ? "Verificando…" : "Confirmar e continuar"}
            </Button>
          </form>
        </>
      )}

      {step === "codigos" && (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <Check className="size-4" /> 2FA ativado
          </p>
          <h1 className="text-xl font-bold">Guarde seus códigos de backup</h1>
          <p className="text-sm text-muted">Se perder o celular, cada código entra uma única vez. Eles não serão mostrados de novo.</p>
          <ul className="grid grid-cols-2 gap-2 rounded-md bg-subtle p-4 font-mono text-sm font-semibold">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Copy className="size-4" />} onClick={() => navigator.clipboard.writeText(codes.join("\n"))}>
              Copiar
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={download}>
              Baixar .txt
            </Button>
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-primary" />
            Guardei os códigos em um lugar seguro
          </label>
          <Button disabled={!saved} className="h-10 w-full" onClick={() => router.replace("/")}>
            Ir para o painel
          </Button>
        </>
      )}
    </AuthScreen>
  );
}
