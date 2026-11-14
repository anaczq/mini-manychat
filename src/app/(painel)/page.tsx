import clsx from "clsx";
import { ChevronRight, Image as ImageIcon, Link2, MessageCircle, Plus, Reply, Send } from "lucide-react";
import Link from "next/link";
import { NewAutomationButton } from "@/components/automations/template-chooser";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { Sparkline } from "@/components/sparkline";
import { Button, Card, KeywordChip } from "@/components/ui";
import { getDashboard } from "@/lib/dashboard";
import { int, pct, timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { RowToggle } from "./automacoes/row-actions";

const TONES = {
  blue: { text: "text-accent-blue", soft: "bg-accent-blue-soft", hex: "#1f7bf2", bar: "bg-accent-blue" },
  green: { text: "text-accent-green", soft: "bg-accent-green-soft", hex: "#17a86b", bar: "bg-accent-green" },
  orange: { text: "text-accent-orange", soft: "bg-accent-orange-soft", hex: "#f28a1d", bar: "bg-accent-orange" },
} as const;

const STATUS_DOT = { sucesso: "bg-accent-green", info: "bg-accent-blue", alerta: "bg-accent-orange", erro: "bg-error", neutro: "bg-muted" } as const;

const AVATAR_TONES = [TONES.blue, TONES.green, TONES.orange];

export default async function InicioPage() {
  const user = await requireUser();
  const d = await getDashboard(user.id);
  // Sem arredondar: 20 de 10.000 é 0,2% (não "0%"), e a barra mostra um traço assim que há uso.
  const quotaPct = Math.min(100, (d.quota.used / d.quota.limit) * 100);
  const now = new Date();
  const daysLeft = Math.ceil((new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - now.getTime()) / 86400_000);

  const kpis = [
    { key: "matched", label: "Comentários com palavra", icon: MessageCircle, tone: TONES.blue, ...d.kpis.matched },
    { key: "sent", label: "DMs enviados", icon: Send, tone: TONES.green, ...d.kpis.sent },
    { key: "clicks", label: "Cliques no material", icon: Link2, tone: TONES.orange, ...d.kpis.clicks },
  ];

  const status = d.paused
    ? { text: "Automações pausadas", cls: "bg-error-soft text-error", dot: "bg-error" }
    : !d.healthy
      ? { text: "Conexão com o Instagram precisa de atenção", cls: "bg-warning-soft text-warning", dot: "bg-warning" }
      : d.activeCount
        ? { text: `${d.activeCount} ${d.activeCount === 1 ? "automação ligada" : "automações ligadas"} · tudo funcionando`, cls: "bg-accent-green-soft text-accent-green", dot: "bg-accent-green" }
        : { text: "Nenhuma automação ligada", cls: "bg-subtle text-muted", dot: "bg-muted" };

  return (
    <>
      <PageHeader
        title="Inicial"
        actions={
          <NewAutomationButton>
            <Button icon={<Plus className="size-4" />} aria-label="Nova automação">
              <span className="hidden sm:inline">Nova automação</span>
            </Button>
          </NewAutomationButton>
        }
      />

      <div className="flex flex-col gap-7 px-4 py-6 md:px-10 md:py-8">
        <section className="flex flex-wrap items-center gap-4">
          <div className="min-w-[220px] flex-1">
            <h2 className="text-2xl font-bold md:text-[30px]">Olá, {user.name.split(" ")[0]} 👋</h2>
            <p className="mt-1.5 text-[15px] text-muted">
              {d.weekResponses
                ? `Suas automações enviaram ${int(d.weekResponses)} ${d.weekResponses === 1 ? "DM" : "DMs"} nos últimos 7 dias.`
                : "Quando alguém comentar uma palavra-chave, os números aparecem aqui."}
            </p>
          </div>
          <span className={clsx("inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold", status.cls)}>
            <span className={clsx("size-2 rounded-full", status.dot)} />
            {status.text}
          </span>
        </section>

        <section className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-[1fr_1fr_1fr_280px]">
          {kpis.map((k) => (
            <Card key={k.key} className="flex flex-col gap-3.5 p-4 md:p-5">
              <div className="flex items-center gap-2.5">
                <span className={clsx("grid size-9 shrink-0 place-items-center rounded-[10px]", k.tone.soft)}>
                  <k.icon className={clsx("size-[18px]", k.tone.text)} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 text-[13px] font-medium leading-tight text-muted md:text-sm">{k.label}</span>
              </div>
              <div className="flex flex-wrap items-end gap-2.5">
                <span className="text-[28px] font-bold leading-none md:text-[32px]">{int(k.value)}</span>
                <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", k.tone.soft, k.tone.text)}>{k.delta}</span>
              </div>
              <div className="hidden md:block">
                <Sparkline points={k.series} color={k.tone.hex} label={`${k.label} por dia nos últimos 7 dias`} />
              </div>
            </Card>
          ))}
          <div className="flex flex-col gap-3 rounded-xl bg-accent-blue-soft p-4 md:p-5">
            <span className="text-sm font-medium text-muted">Cota do mês na Zernio</span>
            <div className="flex items-end gap-1.5">
              <span className="text-[28px] font-bold leading-none md:text-[32px]">{int(d.quota.used)}</span>
              <span className="text-sm text-muted">/ {int(d.quota.limit)} DMs</span>
            </div>
            <div className="h-2 rounded-full bg-white" role="progressbar" aria-valuenow={Math.round(quotaPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Cota do mês usada">
              <div className={clsx("h-2 rounded-full", quotaPct >= 80 ? "bg-accent-orange" : "bg-accent-blue")} style={{ width: `${quotaPct}%`, minWidth: d.quota.used ? 8 : 0 }} />
            </div>
            <span className="text-xs text-muted">
              {quotaPct > 0 && quotaPct < 0.1 ? "< 0,1%" : pct(Math.min(d.quota.used, d.quota.limit), d.quota.limit)} usado · renova em {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
            </span>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
          <Card className="overflow-hidden">
            <div className="flex items-center px-5 pb-3 pt-[18px]">
              <h3 className="flex-1 text-base font-bold">Atividade recente</h3>
              <Link href="/historico" className="text-[13px] font-semibold text-accent-blue">
                Ver histórico →
              </Link>
            </div>
            {d.recent.length === 0 ? (
              <p className="border-t border-line px-5 py-10 text-center text-sm text-muted">Nenhum comentário com palavra-chave ainda.</p>
            ) : (
              <ul>
                {d.recent.map((a, i) => {
                  const t = AVATAR_TONES[i % 3];
                  return (
                    <li key={a.id} className="flex items-center gap-3 border-t border-line px-5 py-3">
                      {a.picture ? (
                        <Avatar src={a.picture} name={a.username} size={36} />
                      ) : (
                        <span className={clsx("grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold", t.soft, t.text)}>
                          {a.username[0]?.toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{a.username}</span>
                          {a.keyword && <KeywordChip>{a.keyword}</KeywordChip>}
                        </div>
                        <p className="truncate text-[13px] text-muted">{a.text}</p>
                      </div>
                      <span className="hidden items-center gap-1.5 text-[13px] font-medium sm:flex">
                        <span className={clsx("size-2 rounded-full", STATUS_DOT[a.tone])} />
                        {a.status}
                      </span>
                      <span className="shrink-0 text-right text-xs text-muted sm:w-[76px]">{timeAgo(a.at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden">
              <div className="flex items-center px-5 pb-3 pt-[18px]">
                <h3 className="flex-1 text-base font-bold">Suas automações</h3>
                <Link href="/automacoes" className="text-[13px] font-semibold text-accent-blue">
                  Ver todas →
                </Link>
              </div>
              {d.automations.length === 0 ? (
                <p className="border-t border-line px-5 py-6 text-sm text-muted">Nenhuma automação ligada.</p>
              ) : (
                <ul>
                  {d.automations.map((a, i) => (
                    <li key={a.id} className="flex items-center gap-3 border-t border-line px-5 py-3">
                      <span className={clsx("h-8 w-1 rounded-full", [TONES.blue, TONES.green, TONES.orange][i].bar)} />
                      <Link href={`/automacoes/${a.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{a.name}</p>
                        <p className="text-xs text-muted">
                          {a.week} {a.week === 1 ? "disparo" : "disparos"} esta semana
                        </p>
                      </Link>
                      <RowToggle id={a.id} name={a.name} active={a.active} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="pb-2">
              <h3 className="px-5 pb-3 pt-[18px] text-base font-bold">Comece rápido</h3>
              {[
                { icon: Link2, title: "Link por DM", sub: "Palavra no comentário → link", tone: TONES.blue, tpl: "link" },
                { icon: ImageIcon, title: "Entregar imagem", sub: "Vai como anexo quando a pessoa responder", tone: TONES.green, tpl: "arquivo" },
                { icon: Reply, title: "Só responder o comentário", sub: "Resposta pública aleatória", tone: TONES.orange, tpl: "resposta" },
              ].map(({ icon: Icon, title, sub, tone, tpl }) => (
                <Link key={tpl} href={`/automacoes/nova?modelo=${tpl}`} className="flex items-center gap-3 px-5 py-2 hover:bg-bg">
                  <span className={clsx("grid size-9 place-items-center rounded-[10px]", tone.soft)}>
                    <Icon className={clsx("size-[18px]", tone.text)} strokeWidth={1.75} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted">{sub}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted" />
                </Link>
              ))}
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
