import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { NewAutomationButton } from "@/components/automations/template-chooser";
import { PageHeader } from "@/components/page-header";
import { Button, buttonClass, Card, CardTitle, StatCard } from "@/components/ui";
import { getDashboard } from "@/lib/dashboard";
import { int, pct, shortAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";

const STATUS_DOT = { sucesso: "bg-success", info: "bg-primary", alerta: "bg-warning", erro: "bg-error", neutro: "bg-tertiary" } as const;

const TEMPLATES = [
  { letter: "L", title: "Link por DM", tpl: "link" },
  { letter: "I", title: "Entregar imagem", tpl: "arquivo" },
  { letter: "R", title: "Só responder o comentário", short: "Só responder", tpl: "resposta" },
];

function plural(n: number, one: string, many: string) {
  return `${int(n)} ${n === 1 ? one : many}`;
}

export default async function InicioPage() {
  const user = await requireUser();
  const d = await getDashboard(user.id);
  const now = new Date();
  const daysLeft = Math.ceil((new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - now.getTime()) / 86400_000);
  const f = d.funnel;

  const summary = d.paused
    ? "Automações pausadas. Nenhum DM sai até você ligar de novo em Configurações."
    : !d.healthy
      ? "A conexão com o Instagram precisa de atenção. Confira em Configurações › Instagram."
      : !d.activeCount
        ? "Nenhuma automação ligada. Comece por um dos modelos abaixo."
        : [
            `${plural(d.activeCount, "automação ligada", "automações ligadas")} e tudo funcionando.`,
            f.sent ? `${plural(f.sent, "DM enviado", "DMs enviados")} na semana, ${pct(f.sent, f.attempted)} entregues.` : "Nenhum DM enviado esta semana.",
            f.sent ? (f.clicks ? `${plural(f.clicks, "clique", "cliques")} no material.` : "Ninguém clicou no material ainda.") : "",
          ]
            .filter(Boolean)
            .join(" ");

  const funnel = [
    { label: "Com palavra", value: f.matched },
    { label: "DMs enviados", value: f.attempted },
    { label: "DMs entregues", value: f.sent },
    { label: "Cliques no material", short: "Cliques", value: f.clicks },
  ];
  const oldest = d.recent.at(-1)?.at;
  const recentDays = oldest ? Math.max(1, Math.ceil((now.getTime() - oldest.getTime()) / 86400_000)) : 0;

  return (
    <>
      <PageHeader
        eyebrow="01 · Automação · Início"
        title={`Olá, ${user.name.split(" ")[0] || "você"}`}
        subtitle={
          d.weekResponses
            ? `Suas automações enviaram ${plural(d.weekResponses, "DM", "DMs")} nos últimos 7 dias.`
            : "Quando alguém comentar uma palavra-chave, os números aparecem aqui."
        }
        actions={
          <>
            <Link
              href="/configuracoes/instagram"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-secondary"
            >
              <span className={clsx("size-[7px] rounded-full", d.healthy ? "bg-success" : "bg-warning")} />
              {d.healthy ? "Instagram conectado" : "Instagram com problema"}
            </Link>
            <NewAutomationButton>
              <Button className="hidden md:inline-flex">+ Nova automação</Button>
            </NewAutomationButton>
          </>
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-5 pb-8 md:gap-5 md:px-12 md:pb-14">
        <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-primary-soft p-4 md:gap-5 md:p-6">
          <Image src="/marca/nooi-ola.png" alt="" width={72} height={72} className="size-12 object-contain md:size-[72px]" />
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <p className="eyebrow text-primary">Resumo do Nooi · hoje</p>
            <p className="text-[15px] leading-[1.35] font-medium md:text-lg">{summary}</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/historico" className={buttonClass("secondary", "px-3.5")}>
              Ver histórico
            </Link>
            <Link href="/automacoes" className={buttonClass("secondary", "px-3.5")}>
              Ver automações
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
          <StatCard label="Comentários com palavra" value={int(d.kpis.matched.value)} hint={`${d.kpis.matched.delta} vs. semana passada`} />
          <StatCard label="DMs enviados" value={int(d.kpis.sent.value)} hint={d.kpis.sent.delta} accent neutral />
          <StatCard label="Cliques no material" value={int(d.kpis.clicks.value)} hint={d.kpis.clicks.delta} neutral />
          <StatCard
            label="Cota do mês · Zernio"
            value={int(d.quota.used)}
            hint={`de ${int(d.quota.limit)} DMs · renova em ${plural(daysLeft, "dia", "dias")}`}
            neutral
          />
        </section>

        <section className="grid grid-cols-1 items-start gap-3 md:gap-5 lg:grid-cols-[1fr_360px]">
          <Card className="flex flex-col gap-3.5 p-5 md:p-6">
            <CardTitle eyebrow="Funil · últimos 7 dias" title="Do comentário ao clique" action={<Link href="/analytics">Analytics →</Link>} />
            {funnel.map((s) => {
              const width = f.matched ? Math.min(100, (s.value / f.matched) * 100) : 0;
              return (
                <div key={s.label} className="flex items-center gap-3.5">
                  <span className="w-[110px] shrink-0 truncate text-sm font-medium md:w-[150px]">
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
                    <div className="h-2.5 rounded-[5px] bg-primary" style={{ width: `${width}%` }} />
                  </div>
                  <span className="flex w-[70px] shrink-0 items-center justify-end gap-1.5">
                    <span className="text-sm font-semibold">{int(s.value)}</span>
                    <span className="hidden font-mono text-[11px] text-muted md:inline">{f.matched ? pct(s.value, f.matched) : "—"}</span>
                  </span>
                </div>
              );
            })}
            <p className="text-[13px] text-muted">
              {f.sent
                ? `${int(f.clicks)} de ${plural(f.sent, "DM virou", "DMs viraram")} clique.${f.clicks ? "" : " Vale testar o link mais cedo na mensagem."}`
                : "Quando os DMs saírem, o funil mostra quantos viraram clique."}
            </p>
          </Card>

          <Card className="flex flex-col gap-4 p-5 md:p-6">
            <CardTitle
              eyebrow={`Modelos · ${TEMPLATES.length}`}
              title="Comece rápido"
              action={
                <NewAutomationButton>
                  <button type="button" className="hidden md:inline">
                    Ver modelos →
                  </button>
                </NewAutomationButton>
              }
            />
            {TEMPLATES.map((t) => (
              <Link key={t.tpl} href={`/automacoes/nova?modelo=${t.tpl}`} className="group flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary-soft text-sm font-semibold text-primary">{t.letter}</span>
                <span className="flex-1 text-[13px] font-medium text-secondary group-hover:text-ink">
                  {t.short ? (
                    <>
                      <span className="md:hidden">{t.short}</span>
                      <span className="hidden md:inline">{t.title}</span>
                    </>
                  ) : (
                    t.title
                  )}
                </span>
                <span className="text-ink">→</span>
              </Link>
            ))}
            <p className="hidden text-xs text-muted md:block">Modelos prontos. Dá para mudar tudo depois.</p>
          </Card>

          <Card className="flex flex-col gap-4 p-5 md:p-6">
            <CardTitle eyebrow={`Automações · ${plural(d.activeCount, "ligada", "ligadas")}`} title="Suas automações" />
            {d.automations.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma automação ligada.</p>
            ) : (
              <>
                <table className="hidden w-full text-sm md:table">
                  <thead>
                    <tr className="eyebrow text-left">
                      <th className="pb-3 font-normal">Automação</th>
                      <th className="pb-3 text-right font-normal">Execuções</th>
                      <th className="pb-3 text-right font-normal">Enviados</th>
                      <th className="pb-3 text-right font-normal">Cliques</th>
                      <th className="pb-3 text-right font-normal">Erros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.automations.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="py-3.5 font-medium">
                          <Link href={`/automacoes/${a.id}`} className="hover:text-primary">
                            {a.name}
                          </Link>
                        </td>
                        <td className="py-3.5 text-right text-secondary">{int(a.week)}</td>
                        <td className="py-3.5 text-right">
                          <span className="font-semibold">{int(a.sent)}</span>{" "}
                          <span className="font-mono text-[11px] text-muted">{a.week ? pct(a.sent, a.week) : ""}</span>
                        </td>
                        <td className="py-3.5 text-right text-secondary">{int(a.clicks)}</td>
                        <td className={clsx("py-3.5 text-right", a.errors ? "text-error" : "text-secondary")}>{int(a.errors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  {d.automations.map((a) => (
                    <li key={a.id} className="border-t border-border py-3 first:border-t-0">
                      <Link href={`/automacoes/${a.id}`} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{a.name}</span>
                          <span className="text-xs text-muted">
                            {plural(a.week, "execução", "execuções")} · {a.week ? pct(a.sent, a.week) : "—"} enviados
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-semibold">{int(a.sent)}</span>
                          <span className="font-mono text-[11px] text-muted">disparos</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-4 p-5 md:p-6">
            <CardTitle eyebrow={recentDays ? `Histórico · últimos ${plural(recentDays, "dia", "dias")}` : "Histórico"} title="Atividade recente" />
            {d.recent.length === 0 ? (
              <p className="text-sm text-muted">Nenhum comentário com palavra-chave ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {d.recent.map((a) => (
                  <li key={a.id}>
                    <Link href="/historico" className="flex items-start gap-3">
                      <span className={clsx("mt-1.5 size-2 shrink-0 rounded-full", STATUS_DOT[a.tone])} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.username}</span>
                        <span className="block truncate text-xs text-muted">
                          → {a.status}
                          {a.keyword && ` · ${a.keyword.toUpperCase()}`}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{shortAgo(a.at, now)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
