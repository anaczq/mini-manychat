import { ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";

export function AuthScreen({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-full bg-ink">
          <Zap className="size-[18px] text-white" />
        </span>
        <span className="text-lg font-bold">Mini Manychat</span>
      </div>
      <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-md bg-surface p-6 shadow-[0_2px_2px_rgba(64,69,73,0.1)] sm:p-8">
        {children}
      </div>
      {footer && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="size-3.5" /> Acesso restrito · 2FA obrigatório
        </p>
      )}
    </main>
  );
}

export function Field({ label, ...props }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <input
        className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-soft"
        {...props}
      />
    </label>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-warning bg-warning-soft px-3 py-2.5 text-[13px] font-medium text-warning">
      {children}
    </p>
  );
}
