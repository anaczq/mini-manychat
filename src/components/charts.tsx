import clsx from "clsx";
import { int, shortDate } from "@/lib/format";

// Gráficos simples em HTML/SVG, sem biblioteca (Analytics).

export function BarsChart({ data, unit, label }: { data: { day: string; n: number }[]; unit: string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <>
      <div className={clsx("flex h-32 items-end border-b border-border md:h-40", data.length > 45 ? "gap-px" : data.length > 20 ? "gap-0.5 md:gap-1" : "gap-1 md:gap-1.5")} role="img" aria-label={label}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t bg-primary/85 group-hover:bg-primary" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 3 : 0 }} />
            <span className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-dark px-2 py-1 text-[11px] text-white md:group-hover:block">
              {shortDate(d.day)} · {int(d.n)} {unit}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{data.length ? shortDate(data[0].day) : ""}</span>
        <span>{data.length ? shortDate(data[data.length - 1].day) : ""}</span>
      </div>
    </>
  );
}

/** Linha da contagem de seguidores; o eixo vai do mínimo ao máximo para a variação aparecer. */
export function LineChart({ data }: { data: { date: string; value: number }[] }) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const span = Math.max(1, Math.max(...values) - min);
  const points = data.map((d, i) => `${(i / (data.length - 1)) * 100},${38 - ((d.value - min) / span) * 36}`).join(" ");
  const delta = values[values.length - 1] - values[0];
  return (
    <>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-32 w-full md:h-40 border-b border-border" role="img" aria-label="Seguidores por dia">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="text-primary" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>
          {shortDate(data[0].date)} · {int(values[0])}
        </span>
        <span className={clsx("font-medium", delta > 0 ? "text-success" : delta < 0 ? "text-error" : "")}>
          {delta > 0 ? "+" : ""}
          {int(delta)}
        </span>
        <span>
          {shortDate(data[data.length - 1].date)} · {int(values[values.length - 1])}
        </span>
      </div>
    </>
  );
}

export function HBar({ label, value, max, wide }: { label: string; value: number; max: number; wide?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className={clsx("shrink-0 truncate text-muted", wide ? "w-24 md:w-28" : "w-11")}>{label}</span>
      <div className="h-3.5 flex-1">
        <div className="h-full rounded bg-primary" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-12 text-right font-medium">{int(value)}</span>
    </div>
  );
}
