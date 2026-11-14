// Mensagens genéricas: nunca dizem se o e-mail existe (PRD §7.1).
export function authErrorMessage(error: { status?: number; message?: string } | null | undefined) {
  if (!error) return null;
  if (error.status === 429) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (error.status === 401 || error.status === 400) return "E-mail, senha ou código incorretos.";
  return "Não foi possível entrar agora. Tente de novo.";
}
