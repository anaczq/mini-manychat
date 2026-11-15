"use client";

import { upload } from "@vercel/blob/client";
import clsx from "clsx";
import { AlertTriangle, FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { registerAssetAction } from "@/app/actions/assets";
import type { AssetView } from "@/lib/assets";

const LIMITS: Record<string, number> = { "image/png": 8, "image/jpeg": 8 };

function size(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/** Envio direto ao Vercel Blob (Figma M10): arrastar/escolher, progresso, erro de tipo/tamanho. */
export function MaterialUpload({
  userId,
  asset,
  onChange,
  enabled,
}: {
  userId: string;
  asset: AssetView | null;
  onChange: (a: AssetView | null) => void;
  enabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function send(file: File) {
    setError(null);
    const max = LIMITS[file.type];
    if (!max) return setError(`${file.name}: tipo não aceito. Envie PNG ou JPG.`);
    if (file.size > max * 1024 * 1024) return setError(`${file.name}: maior que ${max} MB.`);
    try {
      setProgress(0);
      const blob = await upload(`materiais/${userId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
      });
      const r = await registerAssetAction(blob.url, file.name);
      if (!r.ok) return setError(r.error);
      onChange(r.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no envio");
    } finally {
      setProgress(null);
    }
  }

  if (!enabled) {
    return <p className="text-xs text-muted">Envio de arquivos ainda não configurado (Vercel Blob). Use um link por enquanto.</p>;
  }

  if (asset) {
    const Icon = asset.mime === "application/pdf" ? FileText : ImageIcon;
    return (
      <div className="flex items-center gap-2.5 rounded-[14px] bg-bg px-3 py-2.5">
        <span className={clsx("grid size-8 place-items-center rounded-md", asset.mime === "application/pdf" ? "bg-error-soft text-error" : "bg-primary-soft text-primary")}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{asset.name}</p>
          <p className="text-xs text-muted">{size(asset.sizeBytes)} · vai como link no fim da mensagem</p>
        </div>
        <button type="button" aria-label="Remover arquivo" onClick={() => onChange(null)} className="text-tertiary hover:text-error">
          <Trash2 className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) send(f);
        }}
        disabled={progress !== null}
        className={clsx(
          "flex flex-col items-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed px-4 py-6 text-center",
          over ? "border-primary bg-primary-soft" : "border-border bg-bg",
        )}
      >
        <Upload className="size-5 text-primary" />
        <span className="text-sm font-medium">{progress !== null ? `Enviando… ${progress}%` : "Arraste o arquivo aqui ou clique para escolher"}</span>
        <span className="text-xs text-muted">PNG ou JPG até 8 MB</span>
        {progress !== null && (
          <span className="mt-1 h-1 w-full max-w-[260px] rounded-full bg-subtle">
            <span className="block h-1 rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-error-soft px-3 py-2 text-[13px] font-medium text-error">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
