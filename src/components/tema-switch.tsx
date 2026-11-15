"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";
import { Icone } from "@/components/icone";

/** Tema efetivo: o escolhido (atributo data-theme, vindo do cookie) ou o do sistema. */
function escuroAgora() {
  const escolhido = document.documentElement.dataset.theme;
  return escolhido ? escolhido === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

function assinar(avisar: () => void) {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const obs = new MutationObserver(avisar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq.addEventListener("change", avisar);
  return () => {
    obs.disconnect();
    mq.removeEventListener("change", avisar);
  };
}

/** Figma "Tema · lua": alterna claro/escuro e guarda a escolha num cookie lido pelo layout raiz. */
export function TemaSwitch({ className }: { className?: string }) {
  const escuro = useSyncExternalStore(assinar, escuroAgora, () => false);
  return (
    <button
      type="button"
      aria-pressed={escuro}
      aria-label={escuro ? "Usar modo claro" : "Usar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      onClick={() => {
        const tema = escuro ? "light" : "dark";
        document.documentElement.dataset.theme = tema;
        document.cookie = `tema=${tema}; path=/; max-age=31536000; samesite=lax`;
      }}
      className={clsx("grid size-[22px] place-items-center transition-colors", escuro ? "text-primary" : "text-ink opacity-60 hover:opacity-100", className)}
    >
      <Icone nome="lua" className="size-[22px]" />
    </button>
  );
}
