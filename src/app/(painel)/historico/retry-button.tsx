"use client";

import { History } from "lucide-react";
import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { retryEventAction } from "@/app/actions/historico";

export function RetryButton({ id, enabled, reason }: { id: string; enabled: boolean; reason: string | null }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!enabled && !reason) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="secondary" icon={<History className="size-4" />} disabled={!enabled} onClick={() => setOpen(true)} className="self-start">
        Reprocessar
      </Button>
      {reason && <p className="text-xs text-muted">{reason}</p>}
      {msg && <p className="text-xs font-medium">{msg}</p>}
      {open && (
        <Modal
          title="Reenviar este evento?"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await retryEventAction(id);
                    setOpen(false);
                    setMsg(r.ok ? "Reenviando… atualize em alguns segundos." : r.error);
                  })
                }
              >
                Reenviar
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">O DM e a resposta pública serão tentados de novo. Só funciona até 7 dias depois do comentário.</p>
          <p className="rounded-2xl bg-primary-soft px-3.5 py-3 text-[13px] font-medium">Nunca envia DM duplicado: se o primeiro já tiver chegado, nada acontece.</p>
        </Modal>
      )}
    </div>
  );
}
