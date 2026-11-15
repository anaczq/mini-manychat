import { after } from "next/server";
import { MobileTabBar, Sidebar } from "@/components/sidebar";
import { TemaSwitch } from "@/components/tema-switch";
import { accountForSidebar, syncAccountProfile } from "@/lib/account";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function PainelLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [account, settings] = await Promise.all([accountForSidebar(user.id), getSettings(user.id)]);
  // Foto/@ vêm da Zernio e expiram: atualiza em segundo plano, sem atrasar a página.
  after(() => syncAccountProfile(user.id).catch(() => undefined));
  const name = user.name?.trim() || account?.username || user.email;
  return (
    <div className="relative flex min-h-dvh bg-bg">
      {/* Figma mobile: lua no canto superior direito. */}
      <TemaSwitch className="absolute top-[21px] right-4 z-30 md:hidden" />
      <Sidebar user={{ name, role: "Admin" }} active={settings?.automationEnabled ?? true} />
      <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
