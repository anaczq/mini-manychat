"use client";

import clsx from "clsx";
import { useState, useTransition } from "react";
import { refreshAnalyticsAction } from "@/app/actions/analytics";
import { buttonClass } from "@/components/ui";

/** "Atualizar dados" do topo (pílula preta) ou "Atualizar agora" do rodapé (link). */
export function RefreshButton({ days, variant = "link" }: { days: number; variant?: "button" | "link" }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isButton = variant === "button";
  return (
    <span className={clsx("flex items-center gap-2", isButton && "flex-row-reverse")}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshAnalyticsAction(days);
            setMsg(r.ok ? "Atualizado." : r.error);
          })
        }
        className={isButton ? buttonClass("primary") : "uppercase text-primary hover:text-primary-hover disabled:opacity-50"}
      >
        {pending ? "Atualizando…" : isButton ? "Atualizar dados" : "Atualizar agora"}
      </button>
      {msg && <span className={clsx("text-xs", isButton ? "text-muted" : "normal-case")} role="status">{msg}</span>}
    </span>
  );
}
