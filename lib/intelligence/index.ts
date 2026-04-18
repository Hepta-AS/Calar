/**
 * Intelligence Module
 * Main entry point for lead intelligence processing.
 *
 * Pipeline: Enrichment → Scoring → Signals → Embeddings
 */

import { eq, and, sql, count, countDistinct } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, visits } from "@/lib/db/schema";
import { calculateScore, isBusinessEmail } from "./score";
import { enrichLead } from "./enrichment";
import { checkAndTriggerSignals } from "./signals";
import { embedLeadBehavior } from "./embeddings";
import {
  ProcessLeadInput,
  IntelligenceResult,
  ScoringInput,
  EnrichmentResult,
  DEFAULT_THRESHOLD_CONFIG,
} from "./types";

// Re-export all modules
export * from "./types";
export * from "./score";
export * from "./enrichment";
export * from "./signals";
export * from "./embeddings";

/**
 * Processes a lead through the complete intelligence pipeline.
 * This is the main entry point for lead intelligence processing.
 */
export async function processLeadIntelligence(
  input: ProcessLeadInput
): Promise<IntelligenceResult> {
  const { leadId, tenantId, skipEnrichment = false, skipSignals = false, skipEmbeddings = false } = input;

  // Fetch lead data
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const previousScore = lead.score;
  let enrichmentResult: EnrichmentResult | null = null;

  // Step 1: Enrichment (if not already enriched and not skipped)
  if (!skipEnrichment && !lead.enrichedCompany && isBusinessEmail(lead.email)) {
    enrichmentResult = await enrichLead(lead.email);

    if (enrichmentResult.success && enrichmentResult.companyName) {
      await db
        .update(leads)
        .set({
          enrichedCompany: enrichmentResult.companyName,
          enrichedIndustry: enrichmentResult.industry,
          enrichedEmployeeCount: enrichmentResult.employeeCount,
          enrichedAt: new Date(),
        })
        .where(eq(leads.id, leadId));
    }
  }

  // Step 2: Gather scoring inputs
  const scoringInput = await gatherScoringInput(
    tenantId,
    lead.visitorId,
    lead.email,
    enrichmentResult?.success ?? Boolean(lead.enrichedCompany)
  );

  // Step 3: Calculate score
  const scoringResult = calculateScore(scoringInput);

  // Step 4: Update lead with new score
  await db
    .update(leads)
    .set({
      score: scoringResult.totalScore,
      scoreBreakdown: scoringResult.breakdown,
    })
    .where(eq(leads.id, leadId));

  // Step 5: Check for signal triggers (if not skipped)
  let signalTriggered = false;
  let signalId: string | null = null;

  if (!skipSignals) {
    const signalResult = await checkAndTriggerSignals(
      tenantId,
      leadId,
      scoringResult.totalScore,
      previousScore
    );
    signalTriggered = signalResult.signalTriggered;
    signalId = signalResult.signalId;
  }

  // Step 6: Generate embedding (if not skipped)
  let embeddingId: string | null = null;

  if (!skipEmbeddings) {
    try {
      embeddingId = await embedLeadBehavior(tenantId, leadId);
    } catch (error) {
      // Log but don't fail the whole pipeline for embedding errors
      console.error(`Failed to generate embedding for lead ${leadId}:`, error);
    }
  }

  return {
    leadId,
    enrichment: enrichmentResult,
    scoring: scoringResult,
    signalTriggered,
    signalId,
    embeddingId,
    previousScore,
    newScore: scoringResult.totalScore,
  };
}

/**
 * Gathers all data needed for scoring calculation.
 */
async function gatherScoringInput(
  tenantId: string,
  visitorId: string,
  email: string,
  hasEnrichedCompany: boolean
): Promise<ScoringInput> {
  // Get visit stats for this visitor
  const [visitStats] = await db
    .select({
      totalViews: count(),
      highValueViews: sql<number>`COUNT(*) FILTER (WHERE ${visits.url} LIKE '%/pricing%' OR ${visits.url} LIKE '%/demo%' OR ${visits.url} LIKE '%/contact%')`,
      uniqueDays: countDistinct(sql`DATE(${visits.createdAt})`),
    })
    .from(visits)
    .where(and(eq(visits.tenantId, tenantId), eq(visits.visitorId, visitorId)));

  return {
    email,
    pageViewCount: visitStats?.totalViews ?? 0,
    highValuePageCount: Number(visitStats?.highValueViews ?? 0),
    uniqueVisitDays: Number(visitStats?.uniqueDays ?? 1),
    hasEnrichedCompany,
  };
}

/**
 * Recalculates scores for all leads in a tenant.
 * Useful for batch processing or when scoring weights change.
 */
export async function recalculateAllScores(
  tenantId: string
): Promise<{ processed: number; errors: number }> {
  const allLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.tenantId, tenantId));

  let processed = 0;
  let errors = 0;

  for (const lead of allLeads) {
    try {
      await processLeadIntelligence({
        leadId: lead.id,
        tenantId,
        skipEnrichment: true, // Don't re-enrich, just recalculate
        skipSignals: true, // Don't trigger signals on recalculation
        skipEmbeddings: true, // Don't regenerate embeddings
      });
      processed++;
    } catch (error) {
      console.error(`Error processing lead ${lead.id}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Gets the current threshold configuration.
 */
export function getThresholdConfig() {
  return { ...DEFAULT_THRESHOLD_CONFIG };
}
