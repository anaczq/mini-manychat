import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { NewAutomationButton } from "@/components/automations/template-chooser";
import { Icone } from "@/components/icone";
import { PageHeader } from "@/components/page-header";
import { Button, Card } from "@/components/ui";
import { type AutomationRow, listAutomations } from "@/lib/automations";
import { int, pct } from "@/lib/format";
import { normalize } from "@/lib/matching";
import { requireUser } from "@/lib/session";
import { AutomationFilters } from "./filters";
import { RowMenu, RowToggle } from "./row-actions";
import { SavedToast } from "./saved-toast";

function scopeLabel(a: AutomationRow) {
  if (a.scope === "all") return "Qualquer post";
  return a.postCount === 1 ? "1 post" : `${a.postCount} posts`;
}

function termsShort(a: AutomationRow) {
  const [first = "", ...rest] = a.terms;
  return rest.length ? `${first.toUpperCase()} +${rest.length}` : first.toUpperCase();
}

function termsLong(a: AutomationRow) {
  const shown = a.terms.slice(0, 3).join(", ");
  return a.terms.length > 3 ? `${shown} +${a.terms.length - 3}` : shown;
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words.at(-1)![0] : (words[0][1] ?? "");
  return (first + last).toUpperCase();
}

function sendRate(a: Pick<AutomationRow, "sent" | "failed">) {
  return pct(a.sent, a.sent + a.failed);
}

function runsDot(a: AutomationRow) {
  if (!a.runs) return "bg-tertiary";
  return a.failed ? "bg-warning" : "bg-success";
}

function Avatar({ name, dim }: { name: string; dim?: boolean }) {
  return (
    <span className={clsx("grid size-9 shrink-0 place-items-center rounded-xl bg-subtle text-xs font-semibold text-secondary", dim && "opacity-60")}>
      {initials(name)}
    </span>
  );
}

function Kpi({ label, value, accent, small }: { label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={clsx("eyebrow truncate", small && "text-[9px]")}>{label}</span>
      <span className={clsx("font-display leading-tight font-medium", small ? "text-[22px]" : "text-[28px]", accent && "text-primary")}>{value}</span>
    </div>
  );
}

function NewButton({ open = false, className }: { open?: boolean; className?: string }) {
  return (
    <NewAutomationButton defaultOpen={open}>
      <Button className={className}>+ Nova automação</Button>
    </NewAutomationButton>
  );
}

function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Image src="/marca/nooi.png" alt="" width={88} height={88} className="size-[72px] object-contain md:size-[88px]" />
      <h2 className="font-display text-xl leading-7 font-medium">{title}</h2>
      <p className="max-w-[460px] text-sm text-muted">{children}</p>
      {action}
    </Card>
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

  const on = all.filter((a) => a.active).length;
  const totals = all.reduce((t, a) => ({ runs: t.runs + a.runs, sent: t.sent + a.sent, failed: t.failed + a.failed }), { runs: 0, sent: 0, failed: 0 });
  const kpis = [
    { label: "Ligadas", value: int(on) },
    { label: "Execuções", value: int(totals.runs), accent: true },
    { label: "Taxa de envio", short: "Envio", value: sendRate(totals) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="01 · Automação · Lista"
        title="Automações"
        subtitle={<span className="hidden md:inline">Respostas automáticas para comentários no Instagram. Ligue, desligue ou edite.</span>}
        actions={
          <>
            {all.length > 0 && (
              <div className="mr-6 hidden items-end gap-8 lg:flex">
                {kpis.map((k) => (
                  <Kpi key={k.label} label={k.label} value={k.value} accent={k.accent} />
                ))}
              </div>
            )}
            <NewButton open={openNew} />
          </>
        }
      />
      <SavedToast />

      <div className="flex flex-col gap-3.5 px-4 pt-4 pb-8 md:gap-[18px] md:px-12 md:pt-[18px] md:pb-14">
        {all.length === 0 ? (
          <Empty
            title="Crie sua primeira automação"
            action={
              <NewAutomationButton>
                <Button className="mt-1">+ Nova automação</Button>
              </NewAutomationButton>
            }
          >
            Escolha uma palavra-chave, o material que vai por Direct e a resposta pública. Quem comentar recebe na hora.
          </Empty>
        ) : (
          <>
            <Card className="grid grid-cols-3 gap-3 rounded-[20px] px-4 py-3.5 lg:hidden">
              {kpis.map((k) => (
                <Kpi key={k.label} label={k.short ?? k.label} value={k.value} accent={k.accent} small />
              ))}
            </Card>

            <AutomationFilters terms={terms} counts={{ all: all.length, on, off: all.length - on }} />

            {rows.length === 0 ? (
              <Empty title="Nada com esses filtros">Tente outra palavra ou limpe os filtros.</Empty>
            ) : (
              <>
                {/* Desktop: tabela */}
                <Card className="hidden md:block">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="bg-subtle text-left [&>th]:py-3 [&>th]:font-mono [&>th]:text-[10px] [&>th]:font-normal [&>th]:tracking-[0.04em] [&>th]:text-muted [&>th]:uppercase">
                        <th className="rounded-tl-3xl pl-5">Automação</th>
                        <th className="hidden w-[150px] xl:table-cell">Palavras</th>
                        <th className="hidden w-[140px] lg:table-cell">Onde</th>
                        <th className="w-[100px]">Execuções</th>
                        <th className="w-[150px]">Estado</th>
                        <th className="w-[124px] rounded-tr-3xl pr-5">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="py-3 pl-5">
                            <Link href={`/automacoes/${a.id}`} className="group flex min-w-0 items-center gap-3">
                              <Avatar name={a.name} dim={!a.active} />
                              <span className="min-w-0">
                                <span className={clsx("block truncate font-semibold group-hover:text-primary", !a.active && "text-muted")}>{a.name}</span>
                                <span className="block truncate text-xs text-muted">Comentário contém {termsLong(a)}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="hidden text-[13px] text-secondary xl:table-cell">{termsShort(a)}</td>
                          <td className="hidden text-[13px] text-secondary lg:table-cell">{scopeLabel(a)}</td>
                          <td>
                            <span className="flex items-center gap-2">
                              <span className={clsx("size-[7px] shrink-0 rounded-full", runsDot(a))} />
                              <span className="text-[15px] font-semibold">{int(a.runs)}</span>
                              <span className="font-mono text-[11px] text-muted">{sendRate(a)}</span>
                            </span>
                          </td>
                          <td>
                            <RowToggle id={a.id} name={a.name} active={a.active} showLabel />
                          </td>
                          <td className="pr-5">
                            <span className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/historico?palavra=${a.id}`}
                                aria-label={`Ver comentários de ${a.name}`}
                                title="Ver comentários"
                                className="grid size-8 place-items-center rounded-full border border-border text-ink hover:bg-bg"
                              >
                                <Icone nome="conversas" className="size-[15px]" />
                              </Link>
                              <RowMenu id={a.id} name={a.name} active={a.active} />
                              <Link href={`/automacoes/${a.id}`} aria-label={`Editar ${a.name}`} className="grid size-6 place-items-center text-ink hover:text-primary">
                                <Icone nome="seta-direita" className="size-4" />
                              </Link>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td colSpan={6} className="px-5 py-3.5 text-xs text-muted">
                          Mostrando {int(rows.length)} de {int(all.length)} {all.length === 1 ? "automação" : "automações"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </Card>

                {/* Mobile: lista */}
                <Card className="rounded-[20px] md:hidden">
                  <ul>
                    {rows.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 border-t border-border px-3.5 py-3 first:border-t-0">
                        <Avatar name={a.name} dim={!a.active} />
                        <Link href={`/automacoes/${a.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={clsx("truncate text-sm font-semibold", !a.active && "text-muted")}>{a.name}</span>
                          <span className="truncate text-xs text-muted">
                            {a.active ? "Ligada" : "Desligada"} · {sendRate(a)} enviados
                          </span>
                          <span className="truncate text-[11px] text-muted">
                            {termsShort(a)} · {scopeLabel(a).toLowerCase()}
                          </span>
                        </Link>
                        <span className="flex shrink-0 items-center gap-[5px]" title={`${int(a.runs)} execuções`}>
                          <span className={clsx("size-[7px] rounded-full", runsDot(a))} />
                          <span className="text-[15px] font-semibold">{int(a.runs)}</span>
                        </span>
                        <RowToggle id={a.id} name={a.name} active={a.active} />
                        <RowMenu id={a.id} name={a.name} active={a.active} />
                      </li>
                    ))}
                  </ul>
                </Card>
                <p className="text-xs text-muted md:hidden">
                  Mostrando {int(rows.length)} de {int(all.length)} {all.length === 1 ? "automação" : "automações"}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
