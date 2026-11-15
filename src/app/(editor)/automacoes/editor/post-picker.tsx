"use client";

import clsx from "clsx";
import { Check, Play, Search } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { normalize } from "@/lib/matching";
import type { PickerPost } from "@/lib/posts";

type Filter = "todos" | "reels" | "posts";

// O ID do post vem do link colado: instagram.com/p/<shortcode> não é o ID da API, então só aceitamos posts conhecidos.
function findByLink(posts: PickerPost[], link: string) {
  const code = link.match(/instagram\.com\/(?:p|reel|reels)\/([\w-]+)/)?.[1];
  return code ? posts.find((p) => p.permalink?.includes(code)) : undefined;
}

export function PostPicker({
  posts,
  selected,
  onClose,
  onConfirm,
}: {
  posts: PickerPost[];
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const visible = posts.filter(
    (p) => (filter === "todos" || (filter === "reels") === p.isReel) && (!q || normalize(p.caption).includes(normalize(q))),
  );

  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal
      title="Selecione posts ou reels"
      subtitle="Mostrando os 25 mais recentes e os que já receberam comentários."
      onClose={onClose}
      width={880}
      footer={
        <>
          <span className="flex-1 self-center text-sm font-medium">
            {picked.length} {picked.length === 1 ? "selecionado" : "selecionados"}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(picked)}>Confirmar seleção</Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <label className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-border px-2.5 text-sm focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pela legenda" aria-label="Buscar pela legenda" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/50" />
        </label>
        {(["todos", "reels", "posts"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={clsx("h-9 rounded-full px-3 text-[13px] font-medium capitalize", filter === f ? "bg-border" : "border border-border hover:bg-bg")}
          >
            {f}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Não consegui carregar seus posts agora. Tente de novo em instantes.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {visible.map((p) => {
            const on = picked.includes(p.id);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => toggle(p.id)} aria-pressed={on} className="flex w-full flex-col gap-1.5 text-left">
                  <span className={clsx("relative block aspect-[4/5] w-full overflow-hidden rounded-md bg-subtle", on && "ring-[3px] ring-inset ring-primary")}>
                    {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" loading="lazy" />}
                    <span className={clsx("absolute right-2 top-2 grid size-5 place-items-center rounded-full", on ? "bg-primary" : "border-[1.5px] border-border bg-surface")}>
                      {on && <Check className="size-3 text-white" strokeWidth={3} />}
                    </span>
                    {p.isReel && (
                      <span className="absolute left-2 top-2 grid size-[22px] place-items-center rounded-full bg-black/45">
                        <Play className="size-2.5 fill-white text-white" />
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-[13px] font-medium">{p.caption || "Sem legenda"}</span>
                  {p.postedAt && <span className="text-xs text-muted">{timeAgo(new Date(p.postedAt))}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const found = findByLink(posts, link);
          if (!found) return setLinkError("Não encontrei esse post entre os carregados. Ele precisa ter recebido algum comentário recente.");
          setPicked((s) => (s.includes(found.id) ? s : [...s, found.id]));
          setLink("");
          setLinkError(null);
        }}
      >
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium">Post mais antigo? Cole o link</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://instagram.com/p/…" inputMode="url" className="h-9 rounded-xl border border-border px-3 text-sm outline-none placeholder:text-tertiary focus:border-primary" />
        </label>
        <Button type="submit" variant="secondary">
          Adicionar
        </Button>
      </form>
      {linkError && <p className="text-[13px] text-error">{linkError}</p>}
    </Modal>
  );
}
