/**
 * Intelligence Types
 * Type definitions for scoring, enrichment, signals, and embeddings.
 */

// =============================================================================
// SCORING
// =============================================================================

export interface ScoringInput {
  email: string;
  pageViewCount: number;
  highValuePageCount: number;
  uniqueVisitDays: number;
  hasEnrichedCompany: boolean;
  customFactors?: Record<string, number>;
}

export interface ScoringResult {
  totalScore: number;
  breakdown: ScoreBreakdown;
  rules: ScoringRuleResult[];
  calculatedAt: Date;
}

export interface ScoringRuleResult {
  ruleName: string;
  points: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface ScoreBreakdown {
  pageViews: number;
  highValuePages: number;
  repeatedVisits: number;
  businessEmail: number;
  enrichment: number;
  total: number;
  calculatedAt: string;
}

export interface ScoringWeights {
  pageView: number;
  highValuePage: number;
  repeatedVisits: number;
  repeatedVisitThreshold: number;
  businessEmail: number;
  enrichedCompany: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  pageView: 1,
  highValuePage: 15,
  repeatedVisits: 20,
  repeatedVisitThreshold: 3,
  businessEmail: 25,
  enrichedCompany: 10,
};

// Consumer email domains that don't contribute to business email score
export const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.fr",
  "yahoo.de",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "gmx.de",
  "web.de",
  "qq.com",
  "163.com",
  "126.com",
]);

// =============================================================================
// ENRICHMENT
// =============================================================================

export interface EnrichmentInput {
  email?: string;
  domain?: string;
  ipAddress?: string;
}

export interface EnrichmentResult {
  success: boolean;
  companyName: string | null;
  domain: string | null;
  industry: string | null;
  employeeCount: string | null;
  location: string | null;
  confidence: number;
  provider: string;
  raw?: Record<string, unknown>;
}

// =============================================================================
// SIGNALS
// =============================================================================

export interface SignalPayload {
  leadEmail: string;
  leadName?: string;
  score: number;
  triggerReason: string;
}

export type SignalType = "score_threshold" | "high_intent" | "returning_visitor";
export type SignalStatus = "pending" | "processing" | "delivered" | "failed";

export interface Signal {
  id: string;
  leadId: string;
  type: SignalType;
  payload: SignalPayload;
}

export interface SignalDispatchResult {
  success: boolean;
  channel: string;
  externalId?: string;
  error?: string;
}

export interface ThresholdConfig {
  scoreThreshold: number;
  highIntentPages: string[];
  repeatedVisitCount: number;
  enabled: boolean;
}

export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  scoreThreshold: 50,
  highIntentPages: ["/pricing", "/demo", "/contact", "/request-demo", "/book-demo"],
  repeatedVisitCount: 3,
  enabled: true,
};

// =============================================================================
// EMBEDDINGS
// =============================================================================

export interface EmbeddingInput {
  text: string;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  tokens?: number;
}

export interface SimilarityResult {
  id: string;
  leadId: string;
  sourceText: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// INTELLIGENCE PIPELINE
// =============================================================================

export interface ProcessLeadInput {
  leadId: string;
  tenantId: string;
  skipEnrichment?: boolean;
  skipSignals?: boolean;
  skipEmbeddings?: boolean;
}

export interface IntelligenceResult {
  leadId: string;
  enrichment: EnrichmentResult | null;
  scoring: ScoringResult;
  signalTriggered: boolean;
  signalId: string | null;
  embeddingId: string | null;
  previousScore: number;
  newScore: number;
}
