import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { ChannelIcon } from "@/components/channel-icon";
import { PageHeader } from "@/components/page-header";
import { Badge, Button } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getConnection } from "@/lib/account";
import { listAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { BackupCodes, ButtonsToggle, ChangePassword, CopyButton, KillSwitch, LimitsForm, Sessions, SignOutButton, TestWebhookButton, WipeHistory } from "../controls";
import { Line, type Section, SECTIONS, SettingsCard, SettingsMenu } from "../ui";

const AUDIT_LABELS: Record<string, string> = {
  login: "Login + 2FA",
  automacoes_pausadas: "Automações pausadas",
  automacoes_ligadas: "Automações ligadas",
  limites_alterados: "Limites alterados",
  botoes_dm_ligados: "Botões no Direct ligados",
  botoes_dm_desligados: "Botões no Direct desligados",
  historico_apagado: "Histórico apagado",
  "2fa_ativado": "2FA ativado",
  senha_alterada: "Senha trocada no painel",
  senha_redefinida: "Senha redefinida pelo terminal",
  senha_redefinida_2fa: "Senha redefinida com código 2FA",
};

export default async function SecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const user = await requireUser();
  const { secao } = await params;
  if (!(secao in SECTIONS)) notFound();
  const section = secao as Section;

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-bg md:flex-row">
        <SettingsMenu active={section} />
        <div className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-10 pt-6 md:pl-6 md:pr-10 md:pt-7">
          <h2 className="flex items-center gap-2.5 text-2xl font-bold">
            {section === "instagram" && <ChannelIcon size={28} />}
            {SECTIONS[section]}
          </h2>
          {section === "instagram" && <Instagram userId={user.id} />}
          {section === "geral" && <Geral userId={user.id} email={user.email} />}
          {section === "limites" && <Limites userId={user.id} />}
          {section === "seguranca" && <Seguranca />}
          {section === "registros" && <Registros userId={user.id} />}
          {section === "dados" && <Dados />}
        </div>
      </div>
    </>
  );
}

async function Instagram({ userId }: { userId: string }) {
  const c = await getConnection(userId);
  if (!c) {
    return (
      <SettingsCard>
        <Line label="Conta" action={<Badge status="erro">Não conectada</Badge>} help="Conecte a conta Instagram no painel da Zernio e rode `pnpm db:seed`." />
      </SettingsCard>
    );
  }
  const healthy = c.health === "healthy";
  const recentWebhook = c.recentWebhook;
  return (
    <>
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-surface p-5 md:p-7">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#fdda75,#fa7e1e_35%,#d62976_65%,#962fbf)]">
          <Avatar src={c.picture} name={c.username} size={52} className="border-2 border-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">@{c.username}</p>
          <p className="text-[13px] text-muted">Instagram · conectada pela Zernio</p>
        </div>
        <Badge status={healthy ? "sucesso" : "erro"}>{healthy ? "Saudável" : "Precisa de atenção"}</Badge>
      </div>
      <SettingsCard>
        <Line
          label="Status da conexão"
          action={
            <Badge status={c.tokenValid === false ? "erro" : "sucesso"}>
              {c.tokenValid === false
                ? "Token expirado"
                : c.tokenDaysLeft !== null
                  ? `Token válido · ${c.tokenDaysLeft} dias`
                  : "Token válido"}
            </Badge>
          }
          help="A Zernio renova o token sozinha. Se cair, a automação pausa e os comentários ficam na fila por até 7 dias."
        />
        <Line
          label="Webhook"
          action={<Badge status={recentWebhook ? "sucesso" : "alerta"}>{recentWebhook ? "Recebendo" : "Sem eventos recentes"}</Badge>}
          help={c.lastWebhookAt ? `Último evento ${timeAgo(c.lastWebhookAt)} · assinatura HMAC verificada.` : "Nenhum evento recebido ainda."}
        />
        <Line label="Endereço do webhook" action={<CopyButton text={c.webhookUrl} />} help={<span className="break-all">{c.webhookUrl}</span>} />
        <Line label="Testar" action={<TestWebhookButton />} help="Pede para a Zernio enviar um evento assinado e confere se o app está recebendo." />
        <Line
          label="Botões no Direct"
          action={<ButtonsToggle allowed={c.buttonsAllowed} />}
          help="Desligado por padrão: o Instagram pode recusar botão para quem não te segue, e a mensagem se perde. Se isso acontecer, o app desliga sozinho."
        />
        <Line
          label="Permissões"
          action={
            <span className="text-[13px]">
              {c.permissions.filter((p) => p.granted).length}/{c.permissions.length || "—"} concedidas
            </span>
          }
          help={c.permissions.map((p) => `${p.granted ? "✓" : "✗"} ${p.scope}`).join(" · ") || "Não foi possível consultar agora."}
        />
        <Line
          label="Alterar conexão"
          action={
            <a href="https://zernio.com/dashboard" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" icon={<ExternalLink className="size-4" />}>
                Abrir na Zernio
              </Button>
            </a>
          }
          help="Para trocar de conta ou reconectar, use o painel da Zernio. O app detecta a conta sozinho."
        />
      </SettingsCard>
    </>
  );
}

async function Geral({ userId, email }: { userId: string; email: string }) {
  const s = await getSettings(userId);
  return (
    <SettingsCard>
      <Line
        label="Automações ligadas"
        action={<KillSwitch enabled={s?.automationEnabled ?? true} />}
        help="Desligue para pausar todos os envios. Os comentários continuam chegando e ficam na fila por até 7 dias."
      />
      <Line label="Fuso horário" action={<span className="text-sm font-medium">São Paulo (GMT-3)</span>} help="Usado no histórico, nos gráficos e no mapa de horários." />
      <Line label="E-mail do painel" action={<span className="truncate text-sm font-medium">{email}</span>} help="Definido em PAINEL_EMAIL. Para trocar, altere o env e rode pnpm db:seed." />
    </SettingsCard>
  );
}

async function Limites({ userId }: { userId: string }) {
  const s = await getSettings(userId);
  return (
    <SettingsCard>
      <LimitsForm
        values={{
          perUserDailyCap: s?.perUserDailyCap ?? 3,
          outboundHourlyBudget: s?.outboundHourlyBudget ?? 600,
          monthlyDmBudget: s?.monthlyDmBudget ?? 10000,
        }}
      />
    </SettingsCard>
  );
}

function Seguranca() {
  return (
    <SettingsCard>
      <Line label="Verificação em duas etapas" action={<Badge status="sucesso">Ativa</Badge>} help="App autenticador (TOTP). Obrigatória para entrar." />
      <Line label="Códigos de backup" action={<BackupCodes />} help="Gerar novos invalida os antigos. Eles aparecem uma única vez." />
      <Line label="Senha" action={<ChangePassword />} help="Encerra as outras sessões. Esqueceu? Use “Esqueci a senha” na tela de login, com o código 2FA." />
      <Line label="Sessões ativas" action={<Sessions />} />
      <Line label="Sair" action={<SignOutButton />} help="Encerra a sessão deste navegador." />
    </SettingsCard>
  );
}

async function Registros({ userId }: { userId: string }) {
  const rows = await listAudit(userId);
  return (
    <>
      <SettingsCard>
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">Nenhum registro ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-5 py-3 font-medium">Quando</th>
                <th className="py-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-5 py-3 text-[13px] text-muted md:text-sm">{r.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                  <td className="py-3 font-medium">{AUDIT_LABELS[r.action] ?? r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SettingsCard>
      <p className="text-xs text-muted">IPs são guardados só como hash. Os 100 registros mais recentes.</p>
    </>
  );
}

function Dados() {
  return (
    <SettingsCard>
      <Line label="Retenção do histórico" action={<Badge status="neutro">90 dias</Badge>} help="Comentários, logs e cliques são apagados automaticamente depois de 90 dias (LGPD)." />
      <Line
        label="Exportar histórico"
        action={
          <a href="/api/exportar/historico?periodo=90d">
            <Button variant="secondary">Baixar CSV</Button>
          </a>
        }
        help="Eventos dos últimos 90 dias, sem o texto completo dos comentários."
      />
      <Line
        label="Exportar automações"
        action={
          <a href="/api/exportar/automacoes">
            <Button variant="secondary">Baixar JSON</Button>
          </a>
        }
        help="Palavras, materiais e respostas, para backup."
      />
      <Line label="Apagar histórico agora" action={<WipeHistory />} help="Remove todos os eventos. As automações continuam." />
    </SettingsCard>
  );
}
