"use client";

import clsx from "clsx";
import { BarChart3, ChevronDown, History, House, LogOut, PanelLeftClose, PanelLeftOpen, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Avatar } from "@/components/avatar";
import { authClient } from "@/lib/auth-client";

const NAV = [
  { href: "/", label: "Início", icon: House },
  { href: "/automacoes", label: "Automações", icon: Zap },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const STORAGE_KEY = "sidebar-expandida";
const CHANGE_EVENT = "sidebar-expandida-change";

// Preferência só deste navegador; se o storage falhar, o menu fica recolhido.
function readExpanded() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

type Account = { username: string; picture: string | null } | null;

function InstagramAvatar({ account, size = 34 }: { account: Account; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#fdda75,#fa7e1e_35%,#d62976_65%,#962fbf)]"
      style={{ width: size, height: size }}
    >
      <Avatar src={account?.picture} name={account?.username ?? "?"} size={size - 4} className="border-2 border-rail" />
    </span>
  );
}

export function Sidebar({ account }: { account: Account }) {
  const pathname = usePathname();
  const router = useRouter();
  const expanded = useSyncExternalStore(subscribe, readExpanded, () => false);

  function toggle() {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <aside
      className={clsx(
        "sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 bg-rail p-3 transition-[width] md:flex",
        expanded ? "w-60" : "w-16 items-center px-2",
      )}
    >
      <div className={clsx("flex items-center gap-2.5 rounded-[10px]", expanded && "bg-rail-item p-2")}>
        <InstagramAvatar account={account} />
        {expanded && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{account?.username ?? "sem conta"}</p>
              <p className="text-[11px] text-rail-icon">Instagram · Pessoal</p>
            </div>
            <ChevronDown className="size-4 text-rail-icon" />
          </>
        )}
      </div>
      {!expanded && <span className="rounded bg-rail-item px-1 text-[7px] font-bold text-white">PESSOAL</span>}
      <div className="my-2 h-px w-full bg-rail-item" />

      <nav className="flex w-full flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={clsx(
                "flex items-center gap-3 rounded-[10px] text-sm font-medium transition-colors",
                expanded ? "h-[42px] px-3" : "size-12 justify-center",
                active ? "bg-rail-item text-white" : "text-rail-icon hover:bg-rail-item/60 hover:text-white",
              )}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.75} />
              {expanded && label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {expanded && (
        <div className="flex w-full items-center gap-2 rounded-[10px] border border-rail-item px-3 py-2.5 text-xs font-medium text-rail-icon">
          <span className="size-2 rounded-full bg-accent-green" />4 automações ligadas
        </div>
      )}
      <div className="my-2 h-px w-full bg-rail-item" />
      <button
        type="button"
        onClick={toggle}
        title={expanded ? "Recolher menu" : "Expandir menu"}
        className={clsx(
          "flex items-center gap-3 rounded-[10px] text-sm font-medium text-rail-icon hover:text-white",
          expanded ? "h-10 w-full px-3" : "size-12 justify-center",
        )}
      >
        {expanded ? <PanelLeftClose className="size-5" strokeWidth={1.75} /> : <PanelLeftOpen className="size-5" strokeWidth={1.75} />}
        {expanded && "Recolher menu"}
      </button>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          router.replace("/login");
        }}
        title="Sair"
        className={clsx(
          "flex items-center gap-3 rounded-[10px] text-sm font-medium text-rail-icon hover:text-white",
          expanded ? "h-10 w-full px-3" : "size-12 justify-center",
        )}
      >
        <LogOut className="size-5" strokeWidth={1.75} />
        {expanded && "Sair"}
      </button>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around bg-rail px-2 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} className={clsx("flex min-w-0 flex-1 flex-col items-center gap-1 text-[10px]", active ? "font-semibold text-white" : "font-medium text-rail-icon")}>
            <Icon className="size-[22px]" strokeWidth={1.75} />
            {label === "Configurações" ? "Ajustes" : label}
          </Link>
        );
      })}
    </nav>
  );
}
