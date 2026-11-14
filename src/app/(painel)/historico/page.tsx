import clsx from "clsx";
import { FileText, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge, Button } from "@/components/ui";
import { timeAgo } from "@/lib/format";
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

  return (
    <>
      <PageHeader
        title="Histórico"
        actions={
          <a href={csvHref}>
            <Button variant="secondary" icon={<FileText className="size-4" />} aria-label="Exportar CSV">
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
          </a>
        }
      />
      <div className="flex min-h-[calc(100dvh-4rem)] bg-bg">
        <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-6 md:px-10">
          <HistoryFiltersBar keywords={data.keywordOptions} total={data.total} />

          {data.rows.length === 0 ? (
            <EmptyState icon={<MessageCircle />} title={f.status || f.palavra ? "Nada com esses filtros" : "Nenhum comentário ainda"}>
              Quando alguém comentar uma palavra-chave, aparece aqui com o status do DM e da resposta.
            </EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg bg-surface shadow-[0_1px_2px_rgba(35,43,57,0.18)]">
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Pessoa</th>
                    <th className="py-3 font-medium">Comentário</th>
                    <th className="py-3 font-medium">Palavra</th>
                    <th className="py-3 font-medium">DM</th>
                    <th className="py-3 font-medium">Resposta</th>
                    <th className="py-3 pr-4 font-medium">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className={clsx("border-t border-subtle", f.evento === r.id && "bg-primary-soft")}>
                      <td className="px-4 py-3">
                        <Link href={href(sp, { evento: r.id })} className="flex items-center gap-2.5 font-medium">
                          <Avatar src={r.picture} name={r.username} />
                          {r.username}
                        </Link>
                      </td>
                      <td className="max-w-[220px] truncate py-3 text-[13px] text-muted">{r.text}</td>
                      <td className="py-3">
                        {r.keyword ? <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary">{r.keyword}</span> : "—"}
                      </td>
                      <td className="py-3">
                        <Badge status={r.dm.tone}>{r.dm.label}</Badge>
                      </td>
                      <td className="py-3">
                        <Badge status={r.reply.tone}>{r.reply.label}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-[13px] text-muted">{timeAgo(r.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="md:hidden">
                {data.rows.map((r) => (
                  <li key={r.id} className="border-t border-subtle first:border-t-0">
                    <Link href={href(sp, { evento: r.id })} className="flex items-center gap-2.5 px-3.5 py-3">
                      <Avatar src={r.picture} name={r.username} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.username}</span>
                        <span className="block truncate text-xs text-muted">
                          {r.keyword ?? "—"} · {timeAgo(r.at)}
                        </span>
                      </span>
                      <Badge status={r.dm.tone}>{r.dm.label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 border-t border-subtle px-4 py-3">
                <span className="flex-1 text-[13px] text-muted">
                  {from}–{to} de {data.total}
                </span>
                {f.page > 1 && (
                  <Link href={href(sp, { page: String(f.page - 1) })}>
                    <Button variant="secondary">← Anterior</Button>
                  </Link>
                )}
                {to < data.total && (
                  <Link href={href(sp, { page: String(f.page + 1) })}>
                    <Button variant="secondary">Próxima →</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {detail && <Link href={href(sp, {})} aria-label="Fechar detalhe" className="fixed inset-0 z-50 bg-black/45 md:hidden" />}
        {detail && (
          <aside
            aria-label="Detalhe do evento"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:static md:max-h-none md:w-[340px] md:shrink-0 md:rounded-none md:border-l md:border-border md:shadow-none"
          >
            <div className="flex items-center">
              <h2 className="flex-1 text-xl font-bold">Detalhe do evento</h2>
              <Link href={href(sp, {})} aria-label="Fechar detalhe">
                <X className="size-[18px] text-muted" />
              </Link>
            </div>
            <div className="flex items-center gap-2.5">
              <Avatar src={detail.picture} name={detail.username} size={40} />
              <div className="min-w-0">
              <p className="text-[15px] font-semibold">{detail.username}</p>
              <p className="break-words text-xs text-muted">
                comentou “{detail.text}” · {detail.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </p>
              </div>
            </div>
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="Palavra">{detail.keyword ?? "—"}</Row>
              <Row label="DM">
                <Badge status={detail.dm.tone}>{detail.dm.label}</Badge>
              </Row>
              <Row label="Resposta pública">
                <Badge status={detail.reply.tone}>{detail.reply.label}</Badge>
              </Row>
              <Row label="Tentativas">{detail.attempts}</Row>
            </dl>
            {detail.errorHelp && (
              <div className="rounded-md border border-warning bg-warning-soft p-3.5 text-[13px]">
                <p className="mb-1 font-semibold text-warning">{detail.errorCode ? `Erro ${detail.errorCode}` : "Atenção"}</p>
                {detail.errorHelp}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">Linha do tempo</p>
              {detail.timeline.map((t, i) => (
                <p key={i} className="text-xs text-muted">
                  {t.at.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {t.text}
                </p>
              ))}
            </div>
            <RetryButton id={detail.id} enabled={detail.canRetry} reason={detail.retryBlockedReason} />
          </aside>
        )}
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center">
      <dt className="flex-1 text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
