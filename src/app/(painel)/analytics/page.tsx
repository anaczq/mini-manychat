import clsx from "clsx";
import { BarChart3, Check, Clock, Link2, Reply, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BarsChart, HBar, LineChart } from "@/components/charts";
import { Card, StatCard } from "@/components/ui";
import { getAutomationAnalytics, getInstagramAnalytics, RANGES, sameMoment, type RangeDays } from "@/lib/analytics";
import { compact, delta, int, pct, rate, seconds, timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { RefreshButton } from "./refresh";

const HEAT = ["#e6f0fc", "#b3d1f7", "#73a9ee", "#2e7fe6", "#006be2"];
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const GENDER: Record<string, string> = { F: "Mulheres", M: "Homens", U: "Não informado" };

function ratio(a: number, b: number) {
  return b ? (a / b) * 100 : 0;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const days: RangeDays = RANGES.includes(Number(sp.dias) as RangeDays) ? (Number(sp.dias) as RangeDays) : 30;
  const [a, ig] = await Promise.all([getAutomationAnalytics(user.id, days), getInstagramAnalytics(user.id, days)]);
  const { cur, prev } = a;

  const funnel = [
    ["Comentários recebidos", cur.received],
    ["Com palavra-chave", cur.matched],
    ["DM enviado", cur.sent],
    ["DM lido", cur.read],
    ["Clicou no link", cur.clicked],
    ["Respondeu o DM", cur.replied],
  ] as const;
  const top = Math.max(1, cur.received);
  const maxHeat = Math.max(1, ...a.heat.flat());
  const peak = (() => {
    let best = { d: -1, b: -1, n: 0 };
    a.heat.forEach((row, d) => row.forEach((n, b) => n > best.n && (best = { d, b, n })));
    return best.n ? `${DAYS[best.d]}, ${best.b * 3}h–${best.b * 3 + 3}h` : null;
  })();

  const t = ig.dashboard?.totals ?? {};
  const pt = ig.dashboard?.previousTotals ?? {};
  const ages = ig.demographics?.demographics?.age ?? [];
  const maxAge = Math.max(1, ...ages.map((x) => x.value));
  const gender = [...(ig.demographics?.demographics?.gender ?? [])].sort((x, y) => y.value - x.value);
  const genderTotal = gender.reduce((s, g) => s + g.value, 0);
  const cities = [...(ig.demographics?.demographics?.city ?? [])].sort((x, y) => y.value - x.value).slice(0, 5);
  const maxCity = Math.max(1, ...cities.map((c) => c.value));
  const inbox = ig.inboxVolume?.summary ?? {};
  const response = ig.inboxResponse?.summary;
  const histogram = ig.inboxResponse?.histogram ?? [];
  const maxHist = Math.max(1, ...histogram.map((h) => h.count));
  const onlinePeak = ig.online.length ? ig.online.indexOf(Math.max(...ig.online)) : -1;
  const maxOnline = Math.max(1, ...ig.online);
  const f = ig.followers;
  // Alcance e engajamento de cada post vêm da Zernio, casados pela data de publicação.
  const postReach = (postedAt: Date | null) => {
    const z = postedAt ? ig.zernioPosts.find((p) => p.publishedAt && sameMoment(postedAt, new Date(p.publishedAt))) : undefined;
    return z?.metrics;
  };

  return (
    <>
      <PageHeader
        title="Analytics"
        actions={
          <div className="flex overflow-hidden rounded-md border border-border bg-surface">
            {RANGES.map((r) => (
              <Link key={r} href={`/analytics?dias=${r}`} className={clsx("px-2 py-2 text-xs font-medium sm:px-3 sm:text-[13px]", r === days ? "bg-border text-ink" : "text-muted")}>
                {r} dias
              </Link>
            ))}
          </div>
        }
      />
      <div className="flex flex-col gap-7 bg-bg px-4 py-6 md:px-10 md:py-7">
        {cur.received === 0 ? (
          <EmptyState icon={<BarChart3 />} title={`Sem comentários nos últimos ${days} dias`}>
            O funil, as taxas e o mapa de horários aparecem quando chegarem comentários nos posts com automação ligada.
          </EmptyState>
        ) : (
          <>
          {/* Funil */}
          <Section title="Funil da automação" sub={`· ${days} dias`}>
            <Card className="flex flex-col gap-3.5 p-5 md:p-6">
              {funnel.map(([label, n], i) => (
                <div key={label} className="grid grid-cols-[100px_1fr_40px] items-center gap-2 md:grid-cols-[190px_1fr_64px_56px] md:gap-4">
                  <span className="text-xs font-medium leading-tight md:text-sm">{label}</span>
                  <div className="h-6 rounded bg-subtle md:h-7">
                    <div className="h-full rounded bg-primary" style={{ width: `${Math.max(n ? 1.5 : 0, (n / top) * 100)}%` }} />
                  </div>
                  <span className="text-right text-sm font-bold">{int(n)}</span>
                  <span className="hidden text-[13px] text-muted md:block">{i ? pct(n, funnel[i - 1][1]) : ""}</span>
                </div>
              ))}
              <p className="text-xs text-muted">% em relação à etapa anterior · “Lido” é estimativa mínima: DMs em Solicitações podem não avisar leitura.</p>
            </Card>
          </Section>

          {/* Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={<Send />} label="Taxa de sucesso do DM" value={pct(cur.sent, cur.sent + cur.failed)} hint={delta(ratio(cur.sent, cur.sent + cur.failed), ratio(prev.sent, prev.sent + prev.failed), "pp")} />
            <StatCard icon={<Check />} label="Taxa de leitura" value={cur.sent ? `≥ ${pct(cur.read, cur.sent)}` : "—"} hint={delta(ratio(cur.read, cur.sent), ratio(prev.read, prev.sent), "pp")} />
            <StatCard icon={<Link2 />} label="Taxa de clique" value={pct(cur.clicked, cur.sent)} hint={delta(ratio(cur.clicked, cur.sent), ratio(prev.clicked, prev.sent), "pp")} />
            <StatCard icon={<Reply />} label="Conversas iniciadas" value={int(cur.replied)} hint={delta(cur.replied, prev.replied)} />
            <StatCard icon={<Clock />} label="Tempo até o DM" value={seconds(cur.p50)} hint={cur.p95 ? `p95: ${seconds(cur.p95)}` : "—"} neutral />
            <StatCard icon={<ShieldCheck />} label="Bloqueados (anti-spam)" value={int(cur.blocked)} hint="duplicados e flood" neutral />
          </div>

          {/* DMs por dia */}
          <Section title="DMs enviados por dia">
            <Card className="p-5 md:p-6">
              <BarsChart data={a.daily.map((d) => ({ day: d.day, n: d.n }))} unit="DMs" label={`DMs enviados por dia nos últimos ${days} dias`} />
            </Card>
          </Section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_470px]">
            {/* Por palavra */}
            <Section title="Por palavra-chave">
              <div className="overflow-x-auto rounded-lg bg-surface shadow-[0_1px_2px_rgba(35,43,57,0.18)]">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-right">
                      <th className="px-4 py-3 text-left font-medium">Palavra</th>
                      <th className="py-3 font-medium">Enviados</th>
                      <th className="py-3 font-medium">Lidos</th>
                      <th className="py-3 font-medium">Cliques</th>
                      <th className="px-4 py-3 font-medium">Conversas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.byKeyword.map((k) => (
                      <tr key={k.id} className="border-t border-subtle text-right">
                        <td className="px-4 py-3.5 text-left">
                          <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary">{k.term}</span>
                        </td>
                        <td className="py-3.5 font-semibold">{int(k.sent)}</td>
                        <td className="py-3.5">{k.sent ? `≥ ${pct(k.read, k.sent)}` : "—"}</td>
                        <td className="py-3.5">{pct(k.clicked, k.sent)}</td>
                        <td className="px-4 py-3.5">{int(k.replied)}</td>
                      </tr>
                    ))}
                    {a.byKeyword.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted">
                          Nenhuma automação ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Heatmap */}
            <Section title="Quando comentam" sub="· comentários com palavra">
              <Card className="flex flex-col gap-1 p-5">
                <div className="ml-9 grid grid-cols-8 gap-[3px] text-center text-[10px] text-muted">
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                    <span key={h}>{h}h</span>
                  ))}
                </div>
                {a.heat.map((row, d) => (
                  <div key={d} className="flex items-center gap-[3px]">
                    <span className="w-9 shrink-0 text-[11px] text-muted">{DAYS[d]}</span>
                    <div className="grid flex-1 grid-cols-8 gap-[3px]">
                      {row.map((n, b) => (
                        <span
                          key={b}
                          title={`${DAYS[d]} ${b * 3}h–${b * 3 + 3}h: ${n}`}
                          className="h-6 rounded"
                          style={{ background: HEAT[n ? Math.min(4, Math.ceil((n / maxHeat) * 4)) : 0] }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted">
                  Menos
                  {HEAT.map((c) => (
                    <span key={c} className="h-2.5 w-3.5 rounded-sm" style={{ background: c }} />
                  ))}
                  Mais
                </div>
                <p className="text-xs font-medium">{peak ? `Pico: ${peak}` : "Ainda sem comentários suficientes."}</p>
                {ig.online.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-subtle pt-3">
                    <p className="text-xs font-semibold">
                      Seguidores online por hora <span className="font-normal text-muted">· média diária, Instagram</span>
                    </p>
                    <div className="flex h-14 items-end gap-[2px]" role="img" aria-label="Seguidores online por hora do dia">
                      {ig.online.map((n, h) => (
                        <span key={h} title={`${h}h: ${int(n)}`} className={clsx("flex-1 rounded-t", h === onlinePeak ? "bg-primary" : "bg-primary/40")} style={{ height: `${(n / maxOnline) * 100}%` }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted">
                      <span>0h</span>
                      <span>12h</span>
                      <span>23h</span>
                    </div>
                    <p className="text-xs font-medium">
                      Mais gente online às {onlinePeak}h ({int(ig.online[onlinePeak])}) <span className="font-normal text-muted">· fuso informado pela Meta</span>
                    </p>
                  </div>
                )}
              </Card>
            </Section>
          </div>

          {/* Por post */}
          {a.byPost.length > 0 && (
            <Section title="Posts que mais geram leads">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {a.byPost.map((p) => (
                  <Card key={p.postId} className="overflow-hidden">
                    <div className="aspect-square bg-subtle">{p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />}</div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-xs font-medium">{p.caption || "Post"}</p>
                      <p className="text-[11px] text-muted">
                        {p.matched} com palavra · {p.sent} DMs · {p.clicked} cliques
                      </p>
                      {postReach(p.postedAt) && (
                        <p className="truncate text-[11px] text-muted">
                          {compact(postReach(p.postedAt)!.reach)} alcance · {rate(postReach(p.postedAt)!.engagementRate)} eng.
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}
          </>
        )}

        {/* Instagram */}
        <Section title="Instagram" sub="· dados da Zernio · até 48 h de atraso">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Alcance" value={compact(ig.insights?.metrics?.reach?.total)} />
            <StatCard label="Visualizações" value={compact(ig.insights?.metrics?.views?.total)} />
            <StatCard label="Contas engajadas" value={compact(ig.insights?.metrics?.accounts_engaged?.total)} />
            <StatCard label="Interações" value={compact(ig.insights?.metrics?.total_interactions?.total)} />
            <StatCard label="Taxa de engajamento" value={rate(t.engagementRate)} hint={t.engagementRate !== undefined && pt.engagementRate !== undefined ? delta(t.engagementRate, pt.engagementRate, "pp") : undefined} />
            <StatCard
              label="Seguidores"
              value={compact(f.current)}
              hint={f.gained !== undefined || f.lost !== undefined ? `+${int(f.gained ?? 0)} / −${int(f.lost ?? 0)} no período` : undefined}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["Curtidas", "likes"],
                ["Comentários", "comments"],
                ["Compartilhamentos", "shares"],
                ["Salvamentos", "saves"],
              ] as const
            ).map(([label, k]) => (
              <StatCard key={k} label={label} value={compact(t[k])} hint={t[k] !== undefined && pt[k] !== undefined ? `${delta(t[k], pt[k])} vs. anterior` : undefined} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="p-4 md:p-5">
              <p className="mb-3 text-sm font-semibold">Alcance por dia</p>
              {ig.daily.length ? <BarsChart data={ig.daily.map((d) => ({ day: d.date, n: d.reach ?? 0 }))} unit="contas" label="Alcance por dia" /> : <p className="text-sm text-muted">Sem dados ainda.</p>}
            </Card>
            <Card className="p-4 md:p-5">
              <p className="mb-3 text-sm font-semibold">
                Seguidores <span className="text-xs font-normal text-muted">· desde a conexão na Zernio</span>
              </p>
              {f.series.length > 1 ? <LineChart data={f.series} /> : <p className="text-sm text-muted">A série aparece depois de alguns dias de conexão.</p>}
            </Card>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
            <Card className="p-4 md:p-5">
              <p className="mb-3 text-sm font-semibold">Top posts por engajamento</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
                {ig.topPosts.map((p, i) => (
                  <a key={i} href={p.permalink ?? undefined} target="_blank" rel="noreferrer" className="flex flex-col gap-1">
                    <div className="aspect-square overflow-hidden rounded-md bg-subtle">
                      {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <p className="line-clamp-1 text-xs font-medium">{p.caption || "Post"}</p>
                    <p className="truncate text-[11px] text-muted">{int(p.interactions)} interações</p>
                    <p className="truncate text-[11px] text-muted">
                      {compact(p.reach)} alcance · {rate(p.engagementRate)}
                    </p>
                  </a>
                ))}
                {ig.topPosts.length === 0 && <p className="col-span-full text-sm text-muted">Sem dados ainda.</p>}
              </div>
            </Card>
            <Card className="flex flex-col gap-2.5 p-4 md:p-5">
              <p className="text-sm font-semibold">Público por idade</p>
              {ages.map((x) => (
                <HBar key={x.dimension} label={x.dimension} value={x.value} max={maxAge} />
              ))}
              {genderTotal > 0 && (
                <>
                  <p className="mt-2 text-sm font-semibold">Gênero</p>
                  <div className="flex h-3.5 overflow-hidden rounded">
                    {gender.map((g, i) => (
                      <span key={g.dimension} className={["bg-primary", "bg-primary/50", "bg-border"][i] ?? "bg-subtle"} style={{ width: `${(g.value / genderTotal) * 100}%` }} />
                    ))}
                  </div>
                  <p className="text-xs text-muted">{gender.map((g) => `${GENDER[g.dimension] ?? g.dimension} ${pct(g.value, genderTotal)}`).join(" · ")}</p>
                </>
              )}
              {cities.length > 0 && (
                <>
                  <p className="mt-2 text-sm font-semibold">Cidades</p>
                  {cities.map((c) => (
                    <HBar key={c.dimension} label={c.dimension.split(",")[0]} value={c.value} max={maxCity} wide />
                  ))}
                </>
              )}
            </Card>
          </div>
        </Section>

        {/* Direct */}
        <Section title="Direct" sub="· dados da Zernio">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Mensagens recebidas" value={int(inbox.received ?? 0)} />
            <StatCard label="Mensagens enviadas" value={int(inbox.sent ?? 0)} />
            <StatCard label="Lidas" value={int(inbox.read ?? 0)} />
            <StatCard label="Falhas" value={int(inbox.failed ?? 0)} />
            <StatCard label="Conversas únicas" value={int(inbox.uniqueConversations ?? 0)} />
            <StatCard
              label="Tempo de resposta (mediana)"
              value={seconds(response?.sampleSize ? response.medianSeconds : null)}
              hint={response?.sampleSize ? `p90: ${seconds(response.p90Seconds)} · ${int(response.sampleSize)} respostas` : undefined}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="p-4 md:p-5">
              <p className="mb-3 text-sm font-semibold">Mensagens recebidas por dia</p>
              {ig.inboxVolume?.timeseries?.length ? (
                <BarsChart data={ig.inboxVolume.timeseries.map((d) => ({ day: d.date, n: d.received ?? 0 }))} unit="mensagens" label="Mensagens recebidas por dia" />
              ) : (
                <p className="text-sm text-muted">Sem dados ainda.</p>
              )}
            </Card>
            <Card className="flex flex-col gap-2.5 p-4 md:p-5">
              <p className="text-sm font-semibold">Quanto você demora para responder</p>
              {histogram.map((h) => (
                <HBar key={h.bucket} label={h.bucket} value={h.count} max={maxHist} />
              ))}
              {histogram.length === 0 && <p className="text-sm text-muted">Sem dados ainda.</p>}
            </Card>
          </div>
        </Section>

        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <BarChart3 className="size-3.5" />
          {ig.fetchedAt ? `Dados do Instagram atualizados ${timeAgo(ig.fetchedAt)} ·` : "Dados do Instagram ainda não carregados ·"}
          <RefreshButton days={days} />
        </p>
      </div>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold">
        {title} {sub && <span className="text-xs font-normal text-muted">{sub}</span>}
      </h2>
      {children}
    </section>
  );
}

