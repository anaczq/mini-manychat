"use client";

import { useState, useTransition } from "react";
import { refreshAnalyticsAction } from "@/app/actions/analytics";

export function RefreshButton({ days }: { days: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshAnalyticsAction(days);
            setMsg(r.ok ? "Atualizado." : r.error);
          })
        }
        className="text-xs font-medium text-primary disabled:opacity-50"
      >
        {pending ? "Atualizando…" : "Atualizar agora"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
