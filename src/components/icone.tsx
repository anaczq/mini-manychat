import clsx from "clsx";
import type { CSSProperties } from "react";

/** Ícones exportados do Figma (public/icones). A cor vem do texto: use text-*. */
export type IconeNome =
  | "inicio"
  | "automacoes"
  | "historico"
  | "analytics"
  | "configuracoes"
  | "instagram"
  | "cadeado"
  | "chevron-baixo"
  | "sair"
  | "lua"
  | "seta-direita"
  | "conversas"
  | "buscar";

export function Icone({ nome, className }: { nome: IconeNome; className?: string }) {
  return <span aria-hidden className={clsx("icone", className)} style={{ "--icone": `url(/icones/${nome}.svg)` } as CSSProperties} />;
}
