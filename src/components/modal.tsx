"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

/** Popup central no desktop e painel que sobe de baixo no mobile (Figma: seção 14 · Popups). */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 460,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-surface shadow-[0_12px_40px_rgba(15,18,20,0.12)] sm:rounded-3xl"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-2 px-6 pt-5 pb-1">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-7 font-medium">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="grid shrink-0 place-items-center rounded-full bg-subtle p-1 text-secondary hover:bg-border">
            <X className="size-5" />
          </button>
        </div>
        {children && <div className="flex flex-col gap-3 px-6 pt-3 pb-5">{children}</div>}
        {footer && <div className="flex justify-end gap-2 bg-bg px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
