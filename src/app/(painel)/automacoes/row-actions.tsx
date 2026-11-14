"use client";

import { Copy, Ellipsis, Pencil, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Field } from "@/components/auth-card";
import { Modal } from "@/components/modal";
import { Button, Toggle } from "@/components/ui";
import { deleteAutomationAction, duplicateAutomationAction, toggleAutomationAction } from "@/app/actions/automacoes";

export function RowToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span title={error ?? undefined}>
      <Toggle
        on={optimistic}
        label={`${optimistic ? "Desligar" : "Ligar"} ${name}`}
        onClick={() =>
          start(async () => {
            setOptimistic(!optimistic);
            const r = await toggleAutomationAction(id, !optimistic);
            setError(r.ok ? null : r.error);
          })
        }
      />
    </span>
  );
}

export function RowMenu({ id, name, active }: { id: string; name: string; active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const item = "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-bg";

  return (
    <div className="relative">
      <button aria-label={`Mais ações de ${name}`} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded p-1 text-muted hover:bg-bg">
        <Ellipsis className="size-[18px]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-8 z-20 w-56 rounded-lg border border-line bg-surface py-1.5 shadow-[0_8px_16px_rgba(132,146,166,0.24)]">
            <Link role="menuitem" href={`/automacoes/${id}`} className={item}>
              <Pencil className="size-4" /> Editar
            </Link>
            <button
              role="menuitem"
              className={item}
              onClick={() =>
                start(async () => {
                  const r = await duplicateAutomationAction(id);
                  setOpen(false);
                  if (r.ok) router.push(`/automacoes/${r.data.id}`);
                })
              }
            >
              <Copy className="size-4" /> Duplicar
            </button>
            <button
              role="menuitem"
              className={item}
              onClick={() =>
                start(async () => {
                  await toggleAutomationAction(id, !active);
                  setOpen(false);
                })
              }
            >
              <Zap className="size-4" /> {active ? "Desligar" : "Ligar"}
            </button>
            <div className="my-1 h-px bg-line" />
            <button
              role="menuitem"
              className={`${item} text-error`}
              onClick={() => {
                setOpen(false);
                setConfirmDelete(true);
              }}
            >
              <Trash2 className="size-4" /> Excluir
            </button>
          </div>
        </>
      )}
      {confirmDelete && (
        <Modal title={`Excluir “${name}”?`} onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-muted">
            A automação para de responder na hora e não dá para desfazer. O histórico dos comentários continua guardado por 90 dias.
          </p>
          <form
            className="flex flex-col gap-3"
            action={(form) =>
              start(async () => {
                const r = await deleteAutomationAction(id, String(form.get("confirmacao")));
                if (r.ok) setConfirmDelete(false);
                else setError(r.error);
              })
            }
          >
            <Field label="Digite EXCLUIR para confirmar" name="confirmacao" autoComplete="off" required />
            {error && <p className="text-[13px] font-medium text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger" disabled={pending}>
                Excluir
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
