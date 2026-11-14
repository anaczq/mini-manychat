import { MessageCircle, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { NewAutomationButton } from "@/components/automations/template-chooser";
import { ChannelIcon } from "@/components/channel-icon";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui";
import { type AutomationRow, listAutomations } from "@/lib/automations";
import { int, pct, timeAgo } from "@/lib/format";
import { normalize } from "@/lib/matching";
import { requireUser } from "@/lib/session";
import { AutomationFilters } from "./filters";
import { RowMenu, RowToggle } from "./row-actions";
import { SavedToast } from "./saved-toast";

function scopeLabel(a: AutomationRow) {
  if (a.scope === "all") return "todos os posts";
  return a.postCount === 1 ? "1 post" : `${a.postCount} posts`;
}

function NewButton({ open = false }: { open?: boolean }) {
  return (
    <NewAutomationButton defaultOpen={open}>
      <Button icon={<Plus className="size-4" />} aria-label="Nova automação">
        <span className="hidden sm:inline">Nova automação</span>
      </Button>
    </NewAutomationButton>
  );
}

export default async function AutomacoesPage({ searchParams }: PageProps<"/automacoes">) {
  const user = await requireUser();
  const all = await listAutomations(user.id);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? normalize(sp.q) : "";
  const palavra = typeof sp.palavra === "string" ? sp.palavra : "";
  const estado = sp.estado;
  const openNew = sp.novo === "1";

  const rows = all.filter(
    (a) =>
      (!q || normalize(`${a.name} ${a.terms.join(" ")}`).includes(q)) &&
      (!palavra || a.terms.includes(palavra)) &&
      (estado !== "ligadas" || a.active) &&
      (estado !== "desligadas" || !a.active),
  );
  const terms = [...new Set(all.flatMap((a) => a.terms))].sort();

  return (
    <>
      <PageHeader title="Automação" />
      <SavedToast />
      <div className="flex bg-bg md:min-h-[calc(100dvh-4rem)]">
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-6 md:px-10">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 text-xl font-bold md:text-2xl">Minhas automações</h2>
          <NewButton open={openNew} />
        </div>

        <AutomationFilters terms={terms} />

        {all.length === 0 ? (
          <EmptyState
            title="Crie sua primeira automação"
            action={
              <NewAutomationButton>
                <Button icon={<Plus className="size-4" />}>Nova automação</Button>
              </NewAutomationButton>
            }
          >
            Escolha uma palavra-chave, o material que vai por Direct e a resposta pública. Quem comentar recebe na hora.
          </EmptyState>
        ) : (
          <>

            {rows.length === 0 && (
              <EmptyState icon={<SearchX />} title="Nada com esses filtros">
                Tente outra palavra ou limpe os filtros.
              </EmptyState>
            )}

            {rows.length > 0 && (
              <div className="hidden overflow-visible rounded-lg bg-surface shadow-[0_1px_2px_rgba(35,43,57,0.18)] md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="w-16 px-5 py-3">
                        <span className="sr-only">Ligada</span>
                      </th>
                      <th className="py-3 font-medium">Nome</th>
                      <th className="w-28 py-3 font-medium">Execuções</th>
                      <th className="w-32 py-3 font-medium">Taxa de envio</th>
                      <th className="w-32 py-3 font-medium">Modificada</th>
                      <th className="w-14" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id} className="border-t border-subtle">
                        <td className="px-5 py-4">
                          <RowToggle id={a.id} name={a.name} active={a.active} />
                        </td>
                        <td className="py-4">
                          <Link href={`/automacoes/${a.id}`} className="flex items-center gap-3">
                            <ChannelIcon dim={!a.active} />
                            <span>
                              <span className={`block font-semibold ${a.active ? "" : "text-muted"}`}>{a.name}</span>
                              <span className="flex items-center gap-1 text-xs text-muted">
                                <MessageCircle className="size-3" /> Comentário contém {a.terms.join(", ")} · {scopeLabel(a)}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="py-4 font-medium">{int(a.runs)}</td>
                        <td className="py-4 font-medium">{pct(a.sent, a.sent + a.failed)}</td>
                        <td className="py-4 text-[13px] text-muted">{timeAgo(a.updatedAt)}</td>
                        <td className="py-4">
                          <RowMenu id={a.id} name={a.name} active={a.active} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <ul className="flex flex-col gap-3 md:hidden">
              {rows.map((a) => (
                <li key={a.id} className="rounded-xl bg-surface p-3.5">
                  <div className="flex items-center gap-2.5">
                    <ChannelIcon dim={!a.active} />
                    <Link href={`/automacoes/${a.id}`} className="min-w-0 flex-1">
                      <p className={`truncate text-[15px] font-semibold ${a.active ? "" : "text-muted"}`}>{a.name}</p>
                      <p className="truncate text-xs text-muted">
                        Contém {a.terms[0]} · {scopeLabel(a)}
                      </p>
                    </Link>
                    <RowToggle id={a.id} name={a.name} active={a.active} />
                    <RowMenu id={a.id} name={a.name} active={a.active} />
                  </div>
                  <p className={`mt-2.5 text-xs font-medium ${a.active ? "" : "text-muted"}`}>
                    {a.active ? `${int(a.runs)} execuções · ${pct(a.sent, a.sent + a.failed)}` : "Desligada"}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      </div>
    </>
  );
}
