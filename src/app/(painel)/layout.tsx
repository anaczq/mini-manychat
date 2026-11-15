import { after } from "next/server";
import { MobileTabBar, Sidebar } from "@/components/sidebar";
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
    <div className="flex min-h-dvh bg-bg">
      <Sidebar user={{ name, role: "Admin" }} active={settings?.automationEnabled ?? true} />
      <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
