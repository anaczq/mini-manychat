"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const select = "h-9 rounded-md border border-border bg-surface px-3 text-[13px] font-medium outline-none focus:border-primary";

const STATUS = [
  ["", "Status: todos"],
  ["enviado", "Enviado"],
  ["lido", "Lido"],
  ["fila", "Na fila"],
  ["erro", "Erro"],
  ["ignorado", "Ignorado"],
] as const;

const PERIODS = [
  ["hoje", "Hoje"],
  ["", "Últimos 7 dias"],
  ["30d", "Últimos 30 dias"],
  ["90d", "Últimos 90 dias"],
] as const;

export function HistoryFiltersBar({ keywords, total }: { keywords: { id: string; name: string }[]; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    next.delete("evento");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Filtrar por status" className={select} value={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
        {STATUS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <select aria-label="Filtrar por automação" className={select} value={params.get("palavra") ?? ""} onChange={(e) => set("palavra", e.target.value)}>
        <option value="">Palavra: todas</option>
        {keywords.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
      <select aria-label="Período" className={select} value={params.get("periodo") ?? ""} onChange={(e) => set("periodo", e.target.value)}>
        {PERIODS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <span className="ml-auto text-[13px] text-muted">
        {total} {total === 1 ? "evento" : "eventos"}
      </span>
    </div>
  );
}
