import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-surface text-ink border border-border hover:bg-bg",
  ghost: "bg-bg text-primary hover:bg-primary-soft",
  danger: "bg-error text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  icon,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; icon?: ReactNode }) {
  return (
    <button
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonStyles[variant],
        className,
      )}
      {...props}
    >
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
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium", box)}>
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
  return <div className={clsx("rounded-xl border border-line bg-surface", className)} {...props} />;
}

export function KeywordChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-semibold uppercase text-muted">{children}</span>
  );
}

/** Card de número (Analytics): rótulo, valor e variação. Variação "+…" fica verde e "-…" vermelha, salvo `neutral`. */
export function StatCard({ icon, label, value, hint, neutral }: { icon?: ReactNode; label: string; value: string; hint?: string; neutral?: boolean }) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <span className="flex items-center gap-1.5 text-xs text-muted [&>svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="text-xl font-bold md:text-2xl">{value}</span>
      {hint && (
        <span className={clsx("text-xs font-medium", neutral || !/^[+-]/.test(hint) ? "text-muted" : hint.startsWith("-") ? "text-error" : "text-success")}>{hint}</span>
      )}
    </Card>
  );
}
