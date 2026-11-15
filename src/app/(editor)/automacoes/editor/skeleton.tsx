// Aparece na hora do clique enquanto o editor carrega (mesma estrutura do editor).
export function EditorSkeleton() {
  const bar = "animate-pulse rounded-full bg-skeleton";
  const card = "flex flex-col gap-3.5 rounded-3xl border border-border bg-surface p-[22px]";
  return (
    <div className="flex min-h-dvh flex-col bg-bg" aria-busy="true" aria-label="Carregando automação">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3.5 md:px-8">
        <span className={`${bar} size-8`} />
        <div className="flex flex-col gap-1.5">
          <span className={`${bar} h-5 w-40`} />
          <span className={`${bar} h-3 w-16`} />
        </div>
        <span className="flex-1" />
        <span className={`${bar} h-5 w-9`} />
        <span className={`${bar} hidden h-9 w-36 md:block`} />
      </header>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pt-4 md:px-8 md:pt-7 lg:flex-row lg:items-start lg:gap-5">
        <div className="flex w-full flex-col gap-4 lg:w-[440px] lg:shrink-0 xl:w-[520px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={card}>
              <span className={`${bar} h-6 w-56`} />
              <span className="h-12 w-full animate-pulse rounded-xl bg-skeleton" />
            </div>
          ))}
        </div>
        <div className={`${card} hidden flex-1 items-center lg:flex`}>
          <span className={`${bar} h-6 w-48 self-start`} />
          <span className="h-[420px] w-[320px] max-w-full animate-pulse rounded-[36px] bg-skeleton" />
        </div>
        <div className="hidden w-[316px] shrink-0 flex-col gap-4 xl:flex">
          <span className="h-[200px] animate-pulse rounded-3xl bg-skeleton" />
          <span className="h-[180px] animate-pulse rounded-3xl bg-primary-soft" />
        </div>
      </div>
    </div>
  );
}
