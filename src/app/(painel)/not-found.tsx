import { NotFoundContent } from "../not-found";

// notFound() dentro do painel (ex.: seção de Configurações que não existe): mantém a sidebar.
export default function PainelNotFound() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-10 md:py-16">
      <NotFoundContent />
    </div>
  );
}
