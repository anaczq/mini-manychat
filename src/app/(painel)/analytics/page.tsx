import clsx from "clsx";
import { BarChart3 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { axisNumber, BarsChart, HBar, LineChart } from "@/components/charts";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardTitle, StatCard } from "@/components/ui";
import { getAutomationAnalytics, getInstagramAnalytics, RANGES, sameMoment, type RangeDays } from "@/lib/analytics";
import { compact, delta, int, pct, rate, seconds, shortDate, timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { RefreshButton } from "./refresh";

const HEAT = ["bg-subtle", "bg-primary/15", "bg-primary/35", "bg-primary/60", "bg-primary"];
const AGE_DOT = ["bg-primary", "bg-primary", "bg-primary/80", "bg-primary/65", "bg-primary/50", "bg-primary/40"];
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const GENDER: Record<string, string> = { F: "Mulheres", M: "Homens", U: "Não informado" };

function ratio(a: number, b: number) {
  return b ? (a / b) * 100 : 0;
}

/** "N unidades · pico de X em data" para o subtítulo dos gráficos de barras. */
function peakText(data: { day: string; n: number }[], total: string) {
  const max = Math.max(0, ...data.map((d) => d.n));
  if (!max) return total;
  const at = data.find((d) => d.n === max)!;
  return `${total} · pico de ${axisNumber(max)} em ${shortDate(at.day)}`;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const days: RangeDays = RANGES.includes(Number(sp.dias) as RangeDays) ? (Number(sp.dias) as RangeDays) : 30;
  const [a, ig] = await Promise.all([getAutomationAnalytics(user.id, days), getInstagramAnalytics(user.id, days)]);
  const { cur, prev } = a;

  const funnel = [
    { label: "Comentários", value: cur.received },
    { label: "Com palavra-chave", short: "Com palavra", value: cur.matched },
    { label: "DM enviado", value: cur.sent },
    { label: "DM lido", value: cur.read },
    { label: "Clicou no link", value: cur.clicked },
    { label: "Respondeu o DM", short: "Respondeu", value: cur.replied },
  ];
  const top = Math.max(1, cur.received);
  const maxHeat = Math.max(1, ...a.heat.flat());
  const peak = (() => {
    let best = { d: -1, b: -1, n: 0 };
    a.heat.forEach((row, d) => row.forEach((n, b) => n > best.n && (best = { d, b, n })));
    return best.n ? `${DAYS[best.d]}, ${best.b * 3}h–${best.b * 3 + 3}h` : null;
  })();
  const maxKeyword = Math.max(1, ...a.byKeyword.map((k) => k.sent));
  const dmsTotal = a.daily.reduce((s, d) => s + d.n, 0);

  const t = ig.dashboard?.totals ?? {};
  const pt = ig.dashboard?.previousTotals ?? {};
  const ages = [...(ig.demographics?.demographics?.age ?? [])].sort((x, y) => y.value - x.value);
  const ageTotal = ages.reduce((s, x) => s + x.value, 0);
  const gender = [...(ig.demographics?.demographics?.gender ?? [])].sort((x, y) => y.value - x.value);
  const genderTotal = gender.reduce((s, g) => s + g.value, 0);
  const cities = [...(ig.demographics?.demographics?.city ?? [])].sort((x, y) => y.value - x.value).slice(0, 5);
  const inbox = ig.inboxVolume?.summary ?? {};
  const response = ig.inboxResponse?.summary;
  const histogram = ig.inboxResponse?.histogram ?? [];
  const maxHist = Math.max(1, ...histogram.map((h) => h.count));
  const onlinePeak = ig.online.length ? ig.online.indexOf(Math.max(...ig.online)) : -1;
  const maxOnline = Math.max(1, ...ig.online);
  const f = ig.followers;
  const reachTotal = ig.insights?.metrics?.reach?.total;
  const reachDaily = ig.daily.map((d) => ({ day: d.date, n: d.reach ?? 0 }));
  const inboxDaily = (ig.inboxVolume?.timeseries ?? []).map((d) => ({ day: d.date, n: d.received ?? 0 }));
  const inboxTotal = inboxDaily.reduce((s, d) => s + d.n, 0);
  const followersSub =
    f.gained !== undefined || f.lost !== undefined
      ? `+${int(f.gained ?? 0)} novos, −${int(f.lost ?? 0)} saídas · saldo de ${(f.gained ?? 0) - (f.lost ?? 0) >= 0 ? "+" : "−"}${int(Math.abs((f.gained ?? 0) - (f.lost ?? 0)))}`
      : f.series.length > 1
        ? `${delta(f.series[f.series.length - 1].value, f.series[0].value)} desde ${shortDate(f.series[0].date)}`
        : undefined;
  // Alcance e engajamento de cada post vêm da Zernio, casados pela data de publicação.
  const postReach = (postedAt: Date | null) => {
    const z = postedAt ? ig.zernioPosts.find((p) => p.publishedAt && sameMoment(postedAt, new Date(p.publishedAt))) : undefined;
    return z?.metrics;
  };

  const audience =
    ages.length > 0 || genderTotal > 0 || cities.length > 0 ? (
      <Card className="flex flex-col gap-3.5 p-5 md:p-6">
        <CardTitle eyebrow="Instagram · público" title="Público por idade" />
        <ul className="flex flex-col gap-3.5">
          {ages.map((x, i) => (
            <AudienceRow key={x.dimension} dot={AGE_DOT[i] ?? "bg-primary/30"} label={x.dimension} sub={`${pct(x.value, ageTotal)} do público`} value={int(x.value)} />
          ))}
          {genderTotal > 0 && (
            <AudienceRow dot="bg-dark" label="Gênero" sub={gender.map((g) => `${GENDER[g.dimension] ?? g.dimension} ${pct(g.value, genderTotal)}`).join(" · ")} />
          )}
          {cities.length > 0 && (
            <AudienceRow
              dot="bg-dark"
              label="Cidade nº 1"
              sub={[cities[0].dimension.split(",")[0], cities.length > 1 && `depois: ${cities.slice(1).map((c) => c.dimension.split(",")[0]).join(", ")}`].filter(Boolean).join(" · ")}
              value={int(cities[0].value)}
            />
          )}
        </ul>
      </Card>
    ) : null;

  return (
    <>
      <PageHeader
        eyebrow="01 · Automação · Analytics"
        title="Analytics"
        subtitle={`Funil das automações, Instagram e Direct · últimos ${days} dias.`}
        actions={
          <>
            <nav aria-label="Período" className="flex items-center rounded-full border border-border bg-surface p-0.5">
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`/analytics?dias=${r}`}
                  aria-current={r === days ? "page" : undefined}
                  className={clsx("rounded-full px-3 py-1.5 text-[13px] font-medium", r === days ? "bg-dark text-white" : "text-secondary hover:text-ink")}
                >
                  {r} dias
                </Link>
              ))}
            </nav>
            <span className="hidden md:inline-flex">
              <RefreshButton days={days} variant="button" />
            </span>
          </>
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-5 pb-8 md:gap-5 md:px-12 md:pb-14">
        {cur.received === 0 ? (
          <EmptyState icon={<BarChart3 />} title={`Sem comentários nos últimos ${days} dias`}>
            O funil, as taxas e o mapa de horários aparecem quando chegarem comentários nos posts com automação ligada.
          </EmptyState>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
              <StatCard
                label="Sucesso do DM"
                value={pct(cur.sent, cur.sent + cur.failed)}
                hint={`${delta(ratio(cur.sent, cur.sent + cur.failed), ratio(prev.sent, prev.sent + prev.failed), "pp")} vs. período anterior`}
                neutral
              />
              <StatCard label="Taxa de leitura" value={cur.sent ? `≥ ${pct(cur.read, cur.sent)}` : "—"} hint={`${delta(ratio(cur.read, cur.sent), ratio(prev.read, prev.sent), "pp")} · estimativa mínima`} accent neutral />
              <StatCard label="Taxa de clique" value={pct(cur.clicked, cur.sent)} hint={delta(ratio(cur.clicked, cur.sent), ratio(prev.clicked, prev.sent), "pp")} neutral />
              <StatCard label="Conversas iniciadas" value={int(cur.replied)} hint={`${delta(cur.replied, prev.replied)} · tempo até o DM ${seconds(cur.p50)}`} neutral />
            </section>

            <section className="grid grid-cols-1 items-start gap-3 md:gap-5 lg:grid-cols-[1fr_360px]">
              <Card className="flex flex-col gap-3.5 p-5 md:p-6">
                <CardTitle eyebrow={`Funil da automação · ${days} dias`} title="Do comentário à conversa" action={<Link href="/historico">Histórico →</Link>} />
                {funnel.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-3.5">
                    <span className="w-[92px] shrink-0 truncate text-sm font-medium md:w-[150px]">
                      {s.short ? (
                        <>
                          <span className="md:hidden">{s.short}</span>
                          <span className="hidden md:inline">{s.label}</span>
                        </>
                      ) : (
                        s.label
                      )}
                    </span>
                    <div className="h-2.5 min-w-0 flex-1 rounded-[5px] bg-subtle">
                      <div className="h-2.5 rounded-[5px] bg-primary" style={{ width: `${Math.max(s.value ? 2 : 0, (s.value / top) * 100)}%` }} />
                    </div>
                    <span className="flex shrink-0 items-center justify-end gap-1.5 md:w-[70px]">
                      <span className="text-sm font-semibold">{int(s.value)}</span>
                      <span className="hidden w-7 font-mono text-[11px] text-muted md:inline">{i ? pct(s.value, cur.received) : ""}</span>
                    </span>
                  </div>
                ))}
                <p className="text-[13px] text-muted">
                  {int(cur.replied)} de {int(cur.received)} comentários viraram conversa ({pct(cur.replied, cur.received)}). “Lido” é estimativa mínima: DMs em Solicitações podem
                  não avisar leitura.
                  {cur.p95 ? ` Tempo até o DM: ${seconds(cur.p50)} na mediana, ${seconds(cur.p95)} no p95.` : ""}
                  {cur.blocked ? ` Anti-spam segurou ${int(cur.blocked)} (duplicados e flood).` : ""}
                </p>
              </Card>

              <Card className="flex flex-col gap-4 p-5 md:p-6">
                <CardTitle
                  eyebrow={`Automação · ${a.byKeyword.length} ${a.byKeyword.length === 1 ? "palavra" : "palavras"}`}
                  title="Por palavra-chave"
                  action={
                    <Link href="/automacoes" className="hidden md:inline">
                      Automações →
                    </Link>
                  }
                />
                {a.byKeyword.length === 0 ? (
                  <p className="text-sm text-muted">Nenhuma automação ainda.</p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {a.byKeyword.map((k) => (
                      <li key={k.id} className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary-soft text-sm font-semibold text-primary uppercase">{k.term?.[0] ?? "?"}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium uppercase" title={k.name}>
                              {k.term}
                              <span className="hidden font-normal text-muted normal-case md:inline">
                                {" "}
                                · {k.sent ? `≥${pct(k.read, k.sent)} lidos · ${pct(k.clicked, k.sent)} cliques` : "sem DMs"}
                              </span>
                            </span>
                            <span className="text-sm font-semibold">{int(k.sent)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-subtle">
                            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(k.sent / maxKeyword) * 100}%` }} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {a.byKeyword.length > 0 && (
                  <p className="hidden text-xs text-muted md:block">DMs enviados por palavra. Conversas: {a.byKeyword.map((k) => int(k.replied)).join(" · ")}.</p>
                )}
              </Card>
            </section>

            <section className="grid grid-cols-1 items-start gap-3 md:gap-5 lg:grid-cols-[1fr_360px]">
              <Card className="flex flex-col gap-2 p-5 md:p-6">
                <CardTitle eyebrow={`Posts · ${a.byPost.length} com palavra`} title="Posts que mais geram leads" />
                {a.byPost.length === 0 ? (
                  <p className="text-sm text-muted">Nenhum post com palavra-chave no período.</p>
                ) : (
                  <>
                    <table className="mt-2 hidden w-full text-sm md:table">
                      <thead>
                        <tr className="font-mono text-[10px] tracking-[0.04em] text-muted uppercase">
                          <th className="py-2.5 text-left font-normal">Post</th>
                          <th className="w-[110px] py-2.5 text-right font-normal">Com palavra</th>
                          <th className="w-[80px] py-2.5 text-right font-normal">DMs</th>
                          <th className="w-[80px] py-2.5 text-right font-normal">Cliques</th>
                          <th className="w-[90px] py-2.5 text-right font-normal">Alcance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.byPost.map((p) => {
                          const reach = postReach(p.postedAt)?.reach;
                          return (
                            <tr key={p.postId} className="border-t border-border">
                              <td className="max-w-0 truncate py-3 pr-4 font-medium">{p.caption || "Post"}</td>
                              <td className="py-3 text-right text-secondary">{int(p.matched)}</td>
                              <td className="py-3 text-right font-semibold">{int(p.sent)}</td>
                              <td className="py-3 text-right text-secondary">{int(p.clicked)}</td>
                              <td className="py-3 text-right text-secondary">{reach !== undefined ? int(reach) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <ul className="md:hidden">
                      {a.byPost.map((p) => {
                        const reach = postReach(p.postedAt)?.reach;
                        return (
                          <li key={p.postId} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{p.caption || "Post"}</span>
                              <span className="block truncate text-xs text-muted">
                                {int(p.matched)} com palavra · {reach !== undefined ? `${int(reach)} alcance` : `${int(p.sent)} DMs`}
                              </span>
                            </span>
                            <span className="text-right">
                              <span className="block text-sm font-semibold">{int(p.clicked)}</span>
                              <span className="font-mono text-[10px] text-muted">cliques</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </Card>
              {audience}
            </section>

            <Card className="flex flex-col gap-2 p-5 md:p-6">
              <CardTitle eyebrow={`Automação · ${days} dias`} title="DMs enviados por dia" />
              <p className="mb-3 text-xs text-muted md:text-[13px]">{peakText(a.daily, dmsTotal ? `${int(dmsTotal)} DMs no período` : "Nenhum DM no período")}</p>
              <BarsChart data={a.daily} unit="DMs" label={`DMs enviados por dia nos últimos ${days} dias`} />
            </Card>

            <section className="grid grid-cols-1 items-start gap-3 md:gap-5 lg:grid-cols-2">
              <Card className={clsx("flex flex-col gap-2 p-5 md:p-6", ig.online.length === 0 && "lg:col-span-2")}>
                <CardTitle eyebrow="Automação · comentários com palavra" title="Quando comentam" />
                <p className="mb-2 text-xs text-muted md:text-[13px]">{peak ? `Pico: ${peak}` : "Ainda sem comentários suficientes."}</p>
                <div className="ml-9 grid grid-cols-8 gap-[3px] text-center font-mono text-[10px] text-tertiary">
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                    <span key={h}>{h}h</span>
                  ))}
                </div>
                <div className="flex flex-col gap-[3px]">
                  {a.heat.map((row, d) => (
                    <div key={d} className="flex items-center gap-[3px]">
                      <span className="w-9 shrink-0 text-[11px] text-muted">{DAYS[d]}</span>
                      <div className="grid flex-1 grid-cols-8 gap-[3px]">
                        {row.map((n, b) => (
                          <span
                            key={b}
                            title={`${DAYS[d]} ${b * 3}h–${b * 3 + 3}h: ${n}`}
                            className={clsx("h-6 rounded-md", HEAT[n ? Math.min(4, Math.ceil((n / maxHeat) * 4)) : 0])}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1 font-mono text-[10px] text-tertiary">
                  Menos
                  {HEAT.map((c) => (
                    <span key={c} className={clsx("h-2.5 w-3.5 rounded-sm", c)} />
                  ))}
                  Mais
                </div>
              </Card>
              {ig.online.length > 0 && (
                <Card className="flex flex-col gap-2 p-5 md:p-6">
                  <CardTitle eyebrow="Instagram · média diária" title="Seguidores online por hora" />
                  <p className="mb-2 text-xs text-muted md:text-[13px]">
                    Mais gente online às {onlinePeak}h ({int(ig.online[onlinePeak])}) · fuso informado pela Meta
                  </p>
                  <div className="flex h-[120px] items-end gap-[2px] border-b border-border-strong md:h-[144px]" role="img" aria-label="Seguidores online por hora do dia">
                    {ig.online.map((n, h) => (
                      <span key={h} title={`${h}h: ${int(n)}`} className={clsx("flex-1 rounded-t", h === onlinePeak ? "bg-primary" : "bg-primary/35")} style={{ height: `${(n / maxOnline) * 100}%` }} />
                    ))}
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-tertiary">
                    <span>0h</span>
                    <span>12h</span>
                    <span>23h</span>
                  </div>
                </Card>
              )}
            </section>
          </>
        )}

        {/* Instagram */}
        <SectionLabel>Instagram · dados da Zernio · até 48 h de atraso</SectionLabel>
        <section className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
          <StatCard label="Alcance" value={compact(reachTotal)} hint={`${days} dias`} neutral />
          <StatCard
            label="Visualizações"
            value={compact(ig.insights?.metrics?.views?.total)}
            hint={ig.insights?.metrics?.accounts_engaged?.total !== undefined ? `${int(ig.insights.metrics.accounts_engaged.total)} contas engajadas` : undefined}
            neutral
          />
          <StatCard
            label="Engajamento"
            value={rate(t.engagementRate)}
            hint={[
              t.engagementRate !== undefined && pt.engagementRate !== undefined && delta(t.engagementRate, pt.engagementRate, "pp"),
              ig.insights?.metrics?.total_interactions?.total !== undefined && `${int(ig.insights.metrics.total_interactions.total)} interações`,
            ]
              .filter(Boolean)
              .join(" · ") || undefined}
            neutral
          />
          <StatCard
            label="Seguidores"
            value={compact(f.current)}
            hint={f.gained !== undefined || f.lost !== undefined ? `+${int(f.gained ?? 0)} / −${int(f.lost ?? 0)} no período` : undefined}
            neutral
          />
        </section>
        <section className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
          {(
            [
              ["Curtidas", "likes"],
              ["Comentários", "comments"],
              ["Compartilhamentos", "shares"],
              ["Salvamentos", "saves"],
            ] as const
          ).map(([label, k]) => (
            <StatCard key={k} label={label} value={compact(t[k])} hint={t[k] !== undefined && pt[k] !== undefined ? `${delta(t[k], pt[k])} vs. anterior` : undefined} neutral />
          ))}
        </section>
        <section className="grid grid-cols-1 items-start gap-3 md:gap-5 lg:grid-cols-2">
          <Card className="flex flex-col gap-2 p-5 md:p-6">
            <CardTitle eyebrow={`Instagram · ${days} dias`} title="Alcance por dia" />
            {reachDaily.length ? (
              <>
                <p className="mb-3 text-xs text-muted md:text-[13px]">{peakText(reachDaily, reachTotal !== undefined ? `${compact(reachTotal)} contas alcançadas` : "Contas alcançadas por dia")}</p>
                <BarsChart data={reachDaily} unit="contas" label="Alcance por dia" />
              </>
            ) : (
              <p className="text-sm text-muted">Sem dados ainda.</p>
            )}
          </Card>
          <Card className="flex flex-col gap-2 p-5 md:p-6">
            <CardTitle eyebrow="Instagram · desde a conexão" title="Seguidores" />
            {f.series.length > 1 ? (
              <>
                {followersSub && <p className="mb-3 text-xs text-muted md:text-[13px]">{followersSub}</p>}
                <LineChart data={f.series} />
              </>
            ) : (
              <p className="text-sm text-muted">A série aparece depois de alguns dias de conexão na Zernio.</p>
            )}
          </Card>
        </section>
        {cur.received === 0 && audience}
        {ig.topPosts.length > 0 && (
          <Card className="flex flex-col gap-4 p-5 md:p-6">
            <CardTitle eyebrow={`Instagram · ${days} dias`} title="Top posts por engajamento" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {ig.topPosts.map((p, i) => (
                <a key={i} href={p.permalink ?? undefined} target="_blank" rel="noreferrer" className="group flex min-w-0 flex-col gap-1">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-subtle">
                    {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa do Instagram */}
                    {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />}
                  </div>
                  <p className="mt-1 line-clamp-1 text-[13px] font-medium group-hover:text-primary">{p.caption || "Post"}</p>
                  <p className="truncate text-xs text-muted">{int(p.interactions)} interações</p>
                  <p className="truncate font-mono text-[11px] text-muted">
                    {compact(p.reach)} alcance · {rate(p.engagementRate)}
                  </p>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Direct */}
        <SectionLabel>Direct · dados da Zernio</SectionLabel>
        <section className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
          <StatCard label="Mensagens recebidas" value={int(inbox.received ?? 0)} hint={`${int(inbox.uniqueConversations ?? 0)} conversas únicas`} neutral />
          <StatCard label="Mensagens enviadas" value={int(inbox.sent ?? 0)} hint={`${int(inbox.failed ?? 0)} ${inbox.failed === 1 ? "falha" : "falhas"}`} neutral />
          <StatCard label="Lidas" value={int(inbox.read ?? 0)} hint="—" neutral />
          <StatCard
            label="Tempo de resposta"
            value={seconds(response?.sampleSize ? response.medianSeconds : null)}
            hint={response?.sampleSize ? `mediana · p90: ${seconds(response.p90Seconds)} · ${int(response.sampleSize)} respostas` : "mediana"}
            neutral
          />
        </section>
        <section className={clsx("grid grid-cols-1 items-start gap-3 md:gap-5", histogram.length > 0 && "lg:grid-cols-[1fr_360px]")}>
          <Card className="flex flex-col gap-2 p-5 md:p-6">
            <CardTitle eyebrow={`Direct · últimos ${inboxDaily.length || days} dias`} title="Mensagens recebidas por dia" />
            {inboxDaily.length ? (
              <>
                <p className="mb-3 text-xs text-muted md:text-[13px]">{peakText(inboxDaily, `${int(inboxTotal)} mensagens em ${inboxDaily.length} dias`)}</p>
                <BarsChart data={inboxDaily} unit="mensagens" label="Mensagens recebidas por dia" />
              </>
            ) : (
              <p className="text-sm text-muted">Sem dados ainda.</p>
            )}
          </Card>
          {histogram.length > 0 && (
            <Card className="flex flex-col gap-3.5 p-5 md:p-6">
              <CardTitle eyebrow="Direct · tempo de resposta" title="Quanto você demora" />
              {histogram.map((h) => (
                <HBar key={h.bucket} label={h.bucket} value={h.count} max={maxHist} />
              ))}
            </Card>
          )}
        </section>

        <div className="eyebrow flex flex-wrap items-center gap-1.5">
          {ig.fetchedAt ? `Dados do Instagram atualizados ${timeAgo(ig.fetchedAt)} ·` : "Dados do Instagram ainda não carregados ·"}
          <RefreshButton days={days} />
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="eyebrow pt-2">{children}</h2>;
}

function AudienceRow({ dot, label, sub, value }: { dot: string; label: string; sub: string; value?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={clsx("mt-1.5 size-[7px] shrink-0 rounded-full", dot)} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
      {value && <span className="shrink-0 font-mono text-[11px] text-muted">{value}</span>}
    </li>
  );
}
