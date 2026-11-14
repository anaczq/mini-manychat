"use client";

import clsx from "clsx";
import { AlertTriangle, BarChart3, Check, Copy, Link2, MessageCircle, Play, Plus, Reply, Send, Trash2, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { Button, Toggle } from "@/components/ui";
import type { AutomationInput } from "@/lib/automations";
import type { PickerPost } from "@/lib/posts";
import { saveAutomationAction } from "@/app/actions/automacoes";
import { normalize } from "@/lib/matching";
import type { AssetView } from "@/lib/assets";
import { ARQUIVO_DM_TEXT, TEMPLATES } from "@/lib/templates";
import { MaterialUpload } from "./material-upload";
import { PostPicker } from "./post-picker";
import { Preview, type Tab, Tabs } from "./preview";

type Stats = { runs: number; readPct: string; clickPct: string } | null;

function bytes(s: string) {
  return new TextEncoder().encode(s).length;
}

/* ───────── peças visuais ───────── */

function Step({ n, title, right, error, children }: { n: number; title: string; right?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <section className={clsx("flex flex-col gap-3 border-b border-line px-5 py-[18px] md:px-6", error && "bg-error-soft/40")}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-[22px] place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{n}</span>
        <h2 className="flex-1 text-[15px] font-semibold">{title}</h2>
        {right}
      </div>
      {children}
      {error && <p className="text-[13px] font-medium text-error">{error}</p>}
    </section>
  );
}

function Radio({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <div
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onClick()}
      className={clsx(
        "flex cursor-pointer flex-col gap-2.5 rounded-[10px] border p-3",
        on ? "border-[1.5px] border-primary bg-primary-soft" : "border-border bg-surface",
      )}
    >
      {children}
    </div>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return <span className={clsx("size-[18px] shrink-0 rounded-full bg-surface", on ? "border-[5px] border-primary" : "border-[1.5px] border-border")} />;
}

function Thumb({ post, selected, size = "md" }: { post?: PickerPost; selected?: boolean; size?: "sm" | "md" }) {
  return (
    <span
      className={clsx(
        "relative block shrink-0 overflow-hidden rounded-lg bg-subtle",
        size === "md" ? "h-[90px] w-[72px]" : "h-14 w-11",
        selected && "ring-[2.5px] ring-inset ring-primary",
      )}
    >
      {post?.thumbnailUrl && <img src={post.thumbnailUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />}
      {selected && (
        <span className="absolute right-1.5 top-1.5 grid size-[18px] place-items-center rounded-full bg-primary">
          <Check className="size-3 text-white" strokeWidth={3} />
        </span>
      )}
      {post?.isReel && (
        <span className="absolute left-1.5 top-1.5 grid size-[18px] place-items-center rounded-full bg-black/45">
          <Play className="size-2.5 fill-white text-white" />
        </span>
      )}
    </span>
  );
}

/* ───────── editor ───────── */

export function AutomationEditor({
  id,
  initial,
  posts,
  username,
  stats,
  userId,
  initialAsset,
  uploadsEnabled,
  defaultMaterialKind = "link",
}: {
  id: string | null;
  initial: AutomationInput;
  posts: PickerPost[];
  username: string;
  stats: Stats;
  userId: string;
  initialAsset: AssetView | null;
  uploadsEnabled: boolean;
  /** Aba de material aberta numa automação nova (o modelo "arquivo" abre em Arquivo). */
  defaultMaterialKind?: "link" | "arquivo";
}) {
  const router = useRouter();
  const [value, setValue] = useState<AutomationInput>(initial);
  const [asset, setAsset] = useState<AssetView | null>(initialAsset);
  const [materialKind, setMaterialKind] = useState<"link" | "arquivo">(initial.assetId ? "arquivo" : defaultMaterialKind);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [termDraft, setTermDraft] = useState("");
  const [tab, setTab] = useState<Tab>("comentarios");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const dirty = JSON.stringify(value) !== saved;
  const set = <K extends keyof AutomationInput>(k: K, v: AutomationInput[K]) => setValue((s) => ({ ...s, [k]: v }));
  const postById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function addTerm() {
    const t = termDraft.replace(/,$/, "").trim();
    // Guarda como foi digitado; duplicatas são comparadas sem caixa/acento, igual ao matching.
    if (t && !value.terms.some((x) => normalize(x) === normalize(t))) set("terms", [...value.terms, t]);
    setTermDraft("");
  }

  function save(andLeave = false) {
    const payload = { ...value, replies: value.replies.map((r) => r.trim()).filter(Boolean), name: value.name || value.terms.join(" · ") };
    start(async () => {
      const r = await saveAutomationAction(id, payload);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setBanner(r.error);
        return;
      }
      setErrors({});
      setBanner(null);
      setConflicts(r.data.conflicts);
      setSaved(JSON.stringify(value));
      // Com conflito de palavra, fica no editor para mostrar o aviso; senão volta para a lista com a confirmação.
      if (r.data.conflicts.length && !andLeave) {
        setToast("Salva, mas veja o aviso de conflito acima.");
        if (!id) router.replace(`/automacoes/${r.data.id}`);
        return;
      }
      router.push(`/automacoes?salva=${value.active ? "publicada" : "desligada"}`);
    });
  }

  function close() {
    if (dirty) setLeaveOpen(true);
    else router.push("/automacoes");
  }

  const errorCount = Object.keys(errors).length;
  const selectedPosts = value.postIds.map((pid) => postById.get(pid) ?? { id: pid, caption: "", thumbnailUrl: null, permalink: null, isReel: false, postedAt: null });

  return (
    <div className="flex min-h-dvh flex-col bg-canvas md:h-dvh">
      {/* topbar */}
      <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-5">
        <button aria-label="Fechar editor" onClick={close} className="rounded-lg border border-border p-2 hover:bg-bg">
          <X className="size-[18px]" />
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={value.terms.join(" · ") || "Nova automação"}
            aria-label="Nome da automação"
            className="w-full truncate bg-transparent text-[15px] font-semibold outline-none"
          />
          <p className="text-xs text-muted">{dirty ? "Alterações não salvas" : id ? "Salvo" : "Rascunho"}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[13px] font-medium">
          <span className="hidden sm:inline">Ligada</span> <Toggle on={value.active} label="Ligar ou desligar a automação" onClick={() => set("active", !value.active)} />
        </label>
        <span className="hidden h-6 w-px bg-border sm:block" />
        <Button className="hidden md:inline-flex" onClick={() => save()} disabled={pending || (!dirty && !!id)}>
          {pending ? "Salvando…" : value.active ? "Salvar e publicar" : "Salvar"}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* painel de passos */}
        <div className="flex w-full flex-col overflow-y-auto border-r border-line bg-surface pb-24 md:w-[520px] md:shrink-0 md:pb-0">
          {banner && (
            <div role="alert" className="flex items-center gap-2 bg-error-soft px-6 py-3 text-sm font-semibold text-error">
              <AlertTriangle className="size-4" /> {errorCount > 0 ? `Corrija ${errorCount} ${errorCount === 1 ? "item" : "itens"} antes de publicar` : banner}
            </div>
          )}
          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 bg-warning-soft px-6 py-3 text-[13px] text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Outra automação ligada usa a mesma palavra nos mesmos posts: <b>{conflicts.join(", ")}</b>. Só uma dispara por comentário.
              </span>
            </div>
          )}

          <Step n={1} title="Quando alguém comentar em" error={errors.postIds}>
            <Radio on={value.scope === "specific"} onClick={() => set("scope", "specific")}>
              <span className="flex items-center gap-2.5 text-sm font-medium">
                <RadioDot on={value.scope === "specific"} /> Um post ou reel específico
              </span>
              {value.scope === "specific" && (
                <div className="flex flex-wrap gap-2">
                  {selectedPosts.slice(0, 4).map((p) => (
                    <Thumb key={p.id} post={p} selected />
                  ))}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPickerOpen(true);
                    }}
                    className="grid h-[90px] w-[72px] place-items-center whitespace-pre-line rounded-lg border border-border bg-surface text-center text-[11px] font-semibold text-primary"
                  >
                    {value.postIds.length ? `${value.postIds.length} escolhido${value.postIds.length > 1 ? "s" : ""}\nVer todos` : "Escolher posts"}
                  </button>
                </div>
              )}
            </Radio>
            <Radio on={value.scope === "all"} onClick={() => set("scope", "all")}>
              <span className="flex items-center gap-2.5 text-sm font-medium">
                <RadioDot on={value.scope === "all"} /> Qualquer post ou reel
              </span>
            </Radio>
          </Step>

          <Step n={2} title="E o comentário tiver a palavra" error={errors.terms}>
            <div
              className={clsx(
                "flex flex-wrap items-center gap-1.5 rounded-[10px] border bg-surface px-3 py-2",
                errors.terms ? "border-[1.5px] border-error" : "border-border",
              )}
            >
              {value.terms.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[13px] font-semibold text-primary">
                  {t}
                  <button aria-label={`Remover ${t}`} onClick={() => set("terms", value.terms.filter((x) => x !== t))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                value={termDraft}
                onChange={(e) => (e.target.value.endsWith(",") ? (setTermDraft(e.target.value), addTerm()) : setTermDraft(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTerm();
                  }
                  if (e.key === "Backspace" && !termDraft && value.terms.length) set("terms", value.terms.slice(0, -1));
                }}
                onBlur={addTerm}
                placeholder="Digite e aperte Enter"
                aria-label="Nova palavra-chave"
                className="min-w-[120px] flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-muted"
              />
            </div>
            <div className="flex w-fit gap-1 rounded-[10px] bg-bg p-1">
              {(
                [
                  ["contains", "Contém a palavra"],
                  ["exact", "Exatamente igual"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => set("matchMode", k)}
                  className={clsx("rounded-lg px-3.5 py-1.5 text-[13px]", value.matchMode === k ? "bg-surface font-semibold shadow-sm" : "font-medium text-muted")}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              Tanto faz maiúscula, minúscula ou acento: “{(value.terms[0] ?? "ebook").toLowerCase()}”, “{(value.terms[0] ?? "ebook").toUpperCase()}” e “
              {(value.terms[0] ?? "ebook").charAt(0).toUpperCase() + (value.terms[0] ?? "ebook").slice(1).toLowerCase()}!!” disparam igual.
              {value.matchMode === "contains"
                ? " Emojis e pontuação são ignorados. Palavras maiores que a contém (ex.: “…s”) não."
                : " Emojis e pontuação são ignorados, então “palavra 😍🔥” conta como exato. Outras palavras junto, não."}
            </p>
          </Step>

          <Step
            n={3}
            title="Responder o comentário publicamente"
            right={<Toggle on={value.publicReplyEnabled} label="Responder publicamente" onClick={() => set("publicReplyEnabled", !value.publicReplyEnabled)} />}
            error={errors.replies}
          >
            {value.publicReplyEnabled ? (
              <>
                {value.replies.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2">
                    <input
                      value={r}
                      maxLength={300}
                      onChange={(e) => set("replies", value.replies.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder="Ex.: Enviado no seu direct! 📩"
                      aria-label={`Resposta ${i + 1}`}
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                    <button aria-label={`Remover resposta ${i + 1}`} onClick={() => set("replies", value.replies.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4 text-muted" />
                    </button>
                  </div>
                ))}
                {value.replies.length < 10 && (
                  <button onClick={() => set("replies", [...value.replies, ""])} className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary">
                    <Plus className="size-4" /> Adicionar variação
                  </button>
                )}
                <p className="text-xs text-muted">Uma variação é sorteada a cada comentário, sem repetir a última.</p>
              </>
            ) : (
              <p className="text-xs text-muted">Desligado: o comentário não recebe resposta pública.</p>
            )}
          </Step>

          <Step
            n={4}
            title="Enviar mensagem no Direct"
            right={<Toggle on={value.dmEnabled} label="Enviar Direct" onClick={() => set("dmEnabled", !value.dmEnabled)} />}
            error={errors.dmText ?? errors.dmLinkUrl ?? errors.buttonLabel}
          >
            {value.dmEnabled ? (
              <>
                <div className="flex flex-col gap-2.5 rounded-[10px] border border-border px-3 py-3">
                  <textarea
                    value={value.dmText}
                    onChange={(e) => set("dmText", e.target.value)}
                    rows={4}
                    placeholder="Oi {{first_name}}! Aqui está o seu material 👇"
                    aria-label="Mensagem do Direct"
                    className="resize-none bg-transparent text-sm outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => set("dmText", `${value.dmText}{{first_name}}`)}
                      className="rounded-md bg-bg px-2 py-1 text-xs font-medium text-muted"
                    >
                      {"{ }"} Nome
                    </button>
                    <span className="flex-1" />
                    <span className={clsx("text-xs", bytes(value.dmText) > 1000 ? "font-semibold text-error" : "text-muted")}>
                      {bytes(value.dmText)} / 1000
                    </span>
                  </div>
                </div>
                <div className="flex w-fit gap-1 rounded-[10px] bg-bg p-1">
                  {(
                    [
                      ["link", "Link"],
                      ["arquivo", "Imagem"],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => {
                        setMaterialKind(k);
                        // Link e arquivo são exclusivos: trocar limpa o outro.
                        if (k === "link") {
                          setAsset(null);
                          set("assetId", undefined);
                        } else {
                          set("dmLinkUrl", undefined);
                          set("buttonLabel", undefined);
                          // Texto padrão de link não serve para arquivo: troca pelo que pede a resposta.
                          if (!value.dmText.trim() || Object.values(TEMPLATES).some((t) => t.dmText === value.dmText)) set("dmText", ARQUIVO_DM_TEXT);
                        }
                      }}
                      className={clsx("rounded-lg px-3.5 py-1.5 text-[13px]", materialKind === k ? "bg-surface font-semibold shadow-sm" : "font-medium text-muted")}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {materialKind === "link" ? (
                  <label className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2.5">
                    <Link2 className="size-4 text-muted" />
                    <input
                      value={value.dmLinkUrl ?? ""}
                      onChange={(e) => set("dmLinkUrl", e.target.value || undefined)}
                      placeholder="https://… (link do material)"
                      aria-label="Link do material"
                      inputMode="url"
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                  </label>
                ) : (
                  <MaterialUpload
                    userId={userId}
                    asset={asset}
                    enabled={uploadsEnabled}
                    onChange={(a) => {
                      setAsset(a);
                      set("assetId", a?.id);
                    }}
                  />
                )}
                <p className="text-xs text-muted">
                  {materialKind === "link"
                    ? "O material vai como link no fim da mensagem e conta cliques."
                    : "A imagem vai como anexo, sem link, assim que a pessoa responder a mensagem. Deixe claro no texto que ela precisa responder."}
                </p>
                {materialKind === "link" && (
                  <>
                <div className="flex items-start gap-2.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Mostrar o link como botão</p>
                    <p className="text-xs text-muted">Desligado por padrão: o Instagram pode recusar botão para quem não te segue.</p>
                  </div>
                  <Toggle
                    on={!!value.buttonLabel}
                    label="Mostrar link como botão"
                    onClick={() => set("buttonLabel", value.buttonLabel ? undefined : "Abrir material")}
                  />
                </div>
                {value.buttonLabel !== undefined && (
                  <input
                    value={value.buttonLabel}
                    maxLength={20}
                    onChange={(e) => set("buttonLabel", e.target.value)}
                    aria-label="Texto do botão"
                    className="rounded-[10px] border border-border px-3 py-2 text-sm outline-none"
                  />
                )}
                  </>
                )}
              </>
            ) : (
              <p className="text-xs text-muted">Desligado: só a resposta pública é enviada.</p>
            )}
          </Step>
        </div>

        {/* canvas de pré-visualização */}
        <div className="relative hidden flex-1 flex-col items-center justify-center gap-4 overflow-hidden bg-canvas bg-[radial-gradient(#cdd0d6_1px,transparent_1.2px)] [background-size:24px_24px] md:flex">
          <Tabs tab={tab} setTab={setTab} />
          <Preview tab={tab} value={value} username={username} firstPost={selectedPosts[0] ?? posts[0]} />

          <aside className="absolute left-7 top-[110px] hidden w-[232px] flex-col gap-3 rounded-lg bg-surface p-4 shadow-[0_8px_16px_rgba(132,146,166,0.16)] xl:flex">
            <p className="text-[11px] font-semibold text-muted">COMO FUNCIONA</p>
            <FlowNode icon={<MessageCircle className="size-4" />} color="bg-ink" title="Comentário" sub={`${value.matchMode === "exact" ? "é exatamente" : "contém"} ${value.terms.join(", ") || "…"}${value.scope === "specific" ? ` em ${value.postIds.length} post(s)` : ""}`} />
            {value.publicReplyEnabled && <FlowNode icon={<Reply className="size-4" />} color="bg-primary" title="Resposta pública" sub={`1 de ${value.replies.filter(Boolean).length} variações, sorteada`} />}
            {value.dmEnabled && <FlowNode icon={<Send className="size-4" />} color="bg-success" title="Direct" sub={value.assetId ? "texto, e a imagem quando responder" : value.dmLinkUrl ? "texto + link" : "texto"} />}
          </aside>

          <div className="absolute right-7 top-[110px] hidden w-[232px] flex-col gap-4 xl:flex">
            {stats && (
              <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-[0_8px_16px_rgba(132,146,166,0.16)]">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                  <BarChart3 className="size-3.5" /> ÚLTIMOS 7 DIAS
                </p>
                <Stat label="Disparos" value={String(stats.runs)} />
                <Stat label="Lidos" value={stats.readPct} />
                <Stat label="Cliques no link" value={stats.clickPct} />
              </div>
            )}
            <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-[0_8px_16px_rgba(132,146,166,0.16)]">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <Zap className="size-3.5" /> TESTAR AGORA
              </p>
              <p className="text-[13px]">De outra conta, comente {value.terms[0] ?? "a palavra"} em um dos posts escolhidos. O DM chega em segundos.</p>
              {value.terms[0] && (
                <Button variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => navigator.clipboard.writeText(value.terms[0])} className="self-start">
                  Copiar “{value.terms[0]}”
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* mobile: barra inferior */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-line bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <Button variant="secondary" className="flex-1" onClick={() => setPreviewOpen(true)}>
          Pré-visualizar
        </Button>
        <Button className="flex-1" onClick={() => save()} disabled={pending}>
          {value.active ? "Publicar" : "Salvar"}
        </Button>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center gap-4 overflow-y-auto bg-canvas p-4">
          <div className="flex w-full items-center">
            <button aria-label="Fechar pré-visualização" onClick={() => setPreviewOpen(false)}>
              <X className="size-5" />
            </button>
            <span className="flex-1 text-center font-bold">Pré-visualização</span>
            <span className="w-5" />
          </div>
          <Tabs tab={tab} setTab={setTab} />
          <Preview tab={tab} value={value} username={username} firstPost={selectedPosts[0] ?? posts[0]} />
        </div>
      )}

      {pickerOpen && (
        <PostPicker
          posts={posts}
          selected={value.postIds}
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            set("postIds", ids);
            setPickerOpen(false);
          }}
        />
      )}

      {leaveOpen && (
        <Modal
          title="Sair sem salvar?"
          onClose={() => setLeaveOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => router.push("/automacoes")}>
                Descartar
              </Button>
              <Button onClick={() => save(true)} disabled={pending}>
                Salvar e sair
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">Você tem alterações não salvas. Se sair agora, elas se perdem.</p>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-[10px] bg-dark px-4 py-3 text-sm text-white md:bottom-8">
          <span className="grid size-5 place-items-center rounded-full bg-accent-green">
            <Check className="size-3" strokeWidth={3} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function FlowNode({ icon, color, title, sub }: { icon: ReactNode; color: string; title: string; sub: string }) {
  return (
    <div className="flex gap-2.5">
      <span className={clsx("grid size-8 shrink-0 place-items-center rounded-lg text-white", color)}>{icon}</span>
      <div>
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-[13px] text-muted">{label}</span>
      <span className="text-[15px] font-bold">{value}</span>
    </div>
  );
}
