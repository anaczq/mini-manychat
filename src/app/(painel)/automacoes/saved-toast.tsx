"use client";

import { Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const MESSAGES: Record<string, string> = {
  publicada: "Automação publicada. Já está respondendo comentários.",
  desligada: "Automação salva (desligada).",
};

// Confirmação depois de salvar no editor (Figma E8). Some sozinha e limpa a URL.
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
    <div role="status" className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-[10px] bg-dark px-4 py-3 text-sm text-white md:bottom-8">
      <span className="grid size-5 place-items-center rounded-full bg-accent-green">
        <Check className="size-3" strokeWidth={3} />
      </span>
      {message}
    </div>
  );
}
