export function Sparkline({ points, color, label }: { points: readonly number[]; color: string; label: string }) {
  const w = 230;
  const h = 40;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const d = points
    .map((v, i) => `${i ? "L" : "M"}${((i * w) / (points.length - 1)).toFixed(1)} ${(h - ((v - min) / (max - min || 1)) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
