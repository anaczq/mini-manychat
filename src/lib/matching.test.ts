import { describe, expect, it } from "vitest";
import { type MatchableKeyword, matchesTerm, normalize, pickKeyword } from "./matching";

const kw = (over: Partial<MatchableKeyword> & { terms: string[] }): MatchableKeyword => ({
  id: over.terms.join("+"),
  termsNormalized: over.terms.map(normalize),
  matchMode: over.matchMode ?? "contains",
  scope: over.scope ?? "all",
  postIds: over.postIds ?? [],
  createdAt: over.createdAt ?? new Date("2026-01-01"),
});

describe("normalize", () => {
  it("remove acentos, caixa, pontuação e emojis", () => {
    expect(normalize("Quêro o EBOOK!! 😍")).toBe("quero o ebook");
    expect(normalize("  É-BOOK…  ")).toBe("e book");
    expect(normalize("ação")).toBe("acao");
  });
});

describe("matchesTerm", () => {
  it("contém: casa palavra inteira (CA06)", () => {
    expect(matchesTerm(normalize("Quero!! 😍"), "quero", "contains")).toBe(true);
    expect(matchesTerm(normalize("eu QUERO muito"), "quero", "contains")).toBe(true);
  });

  it("contém: não casa substring (CA08)", () => {
    expect(matchesTerm(normalize("linkedin"), "link", "contains")).toBe(false);
    expect(matchesTerm(normalize("querooo"), "quero", "contains")).toBe(false);
    expect(matchesTerm(normalize("requero"), "quero", "contains")).toBe(false);
    expect(matchesTerm(normalize("ebooks"), "ebook", "contains")).toBe(false);
  });

  it("exato: ignora acento e pontuação, mas exige o comentário inteiro (CA07)", () => {
    expect(matchesTerm(normalize("Quêro"), "quero", "exact")).toBe(true);
    expect(matchesTerm(normalize("QUERO!"), "quero", "exact")).toBe(true);
    expect(matchesTerm(normalize("quero sim"), "quero", "exact")).toBe(false);
  });

  it("exato: emojis e pontuação em volta não atrapalham", () => {
    expect(matchesTerm(normalize("EBOOK 😍🔥"), "ebook", "exact")).toBe(true);
    expect(matchesTerm(normalize("🙏 ebook!!! 🙏"), "ebook", "exact")).toBe(true);
    expect(matchesTerm(normalize("😍😍"), "ebook", "exact")).toBe(false);
  });

  it("termos com várias palavras e hífen", () => {
    expect(matchesTerm(normalize("me manda o e-book pfv"), normalize("E-BOOK"), "contains")).toBe(true);
  });

  it("termo vazio nunca casa", () => {
    expect(matchesTerm("qualquer", "", "contains")).toBe(false);
  });
});

describe("pickKeyword", () => {
  it("respeita o escopo de posts (CA12)", () => {
    const k = kw({ terms: ["ebook"], scope: "specific", postIds: ["p1"] });
    expect(pickKeyword([k], "ebook", "p1")).toBe(k);
    expect(pickKeyword([k], "ebook", "p2")).toBeNull();
  });

  it("específico vence global", () => {
    const global = kw({ terms: ["ebook"] });
    const specific = kw({ terms: ["ebook"], scope: "specific", postIds: ["p1"], createdAt: new Date("2026-06-01") });
    expect(pickKeyword([global, specific], "quero ebook", "p1")).toBe(specific);
  });

  it("exato vence contém", () => {
    const contains = kw({ terms: ["link"] });
    const exact = kw({ terms: ["link"], matchMode: "exact", createdAt: new Date("2026-06-01") });
    expect(pickKeyword([contains, exact], "LINK", "p1")).toBe(exact);
  });

  it("termo mais longo vence", () => {
    const short = kw({ terms: ["quero"] });
    const long = kw({ terms: ["quero o ebook"], createdAt: new Date("2026-06-01") });
    expect(pickKeyword([short, long], "quero o ebook!", "p1")).toBe(long);
  });

  it("empate total: a mais antiga vence", () => {
    const old = kw({ terms: ["aula"], createdAt: new Date("2026-01-01") });
    const recent = kw({ terms: ["aula"], createdAt: new Date("2026-05-01") });
    expect(pickKeyword([recent, old], "aula", "p1")).toBe(old);
  });

  it("nenhuma casa → null", () => {
    expect(pickKeyword([kw({ terms: ["ebook"] })], "amei esse post", "p1")).toBeNull();
  });
});
