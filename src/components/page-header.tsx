import type { ReactNode } from "react";

/** Topo da página (Figma "Topo"): trilha em Space Mono, título grande, subtítulo e ações à direita. */
export function PageHeader({ title, eyebrow, subtitle, actions }: { title: string; eyebrow?: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-4 px-4 pt-6 md:px-12 md:pt-8">
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display text-[28px] leading-tight font-medium md:text-4xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
