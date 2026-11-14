import { processCommentEvent } from "@/lib/processor";
import { commentJob, queue } from "@/lib/queue";

// Consumidor da fila "comentarios" (registrado em vercel.json). O SDK busca a mensagem no Vercel Queues
// com o OIDC do projeto, então um POST forjado não injeta conteúdo. O processador é idempotente.
export const POST = queue().handleCallback(
  async (message) => {
    const job = commentJob.safeParse(message);
    if (!job.success) return; // mensagem inválida: confirma e descarta
    await processCommentEvent(job.data.userId, job.data.eventId);
  },
  {
    // Erro inesperado (banco fora, etc.): poucas retentativas; depois disso o cron cobre.
    retry: (_err, meta) => (meta.deliveryCount > 5 ? { acknowledge: true } : { afterSeconds: Math.min(1800, 30 * 2 ** meta.deliveryCount) }),
  },
);
