"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

/** Popup central no desktop e painel que sobe de baixo no mobile (Figma: popups M*). */
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:rounded-xl"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-2 px-6 pb-1 pt-5">
          <div className="flex-1">
            <h2 className="text-xl font-bold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button aria-label="Fechar" onClick={onClose} className="rounded p-1 text-muted hover:bg-bg">
            <X className="size-5" />
          </button>
        </div>
        {children && <div className="flex flex-col gap-3 px-6 pb-5 pt-3">{children}</div>}
        {footer && <div className="flex justify-end gap-2 bg-bg px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
