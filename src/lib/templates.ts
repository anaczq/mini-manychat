import type { AutomationInput } from "@/lib/automations";

const base: AutomationInput = {
  name: "",
  terms: [],
  matchMode: "contains",
  scope: "all",
  postIds: [],
  dmEnabled: true,
  dmText: "",
  dmLinkUrl: undefined,
  assetId: undefined,
  buttonLabel: undefined,
  publicReplyEnabled: true,
  replies: ["Enviado no seu direct! 📩", "Te mandei por DM, confere lá 💌", "Prontinho, olha seu direct ✨"],
  active: true,
};

// O Instagram não aceita anexo na primeira mensagem: o arquivo sai quando a pessoa responder.
export const ARQUIVO_DM_TEXT =
  "Oi {{first_name}}! Pra receber o material, responde essa mensagem com qualquer coisa 😊 O Instagram não me deixa enviar anexo sem a sua interação.";

// Modelos do popup "Nova automação" (Figma M1).
export const TEMPLATES: Record<string, AutomationInput> = {
  link: { ...base, name: "Link por DM", dmText: "Oi {{first_name}}! Aqui está o link que você pediu 👇" },
  arquivo: { ...base, name: "Entregar material", dmText: ARQUIVO_DM_TEXT },
  resposta: { ...base, name: "Responder comentários", dmEnabled: false },
  zero: { ...base, replies: [""] },
};

export function templateFor(key: string | undefined): AutomationInput {
  return structuredClone(TEMPLATES[key ?? ""] ?? TEMPLATES.zero);
}
