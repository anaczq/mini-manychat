"use client";

import clsx from "clsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icone } from "@/components/icone";
import { int } from "@/lib/format";

type Counts = { all: number; enviado: number; lido: number; fila: number; erro: number; ignorado: number };

const STATUS = [
  ["enviado", "Enviado", "bg-success"],
  ["lido", "Lido", "bg-primary"],
  ["fila", "Na fila", "bg-warning"],
  ["erro", "Erro", "bg-error"],
  ["ignorado", "Ignorado", "bg-tertiary"],
] as const;

const PERIODS = [
  ["hoje", "Hoje"],
  ["", "7 dias"],
  ["30d", "30 dias"],
  ["90d", "90 dias"],
] as const;

function Chip({ active, onClick, dot, label, count }: { active: boolean; onClick: () => void; dot?: string; label: string; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        active ? "bg-dark text-on-dark" : "border border-border bg-surface text-secondary hover:bg-bg",
      )}
    >
      {dot && <span className={clsx("size-[7px] rounded-full", dot)} />}
      {label}
      {count !== undefined && <span className={clsx("font-mono text-[11px]", active ? "text-on-dark/80" : "text-muted")}>{int(count)}</span>}
    </button>
  );
}

export function HistoryFiltersBar({ keywords, counts, csvHref }: { keywords: { id: string; name: string }[]; counts: Counts; csvHref: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const periodo = params.get("periodo") ?? "";

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    next.delete("evento");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 md:gap-[18px]">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Filtrar por status do DM">
        <span className="eyebrow hidden md:inline">DM</span>
        <Chip active={!status} onClick={() => set("status", "")} label="Todos" count={counts.all} />
        {STATUS.map(([v, l, dot]) => (
          <Chip key={v} active={status === v} onClick={() => set("status", v)} dot={dot} label={l} count={counts[v]} />
        ))}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
        <span className="eyebrow shrink-0">Período</span>
        {PERIODS.map(([v, l]) => (
          <Chip key={v} active={periodo === v} onClick={() => set("periodo", v)} label={l} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            aria-label="Filtrar por automação"
            className="h-9 max-w-[220px] appearance-none truncate rounded-full border border-border bg-surface pr-8 pl-3.5 text-[13px] font-medium text-secondary outline-none focus:border-primary"
            value={params.get("palavra") ?? ""}
            onChange={(e) => set("palavra", e.target.value)}
          >
            <option value="">Automação: todas</option>
            {keywords.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <Icone nome="chevron-baixo" className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-secondary" />
        </div>
        <a href={csvHref} className="ml-auto text-[13px] text-secondary hover:text-ink">
          Exportar CSV
        </a>
      </div>
    </div>
  );
}
