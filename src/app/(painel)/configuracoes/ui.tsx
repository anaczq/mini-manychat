import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChannelIcon } from "@/components/channel-icon";

export const SECTIONS = {
  geral: "Geral",
  seguranca: "Segurança",
  registros: "Registros",
  instagram: "Instagram",
  limites: "Limites e anti-spam",
  dados: "Dados e retenção",
} as const;

export type Section = keyof typeof SECTIONS;

const GROUPS: [string, Section[]][] = [
  ["Principal", ["geral", "seguranca", "registros"]],
  ["Canais", ["instagram"]],
  ["Automação", ["limites"]],
  ["Dados", ["dados"]],
];

/** Menu de configurações (Figma A6): sem card, item ativo em verde. */
export function SettingsMenu({ active }: { active: Section }) {
  return (
    <nav className="flex gap-2 overflow-x-auto px-4 pt-4 [scrollbar-width:none] md:w-[220px] md:shrink-0 md:flex-col md:gap-[18px] md:overflow-visible md:pl-10 md:pt-7">
      {GROUPS.map(([group, items]) => (
        <div key={group} className="flex gap-2 md:flex-col md:gap-2.5">
          <p className="hidden text-base font-medium md:block">{group}</p>
          {items.map((s) => (
            <Link
              key={s}
              href={`/configuracoes/${s}`}
              className={clsx(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm md:rounded-none md:p-0",
                s === active ? "bg-success-soft font-semibold text-success md:bg-transparent" : "bg-surface text-muted md:bg-transparent",
              )}
            >
              {s === "instagram" && <ChannelIcon size={18} />}
              {SECTIONS[s]}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-md border border-border bg-surface">{children}</div>;
}

/** Linha em 3 colunas: rótulo · ação · explicação (Figma). No celular, empilha. */
export function Line({ label, action, help }: { label: string; action: ReactNode; help?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border px-5 py-4 first:border-t-0 md:flex-row md:items-start md:gap-6 md:px-6 md:py-5">
      <p className="text-[15px] font-medium md:w-[220px] md:shrink-0 md:text-base">{label}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2 md:w-[230px] md:shrink-0">{action}</div>
      {help && <div className="flex-1 text-[13px] text-muted">{help}</div>}
    </div>
  );
}
