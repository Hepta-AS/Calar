/**
 * Score Service
 * Pure, deterministic lead scoring engine.
 * All scoring logic is stateless and easily unit-testable.
 */

import {
  ScoringInput,
  ScoringResult,
  ScoringRuleResult,
  ScoringWeights,
  ScoreBreakdown,
  DEFAULT_SCORING_WEIGHTS,
  CONSUMER_EMAIL_DOMAINS,
} from "./types";

/**
 * Calculates the total score for a lead based on available signals.
 * This function is pure and deterministic.
 */
export function calculateScore(
  input: ScoringInput,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ScoringResult {
  const rules: ScoringRuleResult[] = [];
  const breakdown: Omit<ScoreBreakdown, "total" | "calculatedAt"> = {
    pageViews: 0,
    highValuePages: 0,
    repeatedVisits: 0,
    businessEmail: 0,
    enrichment: 0,
  };

  // Rule 1: Page view points
  const pageViewScore = calculatePageViewScore(input.pageViewCount, weights);
  if (pageViewScore.points > 0) {
    rules.push(pageViewScore);
    breakdown.pageViews = pageViewScore.points;
  }

  // Rule 2: High-value page bonus
  const highValueScore = calculateHighValuePageScore(input.highValuePageCount, weights);
  if (highValueScore.points > 0) {
    rules.push(highValueScore);
    breakdown.highValuePages = highValueScore.points;
  }

  // Rule 3: Repeated visits bonus
  const repeatedVisitScore = calculateRepeatedVisitScore(input.uniqueVisitDays, weights);
  if (repeatedVisitScore.points > 0) {
    rules.push(repeatedVisitScore);
    breakdown.repeatedVisits = repeatedVisitScore.points;
  }

  // Rule 4: Business email domain
  const businessEmailScore = calculateBusinessEmailScore(input.email, weights);
  if (businessEmailScore.points > 0) {
    rules.push(businessEmailScore);
    breakdown.businessEmail = businessEmailScore.points;
  }

  // Rule 5: Enriched company data
  const enrichmentScore = calculateEnrichmentScore(input.hasEnrichedCompany, weights);
  if (enrichmentScore.points > 0) {
    rules.push(enrichmentScore);
    breakdown.enrichment = enrichmentScore.points;
  }

  // Rule 6: Custom factors (extensibility point)
  if (input.customFactors) {
    for (const [factor, points] of Object.entries(input.customFactors)) {
      if (points !== 0) {
        rules.push({
          ruleName: `custom_${factor}`,
          points,
          reason: `Custom factor: ${factor}`,
          metadata: { factor },
        });
      }
    }
  }

  const totalScore = rules.reduce((sum, rule) => sum + rule.points, 0);
  const calculatedAt = new Date();

  return {
    totalScore,
    rules,
    breakdown: {
      ...breakdown,
      total: totalScore,
      calculatedAt: calculatedAt.toISOString(),
    },
    calculatedAt,
  };
}

/**
 * Checks if a score exceeds the given threshold.
 */
export function exceedsThreshold(score: number, threshold: number): boolean {
  return score > threshold;
}

/**
 * Extracts the domain from an email address.
 */
export function extractDomain(email: string): string | null {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

/**
 * Checks if an email is a business email (not from a consumer domain).
 */
export function isBusinessEmail(email: string): boolean {
  const domain = extractDomain(email);
  return domain !== null && !CONSUMER_EMAIL_DOMAINS.has(domain);
}

// =============================================================================
// SCORING RULES (all pure functions)
// =============================================================================

function calculatePageViewScore(
  pageViewCount: number,
  weights: ScoringWeights
): ScoringRuleResult {
  const points = pageViewCount * weights.pageView;
  return {
    ruleName: "page_views",
    points,
    reason: `${pageViewCount} page views @ ${weights.pageView} points each`,
    metadata: { pageViewCount },
  };
}

function calculateHighValuePageScore(
  highValuePageCount: number,
  weights: ScoringWeights
): ScoringRuleResult {
  const points = highValuePageCount * weights.highValuePage;
  return {
    ruleName: "high_value_pages",
    points,
    reason: `${highValuePageCount} high-value page views @ ${weights.highValuePage} points each`,
    metadata: { highValuePageCount },
  };
}

function calculateRepeatedVisitScore(
  uniqueVisitDays: number,
  weights: ScoringWeights
): ScoringRuleResult {
  if (uniqueVisitDays < weights.repeatedVisitThreshold) {
    return {
      ruleName: "repeated_visits",
      points: 0,
      reason: `${uniqueVisitDays} visit days (threshold: ${weights.repeatedVisitThreshold})`,
      metadata: { uniqueVisitDays },
    };
  }

  return {
    ruleName: "repeated_visits",
    points: weights.repeatedVisits,
    reason: `${uniqueVisitDays}+ visit days (returning visitor)`,
    metadata: { uniqueVisitDays },
  };
}

function calculateBusinessEmailScore(
  email: string,
  weights: ScoringWeights
): ScoringRuleResult {
  const domain = extractDomain(email);
  const isBusiness = isBusinessEmail(email);

  return {
    ruleName: "business_email",
    points: isBusiness ? weights.businessEmail : 0,
    reason: isBusiness
      ? `Business email domain: ${domain}`
      : `Consumer email domain: ${domain ?? "unknown"}`,
    metadata: { domain, isBusinessEmail: isBusiness },
  };
}

function calculateEnrichmentScore(
  hasEnrichedCompany: boolean,
  weights: ScoringWeights
): ScoringRuleResult {
  return {
    ruleName: "enriched_company",
    points: hasEnrichedCompany ? weights.enrichedCompany : 0,
    reason: hasEnrichedCompany ? "Company data enriched" : "No enrichment data",
    metadata: { hasEnrichedCompany },
  };
}
