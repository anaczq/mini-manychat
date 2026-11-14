// Aparece na hora do clique em qualquer tela do painel enquanto o servidor monta a página (a sidebar fica).
export default function PainelLoading() {
  const bar = "animate-pulse rounded-md bg-skeleton";
  return (
    <div aria-busy="true" aria-label="Carregando">
      <header className="flex h-16 items-center gap-2.5 border-b border-line bg-surface px-4 md:px-10">
        <span className={`${bar} h-6 w-40`} />
        <span className="flex-1" />
        <span className={`${bar} h-9 w-32`} />
      </header>
      <div className="flex flex-col gap-6 p-4 md:p-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`${bar} h-28`} />
          ))}
        </div>
        <span className={`${bar} h-72 w-full`} />
      </div>
    </div>
  );
}
