import { notFound } from "next/navigation";
import { z } from "zod";
import { getAsset } from "@/lib/assets";
import { automationWeekStats, getAutomation } from "@/lib/automations";
import { env } from "@/lib/env";
import { pct } from "@/lib/format";
import { getPostsForPicker } from "@/lib/posts";
import { requireUser } from "@/lib/session";
import { AutomationEditor } from "../editor/editor";

export default async function EditarAutomacaoPage({ params }: PageProps<"/automacoes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [automation, picker, stats] = await Promise.all([getAutomation(user.id, id), getPostsForPicker(user.id), automationWeekStats(user.id, id)]);
  if (!automation) notFound();
  const { id: _id, ...initial } = automation;
  const asset = automation.assetId ? await getAsset(user.id, automation.assetId) : null;
  return (
    <AutomationEditor
      id={id}
      initial={initial}
      posts={picker.posts}
      username={picker.username ?? "voce"}
      userId={user.id}
      initialAsset={asset}
      uploadsEnabled={!!env().BLOB_READ_WRITE_TOKEN}
      stats={{ runs: stats.runs, readPct: stats.sent ? `≥ ${pct(stats.read, stats.sent)}` : "—", clickPct: pct(stats.clicked, stats.sent) }}
    />
  );
}
