import { after } from "next/server";
import { MobileTabBar, Sidebar } from "@/components/sidebar";
import { accountForSidebar, syncAccountProfile } from "@/lib/account";
import { requireUser } from "@/lib/session";

export default async function PainelLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const account = await accountForSidebar(user.id);
  // Foto/@ vêm da Zernio e expiram: atualiza em segundo plano, sem atrasar a página.
  after(() => syncAccountProfile(user.id).catch(() => undefined));
  return (
    <div className="flex min-h-dvh">
      <Sidebar account={account} />
      <main className="min-w-0 flex-1 bg-surface pb-24 md:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
