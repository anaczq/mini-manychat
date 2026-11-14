import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui";

// URL que não existe (fora do painel): tela cheia, sem sidebar.
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-[560px]">
        <NotFoundContent />
      </div>
    </main>
  );
}

export function NotFoundContent() {
  return (
    <EmptyState
      title="Página não encontrada"
      action={
        <Link href="/">
          <Button>Voltar ao início</Button>
        </Link>
      }
    >
      O endereço não existe ou o item foi excluído.
    </EmptyState>
  );
}
