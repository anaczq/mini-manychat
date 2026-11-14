import type { ReactNode } from "react";
import { EmptyIllustration } from "@/components/empty-illustration";

/** Estado vazio padrão: ícone num círculo (ou a ilustração grande), título, texto e ação opcional. */
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-md bg-surface px-6 py-12 text-center shadow-[0_2px_2px_rgba(64,69,73,0.1)]">
      {icon ? <span className="grid size-14 place-items-center rounded-full bg-accent-blue-soft text-accent-blue [&>svg]:size-6">{icon}</span> : <EmptyIllustration />}
      <h2 className="text-xl font-bold">{title}</h2>
      {children && <p className="max-w-[520px] text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}
