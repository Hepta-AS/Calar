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
  apiKey: text("api_key").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
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
  utmLink: text("utm_link"),
  spendingPerMonth: text("spending_per_month"),
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
