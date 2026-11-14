import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const now = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const id = () =>
  text()
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);
const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/* ───────────────────────── Better Auth ───────────────────────── */

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text(),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  createdAt: now(),
  updatedAt: now(),
});

export const session = pgTable("session", {
  id: text().primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  createdAt: now(),
  updatedAt: now(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text().primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: now(),
  updatedAt: now(),
});

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: now(),
  updatedAt: now(),
});

export const twoFactor = pgTable("two_factor", {
  id: text().primaryKey(),
  secret: text().notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: boolean().default(false),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export const rateLimit = pgTable("rate_limit", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ───────────────────────── Domínio (PRD §5) ───────────────────────── */

export const connection = pgTable("connection", {
  userId: userId().primaryKey(),
  zernioAccountId: text("zernio_account_id").notNull(),
  igUserId: text("ig_user_id"),
  username: text().notNull(),
  profilePicture: text("profile_picture"),
  healthStatus: text("health_status").notNull().default("unknown"),
  lastHealthAt: timestamp("last_health_at", { withTimezone: true }),
  buttonsAllowed: boolean("buttons_allowed").notNull().default(false),
  lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),
});

export const assets = pgTable(
  "assets",
  {
    id: id(),
    userId: userId(),
    blobUrl: text("blob_url").notNull(),
    name: text().notNull().default("arquivo"),
    mime: text().notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text().notNull(),
    createdAt: now(),
  },
  (t) => [check("assets_mime", sql`${t.mime} in ('application/pdf','image/png','image/jpeg')`)],
);

export const keywords = pgTable(
  "keywords",
  {
    id: id(),
    userId: userId(),
    name: text().notNull(),
    terms: text().array().notNull(),
    termsNormalized: text("terms_normalized").array().notNull(),
    matchMode: text("match_mode").notNull().default("contains"),
    scope: text().notNull().default("all"),
    dmEnabled: boolean("dm_enabled").notNull().default(true),
    dmText: text("dm_text").notNull(),
    dmLinkUrl: text("dm_link_url"),
    assetId: text("asset_id").references(() => assets.id, { onDelete: "set null" }),
    buttonLabel: text("button_label"),
    publicReplyEnabled: boolean("public_reply_enabled").notNull().default(true),
    active: boolean().notNull().default(true),
    lastReplyId: text("last_reply_id"),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [
    check("keywords_match_mode", sql`${t.matchMode} in ('contains','exact')`),
    check("keywords_scope", sql`${t.scope} in ('all','specific')`),
    check("keywords_dm_text_len", sql`octet_length(${t.dmText}) <= 1000`),
    check("keywords_has_terms", sql`cardinality(${t.terms}) >= 1`),
  ],
);

export const keywordReplies = pgTable(
  "keyword_replies",
  {
    id: id(),
    userId: userId(),
    keywordId: text("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    text: text().notNull(),
  },
  (t) => [check("keyword_replies_len", sql`char_length(${t.text}) <= 300`)],
);

export const keywordPosts = pgTable(
  "keyword_posts",
  {
    userId: userId(),
    keywordId: text("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    platformPostId: text("platform_post_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.keywordId, t.platformPostId] })],
);

export const postsCache = pgTable("posts_cache", {
  platformPostId: text("platform_post_id").primaryKey(),
  userId: userId(),
  caption: text(),
  mediaType: text("media_type"),
  thumbnailUrl: text("thumbnail_url"),
  permalink: text(),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  fetchedAt: now(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  eventId: text("event_id").primaryKey(),
  userId: userId(),
  receivedAt: now(),
});

// Estados possíveis de cada comentário. A mesma lista vira tipo TS e CHECK no banco.
export const EVENT_STATUS = [
  "queued", "processing", "retry", "done", "partial", "failed",
  "no_match", "duplicate", "expired", "skipped_paused", "paused_quota", "rate_limited_user",
  "ignored_self", "ignored_live", "ignored_test",
] as const;
export const DM_STATUS = ["pending", "sent", "skipped", "failed", "failed_consumed", "unknown"] as const;
export const REPLY_STATUS = ["pending", "sent", "skipped", "failed"] as const;
export const MATERIAL_STATUS = ["awaiting_reply", "sending", "sent", "failed"] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];
export type DmStatus = (typeof DM_STATUS)[number];
export type ReplyStatus = (typeof REPLY_STATUS)[number];
export type MaterialStatus = (typeof MATERIAL_STATUS)[number];

const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(","));

export const commentEvents = pgTable(
  "comment_events",
  {
    id: id(),
    userId: userId(),
    igCommentId: text("ig_comment_id").notNull(),
    platformPostId: text("platform_post_id").notNull(),
    commenterId: text("commenter_id").notNull(),
    commenterUsername: text("commenter_username"),
    commenterPicture: text("commenter_picture"),
    commentText: text("comment_text"),
    commentCreatedAt: timestamp("comment_created_at", { withTimezone: true }).notNull(),
    keywordId: text("keyword_id").references(() => keywords.id, { onDelete: "set null" }),
    status: text().$type<EventStatus>().notNull().default("queued"),
    dmStatus: text("dm_status").$type<DmStatus>().notNull().default("pending"),
    dmMessageId: text("dm_message_id"),
    dmSentAt: timestamp("dm_sent_at", { withTimezone: true }),
    dmReadAt: timestamp("dm_read_at", { withTimezone: true }),
    dmRepliedAt: timestamp("dm_replied_at", { withTimezone: true }),
    dmErrorCode: text("dm_error_code"),
    // Arquivo como anexo: vai só depois que a pessoa responde o DM (Instagram não aceita anexo na Private Reply).
    // awaiting_reply → sending → sent (falha volta para awaiting_reply e tenta de novo na próxima resposta).
    materialStatus: text("material_status").$type<MaterialStatus>(),
    materialSentAt: timestamp("material_sent_at", { withTimezone: true }),
    replyStatus: text("reply_status").$type<ReplyStatus>().notNull().default("pending"),
    replyCommentId: text("reply_comment_id"),
    replyErrorCode: text("reply_error_code"),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    source: text().notNull().default("webhook"),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [
    uniqueIndex("comment_events_ig_comment_id").on(t.igCommentId),
    index("comment_events_user_created").on(t.userId, t.createdAt),
    // Cota mensal de DMs (processor.sendDm e dashboard): conta só os enviados do mês, sem varrer a tabela.
    index("comment_events_dm_sent_at").on(t.dmSentAt).where(sql`${t.dmStatus} = 'sent'`),
    check("comment_events_text_len", sql`char_length(${t.commentText}) <= 500`),
    check("comment_events_status", sql`${t.status} in (${oneOf(EVENT_STATUS)})`),
    check("comment_events_dm_status", sql`${t.dmStatus} in (${oneOf(DM_STATUS)})`),
    check("comment_events_reply_status", sql`${t.replyStatus} in (${oneOf(REPLY_STATUS)})`),
    check("comment_events_material_status", sql`${t.materialStatus} in (${oneOf(MATERIAL_STATUS)})`),
  ],
);

export const dispatches = pgTable(
  "dispatches",
  {
    id: id(),
    userId: userId(),
    commenterId: text("commenter_id").notNull(),
    keywordId: text("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    platformPostId: text("platform_post_id").notNull(),
    commentEventId: text("comment_event_id")
      .notNull()
      .references(() => commentEvents.id, { onDelete: "cascade" }),
    createdAt: now(),
  },
  (t) => [uniqueIndex("dispatches_once").on(t.commenterId, t.keywordId, t.platformPostId)],
);

export const settings = pgTable("settings", {
  userId: userId().primaryKey(),
  automationEnabled: boolean("automation_enabled").notNull().default(true),
  perUserDailyCap: integer("per_user_daily_cap").notNull().default(3),
  outboundHourlyBudget: integer("outbound_hourly_budget").notNull().default(600),
  monthlyDmBudget: integer("monthly_dm_budget").notNull().default(10000),
  timezone: text().notNull().default("America/Sao_Paulo"),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  userId: userId(),
  action: text().notNull(),
  ipHash: text("ip_hash"),
  createdAt: now(),
});

export const linkTokens = pgTable("link_tokens", {
  token: text().primaryKey(),
  userId: userId(),
  commentEventId: text("comment_event_id")
    .notNull()
    .references(() => commentEvents.id, { onDelete: "cascade" }),
  destinationUrl: text("destination_url").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const linkClicks = pgTable("link_clicks", {
  id: id(),
  userId: userId(),
  commentEventId: text("comment_event_id")
    .notNull()
    .unique()
    .references(() => commentEvents.id, { onDelete: "cascade" }),
  keywordId: text("keyword_id").references(() => keywords.id, { onDelete: "set null" }),
  firstClickedAt: now(),
  clickCount: integer("click_count").notNull().default(1),
});

export const analyticsSnapshots = pgTable(
  "analytics_snapshots",
  {
    userId: userId(),
    kind: text().notNull(),
    rangeDays: integer("range_days").notNull(),
    payload: jsonb().notNull(),
    fetchedAt: now(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.rangeDays] })],
);
