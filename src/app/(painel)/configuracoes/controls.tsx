"use client";

import { Copy, Download, LogOut, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Field } from "@/components/auth-card";
import { Modal } from "@/components/modal";
import { NewPasswordFields, PasswordField } from "@/components/password-field";
import { Button, Toggle } from "@/components/ui";
import { saveLimitsAction, setAutomationEnabledAction, setButtonsAllowedAction, wipeHistoryAction } from "@/app/actions/configuracoes";
import { authClient } from "@/lib/auth-client";

export function KillSwitch({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useOptimistic(enabled);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const apply = (v: boolean) =>
    start(async () => {
      setOn(v);
      await setAutomationEnabledAction(v);
      setConfirm(false);
    });
  return (
    <>
      <Toggle on={on} label={on ? "Pausar todas as automações" : "Ligar as automações"} onClick={() => (on ? setConfirm(true) : apply(true))} />
      {confirm && (
        <Modal
          title="Pausar todas as automações?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancelar
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => apply(false)}>
                Pausar tudo
              </Button>
            </>
          }
        >
          <ul className="flex flex-col gap-2 text-sm">
            <li>✓ Comentários continuam chegando e ficam guardados.</li>
            <li>✓ Você retoma quando quiser, sem perder nada dos últimos 7 dias.</li>
            <li className="text-warning">⚠ Depois de 7 dias a Meta não deixa mais responder no Direct.</li>
          </ul>
        </Modal>
      )}
    </>
  );
}

export function ButtonsToggle({ allowed }: { allowed: boolean }) {
  const [on, setOn] = useOptimistic(allowed);
  const [, start] = useTransition();
  return (
    <Toggle
      on={on}
      label="Permitir botões no Direct"
      onClick={() =>
        start(async () => {
          setOn(!on);
          await setButtonsAllowedAction(!on);
        })
      }
    />
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      icon={<Copy className="size-4" />}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copiado" : label}
    </Button>
  );
}

export function TestWebhookButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        icon={<Send className="size-4" />}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await fetch("/api/zernio/testar-webhook", { method: "POST" });
            setMsg(r.ok ? "Evento enviado. Confira “Último evento” em instantes." : "A Zernio não conseguiu entregar o teste.");
          })
        }
      >
        Enviar evento de teste
      </Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}

export function LimitsForm({ values }: { values: { perUserDailyCap: number; outboundHourlyBudget: number; monthlyDmBudget: number } }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = "h-9 w-24 rounded-md border border-border px-3 text-sm font-semibold outline-none focus:border-primary";
  return (
    <form
      action={(f) =>
        start(async () => {
          const r = await saveLimitsAction(Object.fromEntries(f));
          setMsg(r.ok ? "Limites salvos." : r.error);
        })
      }
      className="flex flex-col"
    >
      <div className="flex flex-col">
        {(
          [
            ["perUserDailyCap", "DMs por pessoa em 24 h", "Evita que alguém colecione materiais comentando em vários posts.", 1, 20],
            ["outboundHourlyBudget", "Private Replies por hora", "Limite da Meta: 750/h. O padrão (600) deixa 20% de folga.", 10, 700],
            ["monthlyDmBudget", "Cota de DMs no mês", "A Zernio grátis envia até 10.000 DMs/mês. Ao atingir, o envio pausa até o mês virar.", 100, 1000000],
          ] as const
        ).map(([name, label, help, min, max]) => (
          <div key={name} className="flex flex-col gap-2 border-t border-border px-5 py-4 first:border-t-0 md:flex-row md:items-center md:gap-6 md:px-6">
            <label htmlFor={name} className="text-[15px] font-medium md:w-[220px] md:text-base">
              {label}
            </label>
            <input id={name} name={name} type="number" min={min} max={max} defaultValue={values[name]} className={input} />
            <p className="flex-1 text-[13px] text-muted">{help}</p>
          </div>
        ))}
        <div className="flex flex-col gap-1 border-t border-border px-5 py-4 md:flex-row md:items-center md:gap-6 md:px-6">
          <p className="text-[15px] font-medium md:w-[220px] md:text-base">Comentários por pessoa em 10 min</p>
          <span className="w-24 text-sm font-semibold">10</span>
          <p className="flex-1 text-[13px] text-muted">Fixo. Acima disso, os comentários são ignorados sem gastar chamadas.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 md:px-6">
        <Button type="submit" disabled={pending}>
          Salvar limites
        </Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </form>
  );
}

export function BackupCodes() {
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Gerar novos
      </Button>
      {open && (
        <Modal title={codes ? "Seus novos códigos de backup" : "Gerar novos códigos?"} onClose={() => (setOpen(false), setCodes(null))}>
          {codes ? (
            <>
              <p className="text-sm text-muted">Os códigos antigos deixaram de valer. Estes não serão mostrados de novo.</p>
              <ul className="grid grid-cols-2 gap-2 rounded-md bg-subtle p-4 font-mono text-sm font-semibold">
                {codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button variant="secondary" icon={<Copy className="size-4" />} onClick={() => navigator.clipboard.writeText(codes.join("\n"))}>
                  Copiar
                </Button>
                <Button
                  variant="secondary"
                  icon={<Download className="size-4" />}
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" }));
                    a.download = "mini-manychat-codigos-backup.txt";
                    a.click();
                  }}
                >
                  Baixar .txt
                </Button>
              </div>
            </>
          ) : (
            <form
              className="flex flex-col gap-3"
              action={(f) =>
                start(async () => {
                  const { data, error } = await authClient.twoFactor.generateBackupCodes({ password: String(f.get("password")) });
                  if (error || !data) return setError("Senha incorreta ou muitas tentativas.");
                  setCodes(data.backupCodes);
                })
              }
            >
              <p className="text-sm text-muted">Os códigos atuais param de funcionar. Confirme sua senha.</p>
              <PasswordField label="Senha" name="password" autoComplete="current-password" required />
              {error && <p className="text-[13px] text-error">{error}</p>}
              <Button type="submit" disabled={pending} className="self-end">
                Gerar
              </Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [valid, setValid] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = () => (setOpen(false), setDone(false), setError(null), setValid(false));
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Trocar senha
      </Button>
      {open && (
        <Modal title={done ? "Senha trocada" : "Trocar senha"} onClose={close}>
          {done ? (
            <>
              <p className="text-sm text-muted">Use a senha nova no próximo login. As outras sessões foram encerradas; este navegador continua conectado.</p>
              <Button onClick={close} className="self-end">
                Fechar
              </Button>
            </>
          ) : (
            <form
              className="flex flex-col gap-3"
              action={(f) =>
                start(async () => {
                  const newPassword = String(f.get("newPassword"));
                  const { error } = await authClient.changePassword({
                    currentPassword: String(f.get("current")),
                    newPassword,
                    revokeOtherSessions: true,
                  });
                  if (error) return setError(error.status === 429 ? "Muitas tentativas. Espere alguns minutos." : "Senha atual incorreta.");
                  setError(null);
                  setDone(true);
                })
              }
            >
              <PasswordField label="Senha atual" name="current" autoComplete="current-password" required />
              <NewPasswordFields onValidChange={setValid} />
              {error && <p className="text-[13px] text-error">{error}</p>}
              <Button type="submit" disabled={pending || !valid} className="self-end">
                Trocar
              </Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

type SessionRow = { id: string; token: string; userAgent?: string | null; createdAt: Date | string; current: boolean };

export function Sessions() {
  const [list, setList] = useState<SessionRow[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    Promise.all([authClient.listSessions(), authClient.getSession()]).then(([all, cur]) =>
      setList((all.data ?? []).map((s) => ({ ...s, current: s.token === cur.data?.session.token }))),
    );
  }, []);

  const describe = (ua?: string | null) => {
    if (!ua) return "Navegador desconhecido";
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Navegador";
    const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : "";
    return `${browser}${os ? ` · ${os}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-2">
      {list === null ? (
        <span className="text-[13px] text-muted">Carregando…</span>
      ) : (
        list.map((s) => (
          <span key={s.id} className="text-[13px] text-muted">
            {describe(s.userAgent)} {s.current ? "· este navegador" : `· desde ${new Date(s.createdAt).toLocaleDateString("pt-BR")}`}
          </span>
        ))
      )}
      {list && list.length > 1 && (
        <Button variant="secondary" onClick={() => setConfirm(true)} className="self-start">
          Encerrar outras
        </Button>
      )}
      {confirm && (
        <Modal
          title="Encerrar outras sessões?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await authClient.revokeOtherSessions();
                    setList((l) => l?.filter((s) => s.current) ?? null);
                    setConfirm(false);
                  })
                }
              >
                Encerrar
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">Os outros aparelhos vão precisar entrar de novo com senha e código 2FA. Este navegador continua conectado.</p>
        </Modal>
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="danger"
      icon={<LogOut className="size-4" />}
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
      }}
    >
      Sair do painel
    </Button>
  );
}

export function WipeHistory() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Apagar
      </Button>
      {open && (
        <Modal title="Apagar todo o histórico?" onClose={() => setOpen(false)}>
          <p className="text-sm text-muted">Remove todos os comentários, status e cliques registrados. As automações continuam. Não dá para desfazer.</p>
          <form
            className="flex flex-col gap-3"
            action={(f) =>
              start(async () => {
                const r = await wipeHistoryAction(String(f.get("confirmacao")));
                if (r.ok) setOpen(false);
                else setError(r.error);
              })
            }
          >
            <Field label="Digite APAGAR para confirmar" name="confirmacao" autoComplete="off" required />
            {error && <p className="text-[13px] text-error">{error}</p>}
            <Button type="submit" variant="danger" disabled={pending} className="self-end">
              Apagar histórico
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
