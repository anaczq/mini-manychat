import clsx from "clsx";
import { int, shortDate } from "@/lib/format";

// Gráficos simples em HTML/SVG, sem biblioteca (Analytics). Visual do Figma "08 · Analytics".

/** Número curto para eixo e rótulos: 1.500 → "1,5 mil". */
export function axisNumber(n: number) {
  return n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : int(n);
}

/** Passo "redondo" (1, 2, 2,5, 5 × 10ⁿ) para 3 divisões do eixo. */
function niceStep(raw: number) {
  if (raw <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return Math.max(1, Math.round(step));
}

/** Eixo Y com 4 linhas (base + 3 de grade) e os rótulos à esquerda. */
function Grid({ ticks }: { ticks: number[] }) {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        {[...ticks].reverse().map((t, i) => (
          <div key={t} className={clsx("relative h-px", i === ticks.length - 1 ? "bg-border-strong" : "bg-subtle")}>
            <span className="absolute -top-1.5 right-full mr-2 font-mono text-[10px] leading-none whitespace-nowrap text-tertiary">{axisNumber(t)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function XLabels({ labels }: { labels: { at: number; text: string }[] }) {
  return (
    <div aria-hidden className="relative mt-2 h-3 font-mono text-[10px] leading-none text-tertiary">
      {labels.map((l, i) => (
        <span
          key={i}
          className={clsx("absolute whitespace-nowrap", i === 0 ? "" : i === labels.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
          style={{ left: `${l.at}%` }}
        >
          {l.text}
        </span>
      ))}
    </div>
  );
}

/** Barras por dia com grade, pico destacado e 5 datas no eixo. */
export function BarsChart({ data, unit, label }: { data: { day: string; n: number }[]; unit: string; label: string }) {
  const max = Math.max(0, ...data.map((d) => d.n));
  const step = niceStep(max / 3);
  const top = step * 3;
  const peak = max ? data.findIndex((d) => d.n === max) : -1;
  const n = data.length;
  const ticks = n > 1 ? [0, 1, 2, 3, 4].map((i) => Math.round((i * (n - 1)) / 4)).filter((v, i, a) => a.indexOf(v) === i) : [0];
  return (
    <div className="w-full pl-9 md:pl-11">
      <div className="relative h-[120px] md:h-[144px]">
        <Grid ticks={[0, step, step * 2, top]} />
        <div className={clsx("absolute inset-0 flex items-end", n > 45 ? "gap-px" : n > 20 ? "gap-0.5 md:gap-[5px]" : "gap-1.5 md:gap-3")} role="img" aria-label={label}>
          {data.map((d, i) => (
            <div key={d.day} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
              {d.n ? (
                <div className="w-full max-w-5 rounded-t bg-primary group-hover:bg-primary-hover" style={{ height: `${(d.n / top) * 100}%` }} />
              ) : (
                <div className="h-0.5 w-full max-w-5 rounded-[1px] bg-border" />
              )}
              {i === peak && (
                <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-ink" style={{ bottom: `calc(${(d.n / top) * 100}% + 4px)` }}>
                  {axisNumber(d.n)}
                </span>
              )}
              <span className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 rounded-full bg-dark px-2.5 py-1 text-[11px] whitespace-nowrap text-white md:group-hover:block">
                {shortDate(d.day)} · {int(d.n)} {unit}
              </span>
            </div>
          ))}
        </div>
      </div>
      {n > 0 && <XLabels labels={ticks.map((i) => ({ at: n > 1 ? (i / (n - 1)) * 100 : 0, text: shortDate(data[i].day) }))} />}
    </div>
  );
}

/** Linha da contagem de seguidores com área; o eixo vai do mínimo ao máximo para a variação aparecer. */
export function LineChart({ data }: { data: { date: string; value: number }[] }) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  let step = niceStep((max - min) / 3);
  let lo = Math.floor(min / step) * step;
  while (lo + step * 3 < max) {
    step = niceStep(step + 1);
    lo = Math.floor(min / step) * step;
  }
  const hi = lo + step * 3;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <div className="w-full pl-11">
      <div className="relative h-[120px] md:h-[144px]">
        <Grid ticks={[lo, lo + step, lo + step * 2, hi]} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" role="img" aria-label="Seguidores por dia">
          <polygon points={`0,100 ${points} 100,100`} className="fill-primary/8" />
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="text-primary" />
        </svg>
        <span className="absolute size-2.5 -translate-1/2 rounded-full border-2 border-surface bg-primary" style={{ left: "100%", top: `${y(last)}%` }} />
        <span className="absolute -translate-x-full text-[11px] font-semibold whitespace-nowrap" style={{ left: "100%", top: `calc(${y(last)}% - 22px)` }}>
          {int(last)}
        </span>
      </div>
      <XLabels
        labels={[
          { at: 0, text: shortDate(data[0].date) },
          { at: 100, text: shortDate(data[data.length - 1].date) },
        ]}
      />
    </div>
  );
}

/** Barra horizontal com rótulo e valor (histograma de tempo de resposta). */
export function HBar({ label, value, max, wide }: { label: string; value: number; max: number; wide?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className={clsx("shrink-0 truncate font-medium", wide ? "w-24 md:w-28" : "w-14")}>{label}</span>
      <div className="h-2.5 min-w-0 flex-1 rounded-[5px] bg-subtle">
        <div className="h-full rounded-[5px] bg-primary" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-12 text-right text-sm font-semibold">{int(value)}</span>
    </div>
  );
}
