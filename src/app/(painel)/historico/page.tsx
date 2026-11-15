import clsx from "clsx";
import { MessageCircle, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { z } from "zod";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Icone } from "@/components/icone";
import { PageHeader } from "@/components/page-header";
import { Badge, buttonClass, Card } from "@/components/ui";
import { int, shortAgo } from "@/lib/format";
import { getHistoryEvent, type HistoryFilters, listHistory, PERIODS, STATUS_FILTERS } from "@/lib/history";
import { requireUser } from "@/lib/session";
import { HistoryFiltersBar } from "./filters";
import { RetryButton } from "./retry-button";

const filtersSchema = z.object({
  status: z.enum(Object.keys(STATUS_FILTERS) as [keyof typeof STATUS_FILTERS]).optional().catch(undefined),
  palavra: z.string().uuid().optional().catch(undefined),
  periodo: z.enum(Object.keys(PERIODS) as [keyof typeof PERIODS]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  evento: z.string().uuid().optional().catch(undefined),
});

type Tone = "sucesso" | "alerta" | "erro" | "neutro" | "info";

/** Cor do ponto do DM (Figma: verde enviado, azul lido, cinza ignorado). */
function dmDot(dm: { label: string; tone: Tone }) {
  if (dm.label === "Lido") return "bg-primary";
  return { sucesso: "bg-success", info: "bg-primary", alerta: "bg-warning", erro: "bg-error", neutro: "bg-tertiary" }[dm.tone];
}

function href(sp: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
  return `/historico?${next}`;
}

export default async function HistoricoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const raw = await searchParams;
  const f = filtersSchema.parse(raw);
  const filters: HistoryFilters = { status: f.status, palavra: f.palavra, periodo: f.periodo, page: f.page };
  const [data, detail] = await Promise.all([listHistory(user.id, filters), f.evento ? getHistoryEvent(user.id, f.evento) : null]);
  const sp = { status: f.status, palavra: f.palavra, periodo: f.periodo, page: f.page > 1 ? String(f.page) : undefined };
  const from = data.total ? (f.page - 1) * data.pageSize + 1 : 0;
  const to = Math.min(f.page * data.pageSize, data.total);
  const csvHref = `/api/exportar/historico?${new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][])}`;
  const now = new Date();

  const kpis = [
    { label: "Eventos", value: data.counts.all },
    { label: "Com palavra", short: "Palavra", value: data.counts.matched, accent: true },
    { label: "DMs enviados", short: "DMs", value: data.counts.enviado },
    { label: "Erros", value: data.counts.erro },
  ];

  return (
    <>
      <PageHeader
        eyebrow="01 · Automação · Histórico"
        title="Histórico"
        subtitle={<span className="hidden md:inline">Cada comentário que chegou, a palavra encontrada e o que o Nooi fez.</span>}
        actions={
          <dl className="hidden gap-8 md:flex">
            {kpis.map((k) => (
              <div key={k.label} className="flex flex-col-reverse gap-0.5">
                <dd className={clsx("font-display text-[28px] leading-tight font-medium", k.accent && "text-primary")}>{int(k.value)}</dd>
                <dt className="eyebrow">{k.label}</dt>
              </div>
            ))}
          </dl>
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-4 pb-8 md:gap-[18px] md:px-12 md:pt-[18px] md:pb-14">
        <Card className="md:hidden">
          <dl className="grid grid-cols-4 gap-2 px-4 py-4">
            {kpis.map((k) => (
              <div key={k.label} className="flex min-w-0 flex-col-reverse gap-1">
                <dd className={clsx("font-display text-[22px] leading-tight font-medium", k.accent && "text-primary")}>{int(k.value)}</dd>
                <dt className="eyebrow truncate text-[10px]">{k.short ?? k.label}</dt>
              </div>
            ))}
          </dl>
        </Card>

        <HistoryFiltersBar keywords={data.keywordOptions} counts={data.counts} csvHref={csvHref} />

        {data.rows.length === 0 ? (
          <EmptyState icon={<MessageCircle />} title={f.status || f.palavra ? "Nada com esses filtros" : "Nenhum comentário ainda"}>
            Quando alguém comentar uma palavra-chave, aparece aqui com o status do DM e da resposta.
          </EmptyState>
        ) : (
          <Card className="overflow-hidden">
            <table className="hidden w-full text-left md:table">
              <thead className="bg-subtle">
                <tr className="font-mono text-[10px] tracking-[0.04em] text-muted uppercase">
                  <th className="py-3 pl-5 font-normal">Pessoa</th>
                  <th className="w-[150px] py-3 font-normal">Palavra</th>
                  <th className="w-[140px] py-3 font-normal">Resposta pública</th>
                  <th className="hidden w-[150px] py-3 font-normal xl:table-cell">Automação</th>
                  <th className="w-[90px] py-3 font-normal">Quando</th>
                  <th className="w-[130px] py-3 font-normal">DM</th>
                  <th className="w-[52px] py-3 pr-5">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const open = href(sp, { evento: r.id });
                  return (
                    <tr key={r.id} className={clsx("relative border-t border-border hover:bg-bg", f.evento === r.id && "bg-primary-soft")}>
                      <td className="py-3 pl-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar src={r.picture} name={r.username} size={36} square />
                          <div className="min-w-0">
                            <Link href={open} className="block truncate text-sm font-semibold after:absolute after:inset-0">
                              {r.username}
                            </Link>
                            <p className="max-w-[320px] truncate text-xs text-muted">{r.text}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-[13px] text-secondary uppercase">{r.keyword ?? "—"}</td>
                      <td className="py-3 text-[13px] text-secondary">{r.reply.label}</td>
                      <td className="hidden py-3 xl:table-cell">
                        {r.automation ? (
                          <span className="inline-block max-w-[140px] truncate rounded-full border border-border px-2 py-[3px] text-xs font-medium text-secondary">{r.automation}</span>
                        ) : (
                          <span className="px-2 text-xs font-medium text-tertiary">—</span>
                        )}
                      </td>
                      <td className="py-3 text-[15px] font-semibold whitespace-nowrap">{shortAgo(r.at, now)}</td>
                      <td className="py-3">
                        <span className="flex items-center gap-2 text-[13px] whitespace-nowrap text-secondary">
                          <span className={clsx("size-[7px] shrink-0 rounded-full", dmDot(r.dm))} />
                          {r.dm.label}
                        </span>
                      </td>
                      <td className="py-3 pr-5 text-right">
                        <Icone nome="seta-direita" className="size-4 text-ink" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="md:hidden">
              {data.rows.map((r) => (
                <li key={r.id} className={clsx("border-t border-border first:border-t-0", f.evento === r.id && "bg-primary-soft")}>
                  <Link href={href(sp, { evento: r.id })} className="flex items-center gap-3 px-4 py-3.5">
                    <Avatar src={r.picture} name={r.username} size={36} square />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.username}</span>
                      {r.text && <span className="block truncate text-xs text-secondary">{r.text}</span>}
                      <span className="block truncate text-[11px] text-muted">
                        {r.keyword ? `${r.keyword.toUpperCase()} · DM ${r.dm.label.toLowerCase()}` : r.dm.label} · {shortAgo(r.at, now)}
                      </span>
                    </span>
                    <span className={clsx("size-[7px] shrink-0 rounded-full", dmDot(r.dm))} aria-label={`DM: ${r.dm.label}`} role="img" />
                    <Icone nome="seta-direita" className="size-4 shrink-0 text-ink" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3.5 md:px-5">
              <span className="flex-1 text-xs text-muted">
                Mostrando {int(from)}–{int(to)} de {int(data.total)} · mais recentes primeiro
              </span>
              {f.page > 1 && (
                <Link href={href(sp, { page: String(f.page - 1) })} className={buttonClass("secondary", "h-8 px-3.5 text-xs")}>
                  ← Anterior
                </Link>
              )}
              {to < data.total && (
                <Link href={href(sp, { page: String(f.page + 1) })} className={buttonClass("secondary", "h-8 px-3.5 text-xs")}>
                  Próxima →
                </Link>
              )}
            </div>
          </Card>
        )}
      </div>

      {detail && (
        <>
          <Link href={href(sp, {})} aria-label="Fechar detalhe" className="fixed inset-0 z-50 bg-dark/40" scroll={false} />
          <aside
            aria-label="Detalhe do evento"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(15,18,20,0.14)] md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-[400px] md:rounded-3xl md:pt-5 md:shadow-[0_12px_40px_rgba(15,18,20,0.14)]"
          >
            <div className="flex items-center gap-2">
              <h2 className="flex-1 font-display text-[22px] leading-7 font-medium">Detalhe do evento</h2>
              <Link href={href(sp, {})} aria-label="Fechar detalhe" scroll={false} className="grid size-8 place-items-center rounded-full text-muted hover:bg-bg">
                <X className="size-[18px]" />
              </Link>
            </div>
            <div className="flex items-center gap-2.5">
              <Avatar src={detail.picture} name={detail.username} size={40} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{detail.username}</p>
                <p className="text-xs break-words text-muted">
                  comentou “{detail.text}” · {detail.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </p>
              </div>
            </div>
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="Palavra">{detail.keyword?.toUpperCase() ?? "—"}</Row>
              {detail.automation && <Row label="Automação">{detail.automation}</Row>}
              <Row label="DM">
                <Badge status={detail.dm.tone}>{detail.dm.label}</Badge>
              </Row>
              <Row label="Resposta pública">
                <Badge status={detail.reply.tone}>{detail.reply.label}</Badge>
              </Row>
              <Row label="Tentativas">{detail.attempts}</Row>
            </dl>
            {detail.errorHelp && (
              <div className="rounded-2xl bg-warning-soft p-3.5 text-[13px]">
                <p className="mb-1 font-semibold text-warning">{detail.errorCode ? `Erro ${detail.errorCode}` : "Atenção"}</p>
                {detail.errorHelp}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold">Linha do tempo</p>
              {detail.timeline.map((t, i) => (
                <p key={i} className="text-xs text-secondary">
                  <span className="font-mono text-[11px] text-muted">{t.at.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span> · {t.text}
                </p>
              ))}
            </div>
            <RetryButton id={detail.id} enabled={detail.canRetry} reason={detail.retryBlockedReason} />
          </aside>
        </>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="flex-1 text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
