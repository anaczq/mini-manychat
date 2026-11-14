import { requireUser } from "@/lib/session";

export default async function EditorLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return children;
}
