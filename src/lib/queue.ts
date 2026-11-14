import "server-only";
import { QueueClient } from "@vercel/queue";
import { z } from "zod";

// Fila de comentários (PRD D4). Mensagem só com IDs: o estado de verdade fica no banco (comment_events).
export const COMMENT_TOPIC = "comentarios";
export const commentJob = z.object({ userId: z.string().min(1), eventId: z.string().uuid() });
export type CommentJob = z.infer<typeof commentJob>;

let client: QueueClient | undefined;
export const queue = () => (client ??= new QueueClient({ region: "gru1" }));

/**
 * Enfileira o processamento de um comentário, com atraso opcional (backoff).
 * Falha da fila não é fatal: devolve false e o cron pega o evento parado (dueEventIds).
 */
export async function enqueueComment(job: CommentJob, delaySeconds = 0, attempt = 0): Promise<boolean> {
  try {
    await queue().send(COMMENT_TOPIC, job, {
      delaySeconds: Math.max(0, Math.ceil(delaySeconds)),
      // Um envio por tentativa: reenviar a mesma tentativa não duplica a mensagem.
      idempotencyKey: `${job.eventId}:${attempt}`,
    });
    return true;
  } catch (err) {
    console.log(JSON.stringify({ event: "queue_send_failed", id: job.eventId, error: err instanceof Error ? err.name : "unknown" }));
    return false;
  }
}
