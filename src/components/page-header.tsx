import type { ReactNode } from "react";

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex h-16 items-center gap-2.5 border-b border-line bg-surface px-4 md:px-10">
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold md:text-[22px]">{title}</h1>
      {actions}
    </header>
  );
}
