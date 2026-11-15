"use client";

import { Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const MESSAGES: Record<string, string> = {
  publicada: "Automação publicada. Já está respondendo comentários.",
  desligada: "Automação salva (desligada).",
};

// Confirmação depois de salvar no editor (Figma 809:21002). Some sozinha e limpa a URL.
export function SavedToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const message = MESSAGES[params.get("salva") ?? ""];

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      next.delete("salva");
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    }, 4000);
    return () => clearTimeout(t);
  }, [message, params, pathname, router]);

  if (!message) return null;
  return (
    <div role="status" className="fixed bottom-24 left-1/2 z-50 flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2.5 rounded-full bg-dark py-2.5 pr-5 pl-3 text-[13px] text-on-dark shadow-[0_12px_40px_rgba(15,18,20,0.12)] md:bottom-8">
      <span className="grid size-5 place-items-center shrink-0 rounded-full bg-success">
        <Check className="size-3" strokeWidth={3} />
      </span>
      {message}
    </div>
  );
}
