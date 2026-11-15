import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-dark text-white hover:bg-dark/85",
  secondary: "bg-surface text-ink border border-border hover:bg-bg",
  ghost: "bg-transparent text-primary hover:bg-primary-soft",
  danger: "bg-error text-white hover:opacity-90",
};

/** Classes de botão para usar em <Link> ou <a> (um <button> não pode conter link). */
export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return clsx(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-[18px] text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    buttonStyles[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  icon,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; icon?: ReactNode }) {
  return (
    <button className={buttonClass(variant, className)} {...props}>
      {icon}
      {children}
    </button>
  );
}

export type Status = "sucesso" | "alerta" | "erro" | "neutro" | "info";

const badgeStyles: Record<Status, [string, string]> = {
  sucesso: ["bg-success-soft text-success", "bg-success"],
  alerta: ["bg-warning-soft text-warning", "bg-warning"],
  erro: ["bg-error-soft text-error", "bg-error"],
  neutro: ["bg-bg text-muted", "bg-muted"],
  info: ["bg-primary-soft text-primary", "bg-primary"],
};

export function Badge({ status, children }: { status: Status; children: ReactNode }) {
  const [box, dot] = badgeStyles[status];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", box)}>
      <span className={clsx("size-1.5 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function Toggle({ on, label, ...props }: ComponentProps<"button"> & { on: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={clsx("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-border")}
      {...props}
    >
      <span
        className={clsx(
          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-3xl border border-border bg-surface", className)} {...props} />;
}

export function KeywordChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-subtle px-1.5 py-0.5 font-mono text-[11px] uppercase text-muted">{children}</span>
  );
}

/** Card de número (Figma "KPI"): rótulo em Space Mono, valor grande e variação. Variação "+…" fica verde e "-…" vermelha, salvo `neutral`. */
export function StatCard({ icon, label, value, hint, neutral, accent }: { icon?: ReactNode; label: string; value: string; hint?: string; neutral?: boolean; accent?: boolean }) {
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-[18px] md:p-[22px]">
      <span className="eyebrow flex items-center gap-1.5 [&>svg]:size-3.5">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className={clsx("font-display text-[32px] leading-tight font-medium md:text-[44px]", accent && "text-primary")}>{value}</span>
      {hint && (
        <span className={clsx("text-xs", neutral || !/^[+-]/.test(hint) ? "text-muted" : hint.startsWith("-") ? "text-error" : "text-success")}>{hint}</span>
      )}
    </Card>
  );
}

/** Cabeçalho de card: rótulo pequeno, título e um link à direita. */
export function CardTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="font-display text-xl leading-7 font-medium">{title}</h2>
      </div>
      {action && <div className="shrink-0 text-[13px] font-medium text-primary">{action}</div>}
    </div>
  );
}
