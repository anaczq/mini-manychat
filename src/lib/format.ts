const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 2 min", "há 3 dias"… */
export function timeAgo(date: Date, now = new Date()): string {
  const s = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return "agora";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), "day");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / (86400 * 7)), "week");
  return rtf.format(Math.round(s / (86400 * 30)), "month");
}

export const int = (n: number) => n.toLocaleString("pt-BR");

/** Porcentagem com 1 casa, ou "—" quando não há base. */
/** Tempo curto para listas estreitas: "agora", "5 min", "3 h", "2 d", "4 sem". */
export function shortAgo(date: Date, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d`;
  return `${Math.round(s / (86400 * 7))} sem`;
}

export function pct(part: number, total: number): string {
  if (!total) return "—";
  const v = (part / total) * 100;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v === 100 ? 0 : 1 })}%`;
}

export function compact(n?: number) {
  if (n === undefined) return "—";
  return n >= 10_000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : int(n);
}

export function seconds(s: number | null | undefined) {
  if (s === null || s === undefined) return "—";
  if (s < 90) return `${Math.round(s)} s`;
  return s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

export function shortDate(day: string) {
  return new Date(`${day.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export function rate(n?: number) {
  return n === undefined ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Variação contra o período anterior: "+12%", "-3%", "novo" ou "—"; com "pp", diferença em pontos percentuais. */
export function delta(cur: number, prev: number, unit: "%" | "pp" = "%") {
  if (unit === "pp") {
    const d = Math.round(cur - prev);
    return d ? `${d > 0 ? "+" : ""}${d} pp` : "=";
  }
  if (!prev) return cur ? "novo" : "—";
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d > 0 ? "+" : ""}${d}%`;
}
