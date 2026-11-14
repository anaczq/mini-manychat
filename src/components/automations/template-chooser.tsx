"use client";

import clsx from "clsx";
import { Image as ImageIcon, Link2, Plus, Reply } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";

const OPTIONS = [
  { key: "link", icon: Link2, title: "Link por DM a partir de comentários", sub: "Quem comentar a palavra recebe um link no Direct", tone: "text-accent-blue bg-accent-blue-soft", popular: true },
  { key: "arquivo", icon: ImageIcon, title: "Entregar imagem", sub: "A pessoa responde o DM e recebe a imagem como anexo", tone: "text-accent-green bg-accent-green-soft" },
  { key: "resposta", icon: Reply, title: "Só responder o comentário", sub: "Resposta pública aleatória, sem DM", tone: "text-accent-orange bg-accent-orange-soft" },
  { key: "zero", icon: Plus, title: "Começar do zero", sub: "Configure cada passo você mesma", tone: "text-muted bg-subtle" },
];

// Popup M1 do Figma: abre por cima da tela atual.
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
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => go(choice)}>Continuar</Button>
        </>
      }
    >
      {OPTIONS.map(({ key, icon: Icon, title, sub, tone, popular }) => (
        <button
          key={key}
          onClick={() => setChoice(key)}
          onDoubleClick={() => go(key)}
          className={clsx(
            "flex items-center gap-3.5 rounded-[10px] border p-3.5 text-left",
            choice === key ? "border-2 border-primary bg-accent-blue-soft" : "border-line",
          )}
        >
          <span className={clsx("grid size-10 shrink-0 place-items-center rounded-[10px]", tone, choice === key && "!bg-surface")}>
            <Icon className="size-5" />
          </span>
          <span className="flex-1">
            <span className="flex items-center gap-1.5 text-[15px] font-semibold">
              {title}
              {popular && <span className="rounded bg-chip-popular px-1.5 text-[10px] font-bold text-white">POPULAR</span>}
            </span>
            <span className="text-[13px] text-muted">{sub}</span>
          </span>
        </button>
      ))}
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
