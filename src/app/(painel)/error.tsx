"use client";

import { ErrorContent } from "@/components/error-content";

// Erro numa tela do painel: mantém a sidebar para dar para ir a outra tela.
export default function PainelError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-10 md:py-16">
      <ErrorContent error={error} retry={retry} />
    </div>
  );
}
