import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getPostsForPicker } from "@/lib/posts";
import { requireUser } from "@/lib/session";
import { templateFor } from "@/lib/templates";
import { AutomationEditor } from "../editor/editor";

export default async function NovaAutomacaoPage({ searchParams }: PageProps<"/automacoes/nova">) {
  const user = await requireUser();
  const { modelo } = await searchParams;
  // Sem modelo escolhido: volta para a lista com o popup de modelos aberto.
  if (typeof modelo !== "string") redirect("/automacoes?novo=1");
  const picker = await getPostsForPicker(user.id);
  return (
    <AutomationEditor
      id={null}
      initial={templateFor(modelo)}
      posts={picker.posts}
      username={picker.username ?? "voce"}
      stats={null}
      userId={user.id}
      initialAsset={null}
      uploadsEnabled={!!env().BLOB_READ_WRITE_TOKEN}
      defaultMaterialKind={modelo === "arquivo" ? "arquivo" : "link"}
    />
  );
}
