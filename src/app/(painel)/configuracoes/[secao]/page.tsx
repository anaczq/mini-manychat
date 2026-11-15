import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, buttonClass } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getConnection } from "@/lib/account";
import { listAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import {
  AuditList,
  BackupCodes,
  ButtonsToggle,
  ChangePassword,
  CopyButton,
  KillSwitch,
  LimitsForm,
  SessionsCard,
  SignOutButton,
  TestWebhookButton,
  WipeHistory,
} from "../controls";
import { Line, MonoValue, NooiTip, type Section, SECTIONS, SettingsCard, SettingsHeader, SettingsTabs } from "../ui";

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

const TZ = "America/Sao_Paulo";

export default async function SecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const user = await requireUser();
  const { secao } = await params;
  if (!(secao in SECTIONS)) notFound();
  const section = secao as Section;

  return (
    <>
      <SettingsHeader section={section} />
      <div className="flex flex-col gap-5 px-4 pt-5 pb-8 md:gap-6 md:px-12 md:pt-6 md:pb-14">
        <SettingsTabs active={section} />
        <div className="grid max-w-[1096px] grid-cols-1 items-start gap-3 md:gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
          {section === "geral" && <Geral userId={user.id} email={user.email} />}
          {section === "seguranca" && <Seguranca />}
          {section === "registros" && <Registros userId={user.id} />}
          {section === "instagram" && <Instagram userId={user.id} />}
          {section === "limites" && <Limites userId={user.id} />}
          {section === "dados" && <Dados />}
        </div>
      </div>
    </>
  );
}

/** Coluna principal e coluna lateral da grade (no celular, a lateral vem depois). */
function Main({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-3 md:gap-5">{children}</div>;
}

function Side({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-3 md:gap-5">{children}</div>;
}

async function Geral({ userId, email }: { userId: string; email: string }) {
  const [s, c] = await Promise.all([getSettings(userId), getConnection(userId)]);
  return (
    <>
      <Main>
        <SettingsCard eyebrow="Painel" title="Geral">
          <Line
            label="Automações ligadas"
            help="Desligue para pausar todos os envios. Os comentários continuam chegando e ficam na fila por até 7 dias."
            action={<KillSwitch enabled={s?.automationEnabled ?? true} />}
          />
          <Line
            label="Fuso horário"
            help="Usado no histórico, nos gráficos e no mapa de horários."
            action={<span className="text-sm font-medium">São Paulo (GMT-3)</span>}
          />
          <Line
            label="E-mail do painel"
            help="Definido em PAINEL_EMAIL. Para trocar, altere o env e rode pnpm db:seed."
            action={<span className="block max-w-[160px] truncate text-sm font-medium sm:max-w-[260px]">{email}</span>}
          />
        </SettingsCard>
      </Main>
      <Side>
        <NooiTip pose="pensando">Pausar tudo não perde nada: os comentários ficam guardados e você retoma quando quiser.</NooiTip>
        {c && (
          <SettingsCard eyebrow="Instagram" title={`@${c.username}`}>
            <Line
              label="Conexão"
              action={<Badge status={c.health === "healthy" ? "sucesso" : "erro"}>{c.health === "healthy" ? "Saudável" : "Precisa de atenção"}</Badge>}
            />
            <Line
              label="Token"
              action={<MonoValue>{c.tokenValid === false ? "expirado" : c.tokenDaysLeft !== null ? `${c.tokenDaysLeft} dias` : "válido"}</MonoValue>}
            />
            <Line label="Último evento" action={<MonoValue>{c.lastWebhookAt ? timeAgo(c.lastWebhookAt) : "nenhum ainda"}</MonoValue>} />
          </SettingsCard>
        )}
      </Side>
    </>
  );
}

function Seguranca() {
  return (
    <>
      <Main>
        <SettingsCard eyebrow="Acesso" title="Entrar no painel">
          <Line label="Verificação em duas etapas" help="App autenticador (TOTP). Obrigatória para entrar." action={<Badge status="sucesso">Ativa</Badge>} />
          <Line label="Códigos de backup" help="Gerar novos invalida os antigos. Eles aparecem uma única vez." action={<BackupCodes />} />
          <Line label="Senha" help="Encerra as outras sessões. Esqueceu? Use “Esqueci a senha” na tela de login, com o código 2FA." action={<ChangePassword />} />
          <Line label="Sair" help="Encerra a sessão deste navegador." action={<SignOutButton />} />
        </SettingsCard>
        <SessionsCard />
      </Main>
      <Side>
        <NooiTip pose="orgulhoso">Guarde os códigos de backup fora do celular. Sem eles e sem o app, só pelo terminal.</NooiTip>
      </Side>
    </>
  );
}

async function Registros({ userId }: { userId: string }) {
  const rows = await listAudit(userId);
  const items = rows.map((r) => ({
    id: String(r.id),
    label: AUDIT_LABELS[r.action] ?? r.action,
    date: r.createdAt.toLocaleDateString("pt-BR", { timeZone: TZ }),
    time: r.createdAt.toLocaleTimeString("pt-BR", { timeZone: TZ }),
  }));
  return (
    <>
      <Main>
        <SettingsCard eyebrow={`Auditoria · ${items.length === 1 ? "1 registro" : `${items.length} registros`}`} title="Registros">
          {items.length === 0 ? <p className="border-t border-hairline py-6 text-center text-sm text-muted">Nenhum registro ainda.</p> : <AuditList rows={items} />}
        </SettingsCard>
        <p className="text-xs text-muted">IPs são guardados só como hash. Os 100 registros mais recentes.</p>
      </Main>
      <Side>
        <NooiTip pose="agenda">Cada login e cada mudança importante ficam registrados aqui.</NooiTip>
      </Side>
    </>
  );
}

async function Instagram({ userId }: { userId: string }) {
  const c = await getConnection(userId);
  if (!c) {
    return (
      <>
        <Main>
          <SettingsCard eyebrow="Instagram" title="Nenhuma conta">
            <Line label="Conta" help="Conecte a conta Instagram no painel da Zernio e rode `pnpm db:seed`." action={<Badge status="erro">Não conectada</Badge>} />
          </SettingsCard>
        </Main>
        <Side>
          <NooiTip pose="acenando">Conecte o Instagram na Zernio e eu começo a responder os comentários.</NooiTip>
        </Side>
      </>
    );
  }
  const healthy = c.health === "healthy" && c.tokenValid !== false;
  const granted = c.permissions.filter((p) => p.granted).length;
  const scopes = c.permissions.map((p) => `${p.granted ? "✓" : "✗"} ${p.scope}`).join(" · ");
  return (
    <>
      <Main>
        <SettingsCard eyebrow="Instagram · conectada pela Zernio" title={`@${c.username}`}>
          <Line
            label="Status da conexão"
            help="A Zernio renova o token sozinha. Se cair, a automação pausa e os comentários ficam na fila por até 7 dias."
            action={
              <Badge status={c.tokenValid === false ? "erro" : "sucesso"}>
                {c.tokenValid === false ? "Token expirado" : c.tokenDaysLeft !== null ? `Token válido · ${c.tokenDaysLeft} dias` : "Token válido"}
              </Badge>
            }
          />
          <Line
            label="Webhook"
            help={c.lastWebhookAt ? `Último evento ${timeAgo(c.lastWebhookAt)} · assinatura HMAC verificada.` : "Nenhum evento recebido ainda."}
            action={<Badge status={c.recentWebhook ? "sucesso" : "alerta"}>{c.recentWebhook ? "Recebendo" : "Sem eventos recentes"}</Badge>}
          />
          <Line label="Endereço do webhook" help={<span className="break-all">{c.webhookUrl}</span>} action={<CopyButton text={c.webhookUrl} />} />
          <Line label="Testar" help="Pede para a Zernio enviar um evento assinado e confere se o app está recebendo." action={<TestWebhookButton />} />
          <Line
            label="Botões no Direct"
            help="Desligado por padrão: o Instagram pode recusar botão para quem não te segue, e a mensagem se perde. Se isso acontecer, o app desliga sozinho."
            action={<ButtonsToggle allowed={c.buttonsAllowed} />}
          />
          <Line
            label="Permissões"
            help={<span title={scopes || undefined} className="line-clamp-2">{scopes || "Não foi possível consultar agora."}</span>}
            action={
              <span className="text-sm font-medium whitespace-nowrap">
                {granted}/{c.permissions.length || "—"} concedidas
              </span>
            }
          />
          <Line
            label="Alterar conexão"
            help="Para trocar de conta ou reconectar, use o painel da Zernio. O app detecta a conta sozinho."
            action={
              <a href="https://zernio.com/dashboard" target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                Abrir na Zernio
              </a>
            }
          />
        </SettingsCard>
      </Main>
      <Side>
        <NooiTip pose="acenando">
          {healthy
            ? "Conexão saudável. Se o token cair, eu pauso tudo e nada se perde."
            : "A conexão precisa de atenção. Reconecte pelo painel da Zernio: os comentários ficam na fila por até 7 dias."}
        </NooiTip>
      </Side>
    </>
  );
}

async function Limites({ userId }: { userId: string }) {
  const s = await getSettings(userId);
  const hourly = s?.outboundHourlyBudget ?? 600;
  const slack = Math.round((1 - hourly / 750) * 100);
  return (
    <>
      <Main>
        <SettingsCard eyebrow="Anti-spam" title="Limites e anti-spam">
          <LimitsForm
            values={{
              perUserDailyCap: s?.perUserDailyCap ?? 3,
              outboundHourlyBudget: hourly,
              monthlyDmBudget: s?.monthlyDmBudget ?? 10000,
            }}
          />
        </SettingsCard>
      </Main>
      <Side>
        <NooiTip pose="moedas">
          {slack > 0
            ? `Com ${hourly.toLocaleString("pt-BR")} por hora você fica com ${slack}% de folga do limite da Meta.`
            : "O limite da Meta é 750 Private Replies por hora. Deixe uma folga para não ser bloqueada."}
        </NooiTip>
      </Side>
    </>
  );
}

function Dados() {
  return (
    <>
      <Main>
        <SettingsCard eyebrow="LGPD" title="Dados e retenção">
          <Line
            label="Retenção do histórico"
            help="Comentários, logs e cliques são apagados automaticamente depois de 90 dias (LGPD)."
            action={<Badge status="info">90 dias</Badge>}
          />
          <Line
            label="Exportar histórico"
            help="Eventos dos últimos 90 dias, sem o texto completo dos comentários."
            action={
              <a href="/api/exportar/historico?periodo=90d" className={buttonClass("secondary")}>
                Baixar CSV
              </a>
            }
          />
          <Line
            label="Exportar automações"
            help="Palavras, materiais e respostas, para backup."
            action={
              <a href="/api/exportar/automacoes" className={buttonClass("secondary")}>
                Baixar JSON
              </a>
            }
          />
          <Line label="Apagar histórico agora" help="Remove todos os eventos. As automações continuam." action={<WipeHistory />} />
        </SettingsCard>
      </Main>
      <Side>
        <NooiTip pose="regando">Depois de 90 dias eu apago o histórico sozinho. As automações ficam.</NooiTip>
      </Side>
    </>
  );
}
