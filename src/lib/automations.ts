import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { asWeb, schema } from "@/db";
import { normalize } from "@/lib/matching";

const { keywords, keywordReplies, keywordPosts, commentEvents } = schema;

/* ───────── Validação do formulário do editor (PRD RF04–RF07) ───────── */

const httpsUrl = z
  .string()
  .trim()
  .url("Link inválido")
  .refine((u) => u.startsWith("https://"), "Use um link https://");

export const automationInput = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à automação").max(80),
    terms: z
      .array(z.string().trim().min(1).max(60))
      .min(1, "Adicione pelo menos 1 palavra-chave")
      .max(20)
      .refine((t) => t.every((x) => normalize(x).length > 0), "Palavra-chave precisa ter letras ou números"),
    matchMode: z.enum(["contains", "exact"]),
    scope: z.enum(["all", "specific"]),
    postIds: z.array(z.string().min(1).max(64)).max(50),
    dmEnabled: z.boolean(),
    dmText: z
      .string()
      .trim()
      .refine((t) => new TextEncoder().encode(t).length <= 1000, "A mensagem passa de 1000 caracteres"),
    dmLinkUrl: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
    assetId: z.string().uuid().optional().nullable().transform((v) => v ?? undefined),
    buttonLabel: z.string().trim().max(20).optional().or(z.literal("").transform(() => undefined)),
    publicReplyEnabled: z.boolean(),
    replies: z.array(z.string().trim().min(1).max(300)).max(10),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.dmEnabled && !v.dmText) {
      ctx.addIssue({ code: "custom", path: ["dmText"], message: "Escreva a mensagem do Direct" });
    }
    if (v.dmLinkUrl && v.assetId) {
      ctx.addIssue({ code: "custom", path: ["dmLinkUrl"], message: "Escolha link ou arquivo, não os dois" });
    }
    if (!v.dmEnabled && !v.publicReplyEnabled) {
      ctx.addIssue({ code: "custom", path: ["replies"], message: "Ligue o Direct ou a resposta pública: a automação precisa fazer algo" });
    }
    if (v.scope === "specific" && v.postIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["postIds"], message: "Escolha pelo menos 1 post ou mude para “qualquer post”" });
    }
    if (v.publicReplyEnabled && v.replies.length === 0) {
      ctx.addIssue({ code: "custom", path: ["replies"], message: "Adicione pelo menos 1 resposta pública ou desligue a opção" });
    }
  });

export type AutomationInput = z.infer<typeof automationInput>;

/* ───────── Leitura ───────── */

export type AutomationRow = {
  id: string;
  name: string;
  terms: string[];
  scope: "all" | "specific";
  postCount: number;
  active: boolean;
  runs: number;
  sent: number;
  failed: number;
  updatedAt: Date;
};

export async function listAutomations(userId: string): Promise<AutomationRow[]> {
  return asWeb(userId, async (tx) => {
    const rows = await tx
      .select({
        id: keywords.id,
        name: keywords.name,
        terms: keywords.terms,
        scope: keywords.scope,
        active: keywords.active,
        updatedAt: keywords.updatedAt,
        // Subconsultas com nomes qualificados: o Drizzle não qualifica colunas numa query de uma tabela só.
        postCount: sql<number>`(select count(*)::int from keyword_posts kp where kp.keyword_id = "keywords"."id")`,
        runs: sql<number>`(select count(*)::int from comment_events ce where ce.keyword_id = "keywords"."id")`,
        sent: sql<number>`(select count(*)::int from comment_events ce where ce.keyword_id = "keywords"."id" and ce.dm_status = 'sent')`,
        failed: sql<number>`(select count(*)::int from comment_events ce where ce.keyword_id = "keywords"."id" and ce.dm_status like 'failed%')`,
      })
      .from(keywords)
      .orderBy(desc(keywords.active), asc(keywords.createdAt));
    return rows.map((r) => ({ ...r, scope: r.scope as AutomationRow["scope"] }));
  });
}

export async function getAutomation(userId: string, id: string): Promise<(AutomationInput & { id: string }) | null> {
  return asWeb(userId, async (tx) => {
    const [k] = await tx.select().from(keywords).where(eq(keywords.id, id));
    if (!k) return null;
    const replies = await tx.select({ text: keywordReplies.text }).from(keywordReplies).where(eq(keywordReplies.keywordId, id));
    const posts = await tx.select({ id: keywordPosts.platformPostId }).from(keywordPosts).where(eq(keywordPosts.keywordId, id));
    return {
      id: k.id,
      name: k.name,
      terms: k.terms,
      matchMode: k.matchMode as AutomationInput["matchMode"],
      scope: k.scope as AutomationInput["scope"],
      postIds: posts.map((p) => p.id),
      dmEnabled: k.dmEnabled,
      dmText: k.dmText,
      dmLinkUrl: k.dmLinkUrl ?? undefined,
      assetId: k.assetId ?? undefined,
      buttonLabel: k.buttonLabel ?? undefined,
      publicReplyEnabled: k.publicReplyEnabled,
      replies: replies.map((r) => r.text),
      active: k.active,
    };
  });
}

/* ───────── Escrita ───────── */

export async function saveAutomation(userId: string, id: string | null, input: AutomationInput): Promise<string> {
  return asWeb(userId, async (tx) => {
    const values = {
      userId,
      name: input.name,
      terms: input.terms,
      termsNormalized: input.terms.map(normalize),
      matchMode: input.matchMode,
      scope: input.scope,
      dmEnabled: input.dmEnabled,
      dmText: input.dmText,
      dmLinkUrl: input.dmLinkUrl ?? null,
      assetId: input.assetId ?? null,
      buttonLabel: input.buttonLabel ?? null,
      publicReplyEnabled: input.publicReplyEnabled,
      active: input.active,
      updatedAt: new Date(),
    };
    let keywordId = id;
    if (keywordId) {
      const updated = await tx.update(keywords).set(values).where(eq(keywords.id, keywordId)).returning({ id: keywords.id });
      if (!updated.length) throw new Error("Automação não encontrada");
      await tx.delete(keywordReplies).where(eq(keywordReplies.keywordId, keywordId));
      await tx.delete(keywordPosts).where(eq(keywordPosts.keywordId, keywordId));
    } else {
      [{ id: keywordId }] = await tx.insert(keywords).values(values).returning({ id: keywords.id });
    }
    if (input.replies.length) {
      await tx.insert(keywordReplies).values(input.replies.map((text) => ({ userId, keywordId: keywordId!, text })));
    }
    if (input.scope === "specific" && input.postIds.length) {
      await tx.insert(keywordPosts).values([...new Set(input.postIds)].map((platformPostId) => ({ userId, keywordId: keywordId!, platformPostId })));
    }
    return keywordId!;
  });
}

export async function setAutomationActive(userId: string, id: string, active: boolean) {
  await asWeb(userId, (tx) => tx.update(keywords).set({ active, updatedAt: new Date() }).where(eq(keywords.id, id)));
}

export async function deleteAutomation(userId: string, id: string) {
  await asWeb(userId, (tx) => tx.delete(keywords).where(eq(keywords.id, id)));
}

export async function duplicateAutomation(userId: string, id: string): Promise<string | null> {
  const source = await getAutomation(userId, id);
  if (!source) return null;
  return saveAutomation(userId, null, { ...source, name: `${source.name} (cópia)`, active: false });
}

/** Aviso de conflito (RF08): outra automação ativa com o mesmo termo e escopo sobreposto. */
export async function findTermConflicts(userId: string, selfId: string | null, input: AutomationInput) {
  const normalized = input.terms.map(normalize);
  return asWeb(userId, async (tx) => {
    const others = await tx
      .select({ id: keywords.id, name: keywords.name, terms: keywords.termsNormalized, scope: keywords.scope })
      .from(keywords)
      .where(
        and(
          eq(keywords.active, true),
          sql`${keywords.termsNormalized} && array[${sql.join(
            normalized.map((t) => sql`${t}`),
            sql`, `,
          )}]::text[]`,
        ),
      );
    const relevant = others.filter((o) => o.id !== selfId);
    if (!relevant.length || input.scope === "all") return relevant.map((o) => o.name);
    const posts = await tx
      .select({ keywordId: keywordPosts.keywordId, post: keywordPosts.platformPostId })
      .from(keywordPosts)
      .where(inArray(keywordPosts.keywordId, relevant.map((o) => o.id)));
    return relevant
      .filter((o) => o.scope === "all" || posts.some((p) => p.keywordId === o.id && input.postIds.includes(p.post)))
      .map((o) => o.name);
  });
}

/** Números dos últimos 7 dias para o card do editor. */
export async function automationWeekStats(userId: string, id: string) {
  const since = new Date(Date.now() - 7 * 86400_000);
  return asWeb(userId, async (tx) => {
    const [r] = await tx
      .select({
        runs: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) filter (where ${commentEvents.dmStatus} = 'sent')::int`,
        read: sql<number>`count(*) filter (where ${commentEvents.dmReadAt} is not null)::int`,
        clicked: sql<number>`(select count(*)::int from ${schema.linkClicks} where ${schema.linkClicks.keywordId} = ${id} and ${schema.linkClicks.firstClickedAt} >= ${since})`,
      })
      .from(commentEvents)
      .where(and(eq(commentEvents.keywordId, id), sql`${commentEvents.createdAt} >= ${since}`));
    return r;
  });
}
