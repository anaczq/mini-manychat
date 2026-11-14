// Aparece na hora do clique enquanto o editor carrega (mesma estrutura do editor).
export function EditorSkeleton() {
  const bar = "animate-pulse rounded-md bg-skeleton";
  return (
    <div className="flex min-h-dvh flex-col bg-canvas md:h-dvh" aria-busy="true" aria-label="Carregando automação">
      <header className="flex h-[60px] items-center gap-3 border-b border-line bg-surface px-5">
        <span className={`${bar} size-9`} />
        <span className={`${bar} h-4 w-48`} />
        <span className="flex-1" />
        <span className={`${bar} h-9 w-36`} />
      </header>
      <div className="flex flex-1">
        <div className="flex w-full flex-col gap-6 border-r border-line bg-surface p-6 md:w-[520px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <span className={`${bar} h-4 w-56`} />
              <span className={`${bar} h-16 w-full`} />
            </div>
          ))}
        </div>
        <div className="hidden flex-1 items-center justify-center md:flex">
          <span className={`${bar} h-[560px] w-[320px] rounded-[36px]`} />
        </div>
      </div>
    </div>
  );
}
