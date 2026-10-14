import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Relative on purpose: drizzle-kit loads this file without the "@/" alias.
import { BILLING_CYCLES, BUSINESS_STATUSES, LINK_KINDS } from "../business-constants";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/**
 * Everyone who can sign in is a super admin with full access. "owner" is the
 * default one, made at setup, and can't be removed; "admin" is one added
 * later in Settings.
 */
export const USER_ROLES = ["owner", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Always stored lower-cased; see normalizeEmail().
    email: text("email").notNull(),
    // What they sign in with. Lower-cased; see normalizeUsername().
    username: text("username"),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("owner"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_username_unique").on(t.username),
    check("users_role_check", sql`${t.role} in ('owner', 'admin')`),
  ],
);

/**
 * A 6-digit sign-in code sent by email. Only a hash is kept; one per user
 * (a new request replaces the old one); it expires in minutes and allows a
 * few tries before it is thrown away.
 */
export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("login_codes_user_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie token, so a database leak doesn't leak live sessions.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const ACTIVITY_STATUSES = ["success", "failure", "pending", "info"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    actor: text("actor", { enum: ["user", "system", "ai"] }).notNull().default("user"),
    // Dotted event name, e.g. "auth.login" or "ai.chat".
    action: text("action").notNull(),
    request: text("request"),
    decision: text("decision"),
    tool: text("tool"),
    result: text("result"),
    status: text("status", { enum: ACTIVITY_STATUSES }).notNull(),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_created_idx").on(t.createdAt),
    index("activity_action_idx").on(t.action),
    index("activity_status_idx").on(t.status),
    check("activity_status_check", sql`${t.status} in ('success', 'failure', 'pending', 'info')`),
    check("activity_actor_check", sql`${t.actor} in ('user', 'system', 'ai')`),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("conversations_user_updated_idx").on(t.userId, t.updatedAt)],
);

/*
 * Businesses: the owner's own records, kept in JodyOS. Everything here is
 * typed in (or imported) by the owner; OS Analytics can add live numbers on
 * top when it is connected, matched by slug.
 */

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    /** What the business is, in plain text; "# Heading" lines start a section. */
    about: text("about"),
    websiteUrl: text("website_url"),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    status: text("status", { enum: BUSINESS_STATUSES }).notNull().default("active"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("businesses_slug_unique").on(t.slug),
    check("businesses_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("businesses_status_check", sql`${t.status} in ('active', 'paused')`),
  ],
);

export const businessLinks = pgTable(
  "business_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    kind: text("kind", { enum: LINK_KINDS }).notNull().default("page"),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("business_links_business_idx").on(t.businessId),
    check("business_links_kind_check", sql`${t.kind} in ('page', 'social', 'login', 'tool', 'other')`),
  ],
);

export const businessFaqs = pgTable(
  "business_faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer"),
    linkLabel: text("link_label"),
    linkUrl: text("link_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("business_faqs_business_idx").on(t.businessId)],
);

/** One website of a business: domain, hosting, SSL and where to log in. Never passwords. */
export const businessSites = pgTable(
  "business_sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    url: text("url"),
    platform: text("platform"),
    /** Where the owner edits the site: a Claude Code session, the WordPress admin, the Kajabi dashboard… */
    editUrl: text("edit_url"),
    registrar: text("registrar"),
    registrarAccount: text("registrar_account"),
    registrarLoginUrl: text("registrar_login_url"),
    domainExpiry: date("domain_expiry", { mode: "string" }),
    domainAutoRenew: boolean("domain_auto_renew").notNull().default(false),
    hostingProvider: text("hosting_provider"),
    hostingPlan: text("hosting_plan"),
    hostingAccount: text("hosting_account"),
    hostingLoginUrl: text("hosting_login_url"),
    hostingExpiry: date("hosting_expiry", { mode: "string" }),
    sslProvider: text("ssl_provider"),
    sslExpiry: date("ssl_expiry", { mode: "string" }),
    serverIp: text("server_ip"),
    nameservers: text("nameservers"),
    lastBackup: date("last_backup", { mode: "string" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("business_sites_business_idx").on(t.businessId)],
);

/** A paid tool. No business = shared by all businesses. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("other"),
    billingCycle: text("billing_cycle", { enum: BILLING_CYCLES }).notNull().default("monthly"),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    nextRenewal: date("next_renewal", { mode: "string" }),
    loginUrl: text("login_url"),
    account: text("account"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("subscriptions_business_idx").on(t.businessId),
    check("subscriptions_cycle_check", sql`${t.billingCycle} in ('monthly', 'yearly', 'quarterly', 'one_time')`),
    check("subscriptions_amount_check", sql`${t.amount} >= 0`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    model: text("model"),
    stopReason: text("stop_reason"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_conversation_created_idx").on(t.conversationId, t.createdAt),
    check("messages_role_check", sql`${t.role} in ('user', 'assistant')`),
  ],
);
