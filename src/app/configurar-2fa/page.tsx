import { redirect } from "next/navigation";
import { requireSessionWithout2fa } from "@/lib/session";
import { Setup2fa } from "./setup";

export default async function Configurar2faPage() {
  const user = await requireSessionWithout2fa();
  if (user.twoFactorEnabled) redirect("/");
  return <Setup2fa />;
}
