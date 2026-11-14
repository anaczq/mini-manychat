// Regra de correspondência de palavras-chave (PRD §4.4).

export type MatchMode = "contains" | "exact";

export type MatchableKeyword = {
  id: string;
  termsNormalized: string[];
  matchMode: MatchMode;
  scope: "all" | "specific";
  postIds: string[];
  createdAt: Date;
};

/** NFKD → sem acentos → minúsculas → pontuação/emojis viram espaço → espaços colapsados. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "contains" = termo como sequência de palavras inteiras; "exact" = o comentário inteiro é o termo. */
export function matchesTerm(normalizedComment: string, normalizedTerm: string, mode: MatchMode): boolean {
  if (!normalizedTerm) return false;
  if (mode === "exact") return normalizedComment === normalizedTerm;
  return ` ${normalizedComment} `.includes(` ${normalizedTerm} `);
}

function longestMatchedTerm(k: MatchableKeyword, normalizedComment: string): number {
  let best = -1;
  for (const term of k.termsNormalized) {
    if (matchesTerm(normalizedComment, term, k.matchMode)) best = Math.max(best, term.length);
  }
  return best;
}

/**
 * Escolhe no máximo 1 automação para o comentário.
 * Desempate: escopo específico > global; exato > contém; termo mais longo; a mais antiga.
 */
export function pickKeyword<K extends MatchableKeyword>(keywords: K[], commentText: string, postId: string): K | null {
  const comment = normalize(commentText);
  const candidates = keywords
    .filter((k) => k.scope === "all" || k.postIds.includes(postId))
    .map((k) => ({ k, len: longestMatchedTerm(k, comment) }))
    .filter((c) => c.len >= 0);

  candidates.sort(
    (a, b) =>
      Number(b.k.scope === "specific") - Number(a.k.scope === "specific") ||
      Number(b.k.matchMode === "exact") - Number(a.k.matchMode === "exact") ||
      b.len - a.len ||
      a.k.createdAt.getTime() - b.k.createdAt.getTime(),
  );
  return candidates[0]?.k ?? null;
}
