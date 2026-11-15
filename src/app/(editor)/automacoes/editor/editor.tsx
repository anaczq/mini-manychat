"use client";

import clsx from "clsx";
import { AlertTriangle, ArrowLeft, Check, Play, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { Button, Card, CardTitle, Toggle } from "@/components/ui";
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

/* ───────── peças visuais (Figma "10 · Editor de automação") ───────── */

const field = "w-full rounded-xl border border-border bg-surface px-3.5 py-[11px] text-sm font-medium outline-none placeholder:font-normal placeholder:text-tertiary focus:border-primary";
const pill = "inline-flex items-center justify-center rounded-full px-3.5 py-[9px] text-[13px] font-medium whitespace-nowrap transition-colors";

function Step({ n, title, right, error, children }: { n: number; title: string; right?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <Card className={clsx("flex flex-col gap-3.5 p-[22px]", error && "border-error")}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-dark font-mono text-xs text-on-dark">{n}</span>
        <h2 className="min-w-0 flex-1 font-display text-lg font-medium">{title}</h2>
        {right}
      </div>
      {children}
      {error && <p className="text-[13px] font-medium text-error">{error}</p>}
    </Card>
  );
}

/** Seletor em pílulas (Figma "Segmentado"): fundo cinza, opção ativa preta. */
function Segmented<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="flex w-fit gap-1 rounded-full bg-subtle p-1">
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={clsx(pill, value === k ? "bg-dark text-on-dark" : "text-ink hover:bg-surface")}
        >
          {l}
        </button>
      ))}
    </div>
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
      className={clsx("flex cursor-pointer flex-col gap-3 rounded-[14px] border p-3.5", on ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-bg")}
    >
      {children}
    </div>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return <span className={clsx("size-4 shrink-0 rounded-full bg-surface", on ? "border-[4.5px] border-primary" : "border border-border-strong")} />;
}

function Thumb({ post, selected }: { post?: PickerPost; selected?: boolean }) {
  return (
    <span className={clsx("relative block h-[90px] w-[72px] shrink-0 overflow-hidden rounded-[10px] bg-subtle", selected && "ring-2 ring-inset ring-primary")}>
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
  const example = value.terms[0] ?? "ebook";
  const filledReplies = value.replies.filter(Boolean).length;

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-24 md:pb-0">
      {/* barra do editor */}
      <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3.5 md:px-8">
        <button aria-label="Fechar editor" onClick={close} className="-ml-1.5 grid size-8 shrink-0 place-items-center rounded-full hover:bg-bg">
          <ArrowLeft className="size-[18px]" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <input
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={value.terms.join(" · ") || "Nova automação"}
            aria-label="Nome da automação"
            className="w-full truncate bg-transparent font-display text-xl! font-medium outline-none placeholder:text-ink"
          />
          <p className="eyebrow">{dirty ? "Alterações não salvas" : id ? "Salvo" : "Rascunho · não publicada"}</p>
        </div>
        <span
          className={clsx(
            "hidden items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs font-medium sm:inline-flex",
            value.active ? "bg-success-soft text-success" : "bg-subtle text-muted",
          )}
        >
          <span className={clsx("size-[7px] rounded-full", value.active ? "bg-success" : "bg-tertiary")} />
          {value.active ? "Ligada" : "Desligada"}
        </span>
        <Toggle on={value.active} label="Ligar ou desligar a automação" onClick={() => set("active", !value.active)} />
        <Button className="hidden md:inline-flex" onClick={() => save()} disabled={pending || (!dirty && !!id)}>
          {pending ? "Salvando…" : value.active ? "Salvar e publicar" : "Salvar"}
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pt-4 md:px-8 md:pt-7 md:pb-10 lg:flex-row lg:items-start lg:gap-5">
        {/* passos */}
        <div className="flex w-full min-w-0 flex-col gap-4 lg:w-[440px] lg:shrink-0 xl:w-[520px]">
          {banner && (
            <div role="alert" className="flex items-center gap-2 rounded-2xl bg-error-soft px-4 py-3 text-sm font-semibold text-error">
              <AlertTriangle className="size-4 shrink-0" /> {errorCount > 0 ? `Corrija ${errorCount} ${errorCount === 1 ? "item" : "itens"} antes de publicar` : banner}
            </div>
          )}
          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-[13px] text-warning">
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
                    className="grid h-[90px] w-[72px] place-items-center whitespace-pre-line rounded-[10px] border border-border bg-surface text-center text-[11px] font-medium text-primary hover:bg-bg"
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
            {value.terms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {value.terms.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 rounded-full bg-primary-soft py-[5px] pr-2 pl-2.5 font-mono text-xs text-primary uppercase">
                    {t}
                    <button type="button" aria-label={`Remover ${t}`} onClick={() => set("terms", value.terms.filter((x) => x !== t))} className="text-primary/60 hover:text-primary">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
              className={clsx(field, errors.terms && "border-error")}
            />
            <Segmented
              options={[
                ["contains", "Contém a palavra"],
                ["exact", "Exatamente igual"],
              ]}
              value={value.matchMode}
              onChange={(k) => set("matchMode", k)}
            />
            <p className="text-xs text-muted">
              Tanto faz maiúscula, minúscula ou acento: “{example.toLowerCase()}”, “{example.toUpperCase()}” e “
              {example.charAt(0).toUpperCase() + example.slice(1).toLowerCase()}!!” disparam igual.
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
                  <div key={i} className="group flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 focus-within:border-primary">
                    <input
                      value={r}
                      maxLength={300}
                      onChange={(e) => set("replies", value.replies.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder="Ex.: Enviado no seu direct! 📩"
                      aria-label={`Resposta ${i + 1}`}
                      className="min-w-0 flex-1 bg-transparent py-[11px] text-sm font-medium outline-none placeholder:font-normal placeholder:text-tertiary"
                    />
                    <button type="button" aria-label={`Remover resposta ${i + 1}`} onClick={() => set("replies", value.replies.filter((_, j) => j !== i))} className="text-tertiary hover:text-error">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                {value.replies.length < 10 && (
                  <button type="button" onClick={() => set("replies", [...value.replies, ""])} className={clsx(pill, "-ml-3.5 self-start text-primary hover:bg-primary-soft")}>
                    + Adicionar variação
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
                <textarea
                  value={value.dmText}
                  onChange={(e) => set("dmText", e.target.value)}
                  rows={3}
                  placeholder="Oi {{first_name}}! Aqui está o seu material 👇"
                  aria-label="Mensagem do Direct"
                  className={clsx(field, "resize-none", errors.dmText && "border-error")}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => set("dmText", `${value.dmText}{{first_name}}`)}
                    className={clsx(pill, "border border-border bg-surface text-ink hover:bg-bg")}
                  >
                    {"{ }"} Nome
                  </button>
                  <span className="flex-1" />
                  <span className={clsx("font-mono text-[11px]", bytes(value.dmText) > 1000 ? "font-bold text-error" : "text-muted")}>{bytes(value.dmText)} / 1000</span>
                </div>
                <Segmented
                  options={[
                    ["link", "Link"],
                    ["arquivo", "Imagem"],
                  ]}
                  value={materialKind}
                  onChange={(k) => {
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
                />
                {materialKind === "link" ? (
                  <input
                    value={value.dmLinkUrl ?? ""}
                    onChange={(e) => set("dmLinkUrl", e.target.value || undefined)}
                    placeholder="https://seu-material.com"
                    aria-label="Link do material"
                    inputMode="url"
                    className={clsx(field, errors.dmLinkUrl && "border-error")}
                  />
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
                    <div className="flex items-center gap-4">
                      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <p className="text-sm font-medium">Mostrar o link como botão</p>
                        <p className="text-xs text-muted">Desligado por padrão: o Instagram pode recusar botão para quem não te segue.</p>
                      </div>
                      <Toggle on={!!value.buttonLabel} label="Mostrar link como botão" onClick={() => set("buttonLabel", value.buttonLabel ? undefined : "Abrir material")} />
                    </div>
                    {value.buttonLabel !== undefined && (
                      <input
                        value={value.buttonLabel}
                        maxLength={20}
                        onChange={(e) => set("buttonLabel", e.target.value)}
                        aria-label="Texto do botão"
                        className={clsx(field, errors.buttonLabel && "border-error")}
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

        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-5 xl:flex-row xl:items-start">
          {/* prévia: só no desktop; no celular abre pelo botão "Pré-visualizar" */}
          <Card className="hidden min-w-0 flex-1 flex-col items-center gap-4 p-[22px] lg:flex">
            <div className="w-full">
              <CardTitle eyebrow="Como funciona" title="Do comentário ao Direct" />
            </div>
            <div className="flex w-full flex-col gap-2">
              <FlowNode
                dot="bg-ink"
                title="Comentário"
                sub={`${value.matchMode === "exact" ? "é exatamente" : "contém"} ${value.terms.join(", ") || "…"}${value.scope === "specific" ? ` em ${value.postIds.length} post(s)` : ""}`}
              />
              {value.publicReplyEnabled && <FlowNode dot="bg-primary" title="Resposta pública" sub={`1 de ${filledReplies} ${filledReplies === 1 ? "variação" : "variações"}, sorteada`} />}
              {value.dmEnabled && <FlowNode dot="bg-success" title="Direct" sub={value.assetId ? "texto, e a imagem quando responder" : value.dmLinkUrl ? "texto + link" : "texto"} />}
            </div>
            <Tabs tab={tab} setTab={setTab} />
            <Preview tab={tab} value={value} username={username} firstPost={selectedPosts[0] ?? posts[0]} />
          </Card>

          {/* lateral */}
          <div className="flex w-full flex-col gap-4 xl:w-[316px] xl:shrink-0">
            <Card className="flex flex-col p-[22px]">
              <div className="pb-2.5">
                <CardTitle eyebrow="Últimos 7 dias" title={stats ? "Desempenho" : "Ainda sem disparos"} />
              </div>
              <Stat label="Disparos" value={stats ? String(stats.runs) : "—"} />
              <Stat label="Lidos" value={stats?.readPct ?? "—"} />
              <Stat label="Cliques no link" value={stats?.clickPct ?? "—"} />
            </Card>
            <section className="flex flex-col items-start gap-3 rounded-3xl bg-primary-soft p-[22px]">
              <Image src="/marca/nooi-comemorando.png" alt="" width={64} height={64} className="size-16 object-contain" />
              <p className="eyebrow text-primary">Testar agora</p>
              <p className="text-sm font-medium">De outra conta, comente {value.terms[0] ?? "a palavra"} em um dos posts escolhidos. O DM chega em segundos.</p>
              {value.terms[0] && (
                <Button variant="secondary" onClick={() => navigator.clipboard.writeText(value.terms[0])} className="px-3.5">
                  Copiar “{value.terms[0]}”
                </Button>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* mobile: barra de ações fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-border bg-surface px-4 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] md:hidden">
        <Button variant="secondary" className="flex-1" onClick={() => setPreviewOpen(true)}>
          Pré-visualizar
        </Button>
        <Button className="flex-1" onClick={() => save()} disabled={pending}>
          {pending ? "Salvando…" : value.active ? "Publicar" : "Salvar"}
        </Button>
      </div>

      {/* sem a coluna de prévia (abaixo de lg), o botão de pré-visualizar também aparece no tablet */}
      <div className="fixed right-8 bottom-8 z-30 hidden md:block lg:hidden">
        <Button variant="secondary" className="shadow-[0_8px_16px_rgba(16,17,20,0.08)]" onClick={() => setPreviewOpen(true)}>
          Pré-visualizar
        </Button>
      </div>

      {previewOpen && (
        <div role="dialog" aria-modal="true" aria-label="Pré-visualização" className="fixed inset-0 z-50 flex flex-col items-center gap-4 overflow-y-auto bg-bg px-4 pb-6">
          <div className="sticky top-0 -mx-4 flex w-[calc(100%+2rem)] items-center gap-3 border-b border-border bg-surface px-4 py-3.5">
            <button aria-label="Fechar pré-visualização" onClick={() => setPreviewOpen(false)} className="-ml-1.5 grid size-8 place-items-center rounded-full hover:bg-bg">
              <ArrowLeft className="size-[18px]" />
            </button>
            <span className="flex-1 font-display text-xl font-medium">Pré-visualização</span>
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
                {pending ? "Salvando…" : "Salvar e sair"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">Você tem alterações não salvas. Se sair agora, elas se perdem.</p>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-dark py-3 pr-5 pl-3 text-sm text-on-dark md:bottom-8">
          <span className="grid size-5 place-items-center rounded-full bg-success">
            <Check className="size-3" strokeWidth={3} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function FlowNode({ dot, title, sub }: { dot: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] bg-bg p-3">
      <span className={clsx("size-2.5 shrink-0 rounded-full", dot)} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center border-t border-hairline py-2.5">
      <span className="eyebrow flex-1">{label}</span>
      <span className="font-display text-lg font-medium">{value}</span>
    </div>
  );
}
