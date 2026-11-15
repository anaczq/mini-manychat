"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icone, type IconeNome } from "@/components/icone";
import { authClient } from "@/lib/auth-client";

type NavItem = { href: string; label: string; icon: IconeNome };

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "01 · Automação",
    items: [
      { href: "/", label: "Início", icon: "inicio" },
      { href: "/automacoes", label: "Automações", icon: "automacoes" },
      { href: "/historico", label: "Histórico", icon: "historico" },
      { href: "/analytics", label: "Analytics", icon: "analytics" },
      { href: "/configuracoes", label: "Configurações", icon: "configuracoes" },
    ],
  },
  {
    title: "02 · Conta",
    items: [
      { href: "/configuracoes/instagram", label: "Instagram", icon: "instagram" },
      { href: "/configuracoes/seguranca", label: "Segurança", icon: "cadeado" },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

/** Item ativo = o href mais específico que casa com a rota (Instagram vence Configurações). */
function activeHref(pathname: string) {
  const matches = ALL.filter(({ href }) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export type SidebarUser = { name: string; role: string };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?";
}

function NooiAvatar({ size = 32 }: { size?: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full bg-subtle" style={{ width: size, height: size }}>
      <Image src="/marca/nooi.png" alt="" fill sizes={`${size}px`} className="object-contain" />
    </span>
  );
}

export function Sidebar({ user, active }: { user: SidebarUser; active: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = activeHref(pathname);
  const currentGroup = GROUPS.findIndex((g) => g.items.some((i) => i.href === current));
  // Sanfona: só um grupo aberto por vez; abre o da página atual.
  const [open, setOpen] = useState(Math.max(currentGroup, 0));
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (currentGroup >= 0) setOpen(currentGroup);
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-6 border-r border-hairline bg-bg px-4 pt-6 pb-4 md:flex">
      <Link href="/" className="flex shrink-0 items-center pl-3" aria-label="Início">
        <Image src="/marca/logo-toh.png" alt="The Outsider Hub" width={149} height={32} priority className="h-8 w-auto" />
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {GROUPS.map((group, gi) => (
          <div key={group.title} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setOpen(open === gi ? -1 : gi)}
              aria-expanded={open === gi}
              className="flex items-center justify-between px-3 py-2 font-mono text-xs leading-4 tracking-[0.08em] text-tertiary uppercase"
            >
              {group.title}
              <Icone nome="chevron-baixo" className={clsx("size-6 text-muted transition-transform", open === gi && "rotate-180")} />
            </button>
            {open === gi &&
              group.items.map(({ href, label, icon }) => {
                const isActive = href === current;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={clsx(
                      "flex h-10 items-center gap-2.5 rounded-full border pr-3 pl-4 font-mono text-xs leading-4 uppercase transition-colors",
                      isActive ? "border-hairline bg-surface text-ink" : "border-transparent text-muted hover:bg-surface/60 hover:text-ink",
                    )}
                  >
                    {isActive && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    <Icone nome={icon} className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-hairline bg-surface p-3">
        <NooiAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-base leading-6 font-medium">Nooi</p>
          <p className="text-xs leading-5 text-muted">{active ? "Respondendo" : "Pausado"}</p>
        </div>
        <span className={clsx("size-2 shrink-0 rounded-full", active ? "bg-success" : "bg-tertiary")} />
      </div>

      <div className="flex shrink-0 items-center gap-3 px-3 py-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-dark text-xs leading-4 font-medium text-white">{initials(user.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base leading-6 font-medium">{user.name}</p>
          <p className="text-xs leading-5 text-muted">{user.role}</p>
        </div>
        <button
          type="button"
          title="Sair"
          aria-label="Sair"
          onClick={async () => {
            await authClient.signOut();
            router.replace("/login");
          }}
          className="text-ink opacity-60 hover:opacity-100"
        >
          <Icone nome="sair" className="size-5" />
        </button>
      </div>
    </aside>
  );
}

const TABS: NavItem[] = GROUPS[0].items;

export function MobileTabBar() {
  const pathname = usePathname();
  const current = activeHref(pathname);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-hairline bg-surface px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      {TABS.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          aria-current={href === current ? "page" : undefined}
          className={clsx("grid flex-1 place-items-center py-1", href === current ? "text-primary" : "text-muted")}
        >
          <Icone nome={icon} className="size-6" />
        </Link>
      ))}
    </nav>
  );
}
