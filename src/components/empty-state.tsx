import type { ReactNode } from "react";
import { EmptyIllustration } from "@/components/empty-illustration";

/**
 * Estado vazio / erro (Figma "13 · 404"): Nooi pensando, rótulo, título, texto e ação opcional.
 * `icon` fica só por compatibilidade: o mascote substitui o ícone em todos os estados vazios.
 */
export function EmptyState({
  eyebrow,
  title,
  children,
  action,
}: {
  /** @deprecated o mascote Nooi aparece no lugar do ícone. */
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-3xl bg-surface px-6 py-10 text-center shadow-[0_2px_1px_rgba(64,69,73,0.1)] md:rounded-[28px] md:py-12">
      <EmptyIllustration />
      <div className="flex flex-col items-center gap-2">
        {eyebrow && <p className="eyebrow text-primary">{eyebrow}</p>}
        <h2 className="font-display text-xl leading-7 font-medium">{title}</h2>
        {children && <p className="max-w-[520px] text-sm leading-5 text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}
