"use client";

import clsx from "clsx";
import { Image as ImageIcon, Link2, Plus, Reply } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";

const OPTIONS = [
  { key: "link", icon: Link2, title: "Link por DM a partir de comentários", sub: "Quem comentar a palavra recebe um link no Direct", tone: "text-primary bg-primary-soft", popular: true },
  { key: "arquivo", icon: ImageIcon, title: "Entregar imagem", sub: "A pessoa responde o DM e recebe a imagem como anexo", tone: "text-success bg-success-soft" },
  { key: "resposta", icon: Reply, title: "Só responder o comentário", sub: "Resposta pública aleatória, sem DM", tone: "text-warning bg-warning-soft" },
  { key: "zero", icon: Plus, title: "Começar do zero", sub: "Configure cada passo você mesma", tone: "text-secondary bg-subtle" },
];

// Popup "Nova automação · escolher modelo" (Figma 809:16274 / 809:16520): abre por cima da tela atual.
export function TemplateChooser({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [choice, setChoice] = useState("link");
  const go = (key: string) => router.push(`/automacoes/nova?modelo=${key}`);
  return (
    <Modal
      title="Nova automação"
      subtitle="Escolha um ponto de partida. Dá para mudar tudo depois."
      width={640}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => go(choice)}>
            Continuar
          </Button>
        </>
      }
    >
      {OPTIONS.map(({ key, icon: Icon, title, sub, tone, popular }) => {
        const selected = choice === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => setChoice(key)}
            onDoubleClick={() => go(key)}
            className={clsx(
              "flex items-center gap-3.5 rounded-[10px] text-left transition-colors",
              selected ? "border-2 border-primary bg-primary-soft p-[13px]" : "border border-border p-3.5 hover:bg-bg",
            )}
          >
            <span className={clsx("grid size-10 shrink-0 place-items-center rounded-[10px]", selected ? "bg-surface text-primary" : tone)}>
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start gap-1.5 text-[15px] leading-normal font-semibold sm:items-center">
                <span className="min-w-0 flex-1 sm:flex-none">{title}</span>
                {popular && <span className="mt-1 shrink-0 rounded bg-warning px-1.5 font-mono text-[10px] leading-[15px] text-white sm:mt-0">POPULAR</span>}
              </span>
              <span className="block text-[13px] leading-normal text-muted">{sub}</span>
            </span>
          </button>
        );
      })}
    </Modal>
  );
}

/** Botão "Nova automação" que abre o popup no lugar, sem trocar de página. */
export function NewAutomationButton({ children, defaultOpen = false }: { children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {children}
      </span>
      {open && <TemplateChooser onClose={() => setOpen(false)} />}
    </>
  );
}
