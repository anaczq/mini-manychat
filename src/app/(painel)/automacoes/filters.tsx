"use client";

import clsx from "clsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icone } from "@/components/icone";

type Counts = { all: number; on: number; off: number };

const ESTADOS = [
  { value: "", label: "Todas", dot: null, count: (c: Counts) => c.all },
  { value: "ligadas", label: "Ligadas", dot: "bg-success", count: (c: Counts) => c.on },
  { value: "desligadas", label: "Desligadas", dot: "bg-tertiary", count: (c: Counts) => c.off },
] as const;

function KeywordSelect({ terms, value, onChange, className }: { terms: string[]; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={clsx("relative shrink-0", className)}>
      <span className="sr-only">Filtrar por palavra-chave</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-surface pr-8 pl-3.5 text-[13px] font-medium text-secondary outline-none hover:bg-bg focus:border-primary"
      >
        <option value="">Palavra: todas</option>
        {terms.map((t) => (
          <option key={t} value={t}>
            Palavra: {t}
          </option>
        ))}
      </select>
      <Icone nome="chevron-baixo" className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-secondary" />
    </label>
  );
}

export function AutomationFilters({ terms, counts }: { terms: string[]; counts: Counts }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const estado = params.get("estado") ?? "";
  const palavra = params.get("palavra") ?? "";

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3.5 md:gap-[18px]">
      <div className="order-2 -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:order-1 md:mx-0 md:flex-wrap md:gap-2 md:overflow-visible md:px-0">
        <span className="eyebrow hidden md:inline">Estado</span>
        {ESTADOS.map((e) => {
          const on = estado === e.value;
          return (
            <button
              key={e.value || "todas"}
              type="button"
              aria-pressed={on}
              onClick={() => set("estado", e.value)}
              className={clsx(
                "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap md:h-8 md:text-[13px]",
                on ? "bg-dark text-on-dark" : "border border-border bg-surface text-secondary hover:bg-bg",
              )}
            >
              {e.dot && <span className={clsx("size-[7px] rounded-full", e.dot)} />}
              {e.label}
              <span className={clsx("font-mono text-[10px] md:text-[11px]", on ? "text-on-dark" : "text-muted")}>{e.count(counts)}</span>
            </button>
          );
        })}
        {terms.length > 0 && <KeywordSelect terms={terms} value={palavra} onChange={(v) => set("palavra", v)} className="md:hidden" />}
      </div>

      <div className="order-1 flex items-center gap-2 md:order-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[13px] focus-within:border-primary md:w-[360px] md:flex-none">
          <Icone nome="buscar" className="size-4 shrink-0 text-muted" />
          <input
            type="search"
            defaultValue={params.get("q") ?? ""}
            onChange={(e) => set("q", e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
            placeholder="Pesquisar automações"
            aria-label="Pesquisar automações"
          />
        </label>
        {terms.length > 0 && <KeywordSelect terms={terms} value={palavra} onChange={(v) => set("palavra", v)} className="hidden md:block" />}
      </div>
    </div>
  );
}
