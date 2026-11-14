import { z } from "zod";

// Só os campos que usamos; o resto do payload é ignorado (passthrough).
const account = z.object({ id: z.string(), platform: z.string() }).passthrough();

export const commentReceived = z.object({
  id: z.string().min(1),
  event: z.literal("comment.received"),
  timestamp: z.string().datetime({ offset: true }),
  test: z.boolean().optional(),
  account,
  comment: z
    .object({
      id: z.string().min(1),
      platformPostId: z.string().min(1),
      platform: z.string(),
      text: z.string().default(""),
      createdAt: z.string().datetime({ offset: true }),
      isReply: z.boolean().optional(),
      isLive: z.boolean().optional(),
      author: z
        .object({
          id: z.string().min(1),
          username: z.string().optional(),
          name: z.string().optional(),
          picture: z.string().url().nullable().optional(),
          isOwnAccount: z.boolean().optional(),
        })
        .passthrough(),
    })
    .passthrough(),
});

export const messageStatus = z.object({
  id: z.string().min(1),
  event: z.enum(["message.read", "message.delivered"]),
  timestamp: z.string().datetime({ offset: true }),
  account,
  message: z.object({ id: z.string(), platformMessageId: z.string().optional() }).passthrough(),
});

export const messageReceived = z.object({
  id: z.string().min(1),
  event: z.literal("message.received"),
  timestamp: z.string().datetime({ offset: true }),
  account,
  conversation: z.object({ participantId: z.string().optional() }).passthrough(),
  message: z.object({ direction: z.string().optional(), conversationId: z.string().optional() }).passthrough(),
});

export const envelope = z.object({
  id: z.string().min(1),
  event: z.string(),
  timestamp: z.string().datetime({ offset: true }),
});

/** A Zernio reenvia por até ~51 h; acima de 72 h é tratado como replay e ignorado. */
export const MAX_EVENT_AGE_MS = 72 * 60 * 60 * 1000;
