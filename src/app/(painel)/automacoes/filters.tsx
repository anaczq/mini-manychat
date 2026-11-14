"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const selectClass = "h-9 shrink-0 rounded-md md:flex-1 border border-border bg-surface px-3 text-sm text-muted outline-none focus:border-primary";

export function AutomationFilters({ terms }: { terms: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <label className="flex h-9 shrink-0 items-center gap-2 rounded-md md:flex-1 border border-border bg-surface px-3 text-sm focus-within:border-primary">
        <Search className="size-4 text-muted" />
        <input
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => set("q", e.target.value)}
          className="flex-1 bg-transparent outline-none placeholder:text-muted"
          placeholder="Pesquisar todas as automações"
          aria-label="Pesquisar automações"
        />
      </label>
      <select aria-label="Filtrar por palavra-chave" className={selectClass} value={params.get("palavra") ?? ""} onChange={(e) => set("palavra", e.target.value)}>
        <option value="">Qualquer palavra-chave</option>
        {terms.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select aria-label="Filtrar por estado" className={selectClass} value={params.get("estado") ?? ""} onChange={(e) => set("estado", e.target.value)}>
        <option value="">Ligadas e desligadas</option>
        <option value="ligadas">Só ligadas</option>
        <option value="desligadas">Só desligadas</option>
      </select>
    </div>
  );
}
