import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonClass, Card } from "@/components/ui";

/** Seções de Configurações (Figma 09a–09f): rótulo da aba, título do card e texto do topo. */
export const SECTIONS = {
  geral: { tab: "Geral", title: "Geral", subtitle: "Ajustes gerais do painel." },
  seguranca: { tab: "Segurança", title: "Segurança", subtitle: "Acesso ao painel, 2FA e sessões abertas." },
  registros: { tab: "Registros", title: "Registros", subtitle: "Tudo o que mudou no painel: logins, pausas e limites." },
  instagram: { tab: "Instagram", title: "Instagram", subtitle: "Conta conectada pela Zernio e o que chega dela." },
  limites: { tab: "Limites", title: "Limites e anti-spam", subtitle: "Freios que protegem sua conta de bloqueio da Meta." },
  dados: { tab: "Dados", title: "Dados e retenção", subtitle: "Retenção, exportação e limpeza do histórico." },
} as const;

export type Section = keyof typeof SECTIONS;

/** Topo: no desktop a trilha "01 · Automação · Configurações"; no celular o nome da seção vira o título. */
export function SettingsHeader({ section }: { section: Section }) {
  return (
    <>
      <div className="hidden md:block">
        <PageHeader eyebrow="01 · Automação · Configurações" title="Configurações" subtitle={SECTIONS[section].subtitle} />
      </div>
      <header className="flex flex-col gap-1.5 px-4 pt-6 md:hidden">
        <p className="mb-3 text-base font-medium">Ajustes</p>
        <p className="eyebrow">01 · Configurações</p>
        <h1 className="font-display text-[28px] leading-tight font-medium">{SECTIONS[section].tab}</h1>
      </header>
    </>
  );
}

/** Abas em pílula (Figma "Abas"): a ativa fica preta. No celular rolam para o lado. */
export function SettingsTabs({ active }: { active: Section }) {
  return (
    <nav aria-label="Seções de configurações" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <ul className="flex w-max gap-1.5">
        {(Object.keys(SECTIONS) as Section[]).map((s) => (
          <li key={s}>
            <Link
              href={`/configuracoes/${s}`}
              aria-current={s === active ? "page" : undefined}
              className={clsx(
                "inline-flex h-[34px] items-center rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                s === active ? "bg-dark text-white" : "text-ink hover:bg-subtle",
              )}
            >
              {SECTIONS[s].tab}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Card de seção (Figma "Card · …"): rótulo em Space Mono, título e linhas separadas por fio. */
export function SettingsCard({ eyebrow, title, children, className }: { eyebrow: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={clsx("flex min-w-0 flex-col p-5 md:p-6", className)}>
      <div className="flex flex-col gap-1 pb-3">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="font-display text-[22px] leading-tight font-medium">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

/** Linha do card: rótulo e explicação à esquerda, ação à direita (Figma "Linha · …"). */
export function Line({ label, help, action, labelFor }: { label: ReactNode; help?: ReactNode; action?: ReactNode; labelFor?: string }) {
  const Label = labelFor ? "label" : "p";
  return (
    <div className="flex items-center gap-4 border-t border-hairline py-3.5 md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <Label htmlFor={labelFor} className="text-sm font-medium">
          {label}
        </Label>
        {help && <div className="text-xs text-muted">{help}</div>}
      </div>
      {action && <div className="flex shrink-0 flex-col items-end gap-1 text-right">{action}</div>}
    </div>
  );
}

/** Valor curto à direita da linha, em Space Mono (ex.: "49 dias", "14/11"). */
export function MonoValue({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs whitespace-nowrap text-ink">{children}</span>;
}

/** Botão de contorno vermelho (Figma "Pill · Sair do painel" / "Apagar"). */
export const dangerOutline = buttonClass("secondary", "border-error/30 text-error hover:bg-error-soft");

export type NooiPose = "pensando" | "orgulhoso" | "agenda" | "acenando" | "moedas" | "regando";

/** Dica do Nooi (Figma "Dica do Nooi"): fundo azul-claro, mascote e uma frase. */
export function NooiTip({ pose, children }: { pose: NooiPose; children: ReactNode }) {
  return (
    <aside className="flex items-center gap-3.5 rounded-3xl bg-primary-soft p-5">
      <Image src={`/marca/nooi-${pose}.png`} alt="" width={56} height={56} className="size-14 shrink-0 object-contain" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="eyebrow text-primary">Dica do Nooi</p>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </aside>
  );
}
