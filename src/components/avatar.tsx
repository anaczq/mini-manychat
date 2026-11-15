"use client";

import clsx from "clsx";
import { useState } from "react";

/** Foto de perfil do Instagram com a inicial como reserva (as URLs do Instagram expiram). `square` = quadrado arredondado (Figma: listas do Histórico). */
export function Avatar({ src, name, size = 32, square, className }: { src?: string | null; name: string; size?: number; square?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  const shape = square ? "rounded-xl" : "rounded-full";
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa do Instagram, sem otimização
      <img src={src} alt="" style={style} referrerPolicy="no-referrer" onError={() => setFailed(true)} className={clsx("shrink-0 object-cover", shape, className)} />
    );
  }
  return (
    <span style={{ ...style, fontSize: Math.max(12, size * 0.34) }} className={clsx("grid shrink-0 place-items-center bg-subtle font-semibold text-secondary", shape, className)}>
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
