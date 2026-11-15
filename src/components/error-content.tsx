"use client";

import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui";

/** Conteúdo das telas de erro (error.tsx). Em produção o Next esconde a mensagem; o código casa com os logs da Vercel. */
export function ErrorContent({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    console.error(JSON.stringify({ event: "page_error", digest, message: error instanceof Error ? error.message : String(error) }));
  }, [error, digest]);

  return (
    <EmptyState
      eyebrow="Erro"
      title="Algo deu errado"
      action={
        <div className="flex flex-col items-center gap-3">
          <Button onClick={() => retry()} className="px-3.5 text-sm! font-semibold">
            Tentar de novo
          </Button>
          {digest && <span className="font-mono text-[11px] text-muted">Código: {digest}</span>}
        </div>
      }
    >
      Não foi possível carregar esta tela. Pode ser instabilidade do banco ou da Zernio: tente de novo em alguns segundos.
    </EmptyState>
  );
}
