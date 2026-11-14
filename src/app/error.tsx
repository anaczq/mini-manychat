"use client";

import { ErrorContent } from "@/components/error-content";

// Qualquer outro erro (editor, login, ou o próprio layout do painel ao validar a sessão): tela cheia.
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-[560px]">
        <ErrorContent error={error} retry={retry} />
      </div>
    </main>
  );
}
