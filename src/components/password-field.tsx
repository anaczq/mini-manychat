"use client";

import clsx from "clsx";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";

/** Campo de senha com o olhinho para mostrar/esconder. */
export function PasswordField({ label, ...props }: { label: string } & Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <span className="relative flex">
        <input
          type={visible ? "text" : "password"}
          className="h-10 w-full rounded-md border border-border bg-surface pl-3 pr-10 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-soft"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded text-muted hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={clsx("flex items-center gap-1.5 text-[13px] font-medium", ok ? "text-success" : "text-muted")}>
      {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      {children}
    </li>
  );
}

/** Senha nova + repetição, com os sinalizadores ao vivo. `onValidChange` diz se pode enviar. */
export function NewPasswordFields({ onValidChange }: { onValidChange: (valid: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && password === confirm;

  function update(p: string, c: string) {
    setPassword(p);
    setConfirm(c);
    onValidChange(p.length >= 8 && p === c);
  }

  return (
    <>
      <PasswordField label="Senha nova" name="newPassword" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => update(e.target.value, confirm)} />
      <PasswordField label="Repita a senha nova" name="confirm" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => update(password, e.target.value)} />
      <ul className="-mt-1 flex flex-col gap-1">
        <Rule ok={longEnough}>Pelo menos 8 caracteres</Rule>
        <Rule ok={matches}>As duas senhas conferem</Rule>
      </ul>
    </>
  );
}
