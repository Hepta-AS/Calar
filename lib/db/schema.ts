import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  customType,
} from "drizzle-orm/pg-core";

// pgvector type for embeddings
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value.replace(/^\[/, "[").replace(/\]$/, "]"));
  },
});

// Type definitions for JSON columns
export interface ScoreBreakdown {
  pageViews: number;
  highValuePages: number;
  repeatedVisits: number;
  businessEmail: number;
  enrichment: number;
  total: number;
  calculatedAt: string;
}

export interface SignalPayload {
  leadEmail: string;
  leadName?: string;
  score: number;
  triggerReason: string;
}

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  apiKey: text("api_key"),
  logoUrl: text("logo_url"),
  logoFileId: uuid("logo_file_id"),
  domain: text("domain"),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  plan: text("plan"),
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const tenantUsers = pgTable("tenant_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  email: text("email").notNull(),
  displayName: text("display_name"),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  smtpEmail: text("smtp_email"),
  reportNotifyEmail: text("report_notify_email"),
  avatarFileId: uuid("avatar_file_id"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const visits = pgTable("visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  visitorId: text("visitor_id").notNull(),
  url: text("url").notNull(),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  // Engagement metrics
  duration: integer("duration"), // seconds on page
  scrollDepth: integer("scroll_depth"), // 0-100 percentage
  isEngaged: boolean("is_engaged").default(false), // >10s or >50% scroll
  exitedAt: timestamp("exited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  visitorId: text("visitor_id").notNull(),
  visitId: uuid("visit_id").references(() => visits.id),
  type: text("type").notNull(), // 'click' | 'custom' | 'form_start' | 'video_play' etc
  name: text("name").notNull(), // 'pricing_btn' | 'demo_cta' | 'nav_contact'
  properties: jsonb("properties").$type<Record<string, unknown>>(),
  url: text("url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  visitorId: text("visitor_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  // Intelligence fields
  score: integer("score").default(0).notNull(),
  scoreBreakdown: jsonb("score_breakdown").$type<ScoreBreakdown>(),
  enrichedCompany: text("enriched_company"),
  enrichedIndustry: text("enriched_industry"),
  enrichedEmployeeCount: text("enriched_employee_count"),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  // Additional fields from database
  ipAddress: text("ip_address"),
  externalIds: jsonb("external_ids").$type<Record<string, string>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const visitors = pgTable("visitors", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  visitorId: text("visitor_id"),
  visitorUuid: uuid("visitor_uuid"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const attributions = pgTable("attributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  visitorId: text("visitor_id"),
  leadId: uuid("lead_id").references(() => leads.id),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  referrer: text("referrer"),
  landingPage: text("landing_page"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  key: text("key"),
  keyHash: text("key_hash"),
  keyPrefix: text("key_prefix"),
  name: text("name"),
  status: text("status"),
  scopes: jsonb("scopes").$type<string[]>(),
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  coverFileId: uuid("cover_file_id"),
  utmLink: text("utm_link"),
  spendingPerMonth: text("spending_per_month"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const signals = pgTable("signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  type: text("type").notNull(), // 'score_threshold' | 'high_intent' | 'returning_visitor'
  status: text("status").notNull().default("pending"), // 'pending' | 'delivered' | 'failed'
  payload: jsonb("payload").$type<SignalPayload>(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const embeddings = pgTable("embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  sourceText: text("source_text").notNull(),
  embedding: vector("embedding"),
  model: text("model").default("text-embedding-ada-002"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type FileCategory = "avatar" | "cover" | "upload";
export type FileEntityType = "tenant" | "user" | "campaign";

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  r2Key: text("r2_key").notNull().unique(),
  category: text("category").notNull().$type<FileCategory>(), // 'avatar' | 'cover' | 'upload'
  entityType: text("entity_type").$type<FileEntityType>(), // 'tenant' | 'user' | 'campaign'
  entityId: uuid("entity_id"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  uploadedBy: uuid("uploaded_by").references(() => tenantUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
