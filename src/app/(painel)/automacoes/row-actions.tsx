"use client";

import { Copy, Ellipsis, Pencil, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Field } from "@/components/auth-card";
import { Modal } from "@/components/modal";
import { Button, Toggle } from "@/components/ui";
import { deleteAutomationAction, duplicateAutomationAction, toggleAutomationAction } from "@/app/actions/automacoes";

export function RowToggle({ id, name, active, showLabel = false }: { id: string; name: string; active: boolean; showLabel?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span title={error ?? undefined} className="inline-flex items-center gap-2.5">
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
      {showLabel && (
        <span aria-hidden className="flex items-center gap-2 text-[13px] text-secondary">
          <span className={`size-[7px] rounded-full ${error ? "bg-error" : optimistic ? "bg-success" : "bg-tertiary"}`} />
          {error ? "Erro" : optimistic ? "Ligada" : "Desligada"}
        </span>
      )}
    </span>
  );
}

export function RowMenu({ id, name, active }: { id: string; name: string; active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const item = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-ink hover:bg-bg";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Mais ações de ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-8 place-items-center rounded-full border border-border text-secondary hover:bg-bg"
      >
        <Ellipsis className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute top-10 right-0 z-20 w-52 rounded-2xl border border-border bg-surface p-1.5 shadow-[0_12px_40px_rgba(15,18,20,0.12)]">
            <Link role="menuitem" href={`/automacoes/${id}`} className={item}>
              <Pencil className="size-4 text-muted" /> Editar
            </Link>
            <button
              type="button"
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
              <Copy className="size-4 text-muted" /> Duplicar
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() =>
                start(async () => {
                  await toggleAutomationAction(id, !active);
                  setOpen(false);
                })
              }
            >
              <Zap className="size-4 text-muted" /> {active ? "Desligar" : "Ligar"}
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
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
          <p className="text-sm leading-normal text-muted">
            A automação para de responder na hora e não dá para desfazer. O histórico dos comentários continua guardado por 90 dias.
          </p>
          <form
            className="flex flex-col gap-4"
            action={(form) =>
              start(async () => {
                const r = await deleteAutomationAction(id, String(form.get("confirmacao")));
                if (r.ok) setConfirmDelete(false);
                else setError(r.error);
              })
            }
          >
            <Field label="Digite EXCLUIR para confirmar" name="confirmacao" autoComplete="off" required />
            {error && (
              <p role="alert" className="text-[13px] font-medium text-error">
                {error}
              </p>
            )}
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
