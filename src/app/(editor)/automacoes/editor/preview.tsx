"use client";

import clsx from "clsx";
import { MessageCircle, Reply, Send } from "lucide-react";
import type { ReactNode } from "react";
import type { AutomationInput } from "@/lib/automations";
import type { PickerPost } from "@/lib/posts";

// Pré-visualização em formato de celular: post, comentários e Direct, como a pessoa vai ver.

export type Tab = "post" | "comentarios" | "direct";

function Phone({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="w-[320px] max-w-full overflow-hidden rounded-[36px] border-[10px] border-dark bg-surface pb-4 pt-3 shadow-[0_20px_40px_rgba(0,0,0,0.12)]">
      <div className="flex px-5 text-xs font-semibold">
        <span className="flex-1">9:41</span>●●● ▮
      </div>
      <div className="flex items-center border-b border-hairline px-3.5 py-2.5">
        <span className="flex-1 text-[15px] font-semibold">{title}</span>
        <Send className="size-[18px]" />
      </div>
      {children}
    </div>
  );
}

/** Comentário de exemplo coerente com o modo: no exato, só a palavra (emojis são ignorados). */
function exampleComment(value: AutomationInput) {
  const term = value.terms[0] ?? "PALAVRA";
  return value.matchMode === "exact" ? `${term} 😍` : `quero o ${term}!! 😍`;
}

export function Preview({ tab, value, username, firstPost }: { tab: Tab; value: AutomationInput; username: string; firstPost?: PickerPost }) {
  const term = value.terms[0] ?? "PALAVRA";
  const comment = exampleComment(value);
  const reply = value.replies.find(Boolean) ?? "";
  const hasMaterial = !!value.dmLinkUrl || !!value.assetId;
  const dm = value.dmText.replaceAll("{{first_name}}", "Marina") + (hasMaterial && !value.buttonLabel ? "\n\nseu-app.vercel.app/l/…" : "");

  if (tab === "post") {
    return (
      <Phone title={username}>
        <div className="aspect-square bg-subtle">
          {firstPost?.thumbnailUrl && <img src={firstPost.thumbnailUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />}
        </div>
        <div className="flex gap-3.5 px-3.5 pt-2.5">
          <MessageCircle className="size-5" />
          <Send className="size-5" />
        </div>
        <p className="line-clamp-3 px-3.5 pt-1.5 text-xs">
          <b>{username}</b> {firstPost?.caption || `Comenta ${term} que eu te mando no direct 📩`}
        </p>
      </Phone>
    );
  }

  if (tab === "direct") {
    return (
      <Phone title="marina.lopes">
        <div className="flex flex-col gap-2.5 px-3.5 pt-3.5">
          <div className="self-center text-center text-[11px] font-medium text-muted">
            Respondeu ao seu comentário
            <div className="mt-1 rounded-xl bg-subtle px-2.5 py-1.5 font-normal">“{comment}”</div>
          </div>
          {value.dmEnabled ? (
            <>
              <div className="ml-auto max-w-[230px] whitespace-pre-wrap rounded-[18px] bg-[linear-gradient(180deg,#9940f2,#3373ff)] px-3 py-2.5 text-[13px] text-white">
                {dm || "Escreva a mensagem no passo 4"}
                {hasMaterial && value.buttonLabel && (
                  <span className="mt-2 block rounded-lg bg-white/90 py-1.5 text-center text-xs font-semibold text-ink">{value.buttonLabel}</span>
                )}
              </div>
              <span className="self-end text-[10px] text-muted">Enviado · agora</span>
            </>
          ) : (
            <p className="py-6 text-center text-xs text-muted">Esta automação não envia Direct.</p>
          )}
        </div>
      </Phone>
    );
  }

  return (
    <Phone title="Comentários">
      <ul className="flex flex-col gap-4 px-3.5 pt-3.5 text-[13px]">
        <li className="flex gap-2.5">
          <span className="size-8 rounded-full bg-subtle" />
          <div>
            <b className="text-xs">rafa.ux</b> <span className="text-[11px] text-muted">3 min</span>
            <p>amei esse conteúdo 🔥</p>
          </div>
        </li>
        <li className="flex gap-2.5 rounded-[10px] bg-primary-soft p-1.5">
          <span className="size-8 rounded-full bg-subtle" />
          <div>
            <b className="text-xs">marina.lopes</b> <span className="text-[11px] text-muted">agora</span>
            <p>{comment}</p>
          </div>
        </li>
        {value.publicReplyEnabled && reply && (
          <li className="flex gap-2.5 pl-10">
            <span className="size-6 rounded-full bg-accent-orange-soft" />
            <div>
              <b className="text-xs">{username}</b> <span className="text-[11px] text-muted">agora</span>
              <p>{reply}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Reply className="size-3" /> Resposta automática
              </p>
            </div>
          </li>
        )}
      </ul>
    </Phone>
  );
}

export function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-subtle p-1">
      {(
        [
          ["post", "Post"],
          ["comentarios", "Comentários"],
          ["direct", "Direct"],
        ] as const
      ).map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={tab === k}
          onClick={() => setTab(k)}
          className={clsx("rounded-full px-3.5 py-[9px] text-[13px] font-medium transition-colors", tab === k ? "bg-dark text-white" : "text-ink hover:bg-surface")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
