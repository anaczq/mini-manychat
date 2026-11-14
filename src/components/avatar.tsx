"use client";

import clsx from "clsx";
import { useState } from "react";

/** Foto de perfil do Instagram com a inicial como reserva (as URLs do Instagram expiram). */
export function Avatar({ src, name, size = 32, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa do Instagram, sem otimização
      <img src={src} alt="" style={style} referrerPolicy="no-referrer" onError={() => setFailed(true)} className={clsx("shrink-0 rounded-full object-cover", className)} />
    );
  }
  return (
    <span style={{ ...style, fontSize: size * 0.4 }} className={clsx("grid shrink-0 place-items-center rounded-full bg-[#d1d9e6] font-bold text-[#4a5568]", className)}>
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
