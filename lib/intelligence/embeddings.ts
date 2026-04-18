/**
 * Embedding Service
 * Manages vector embedding generation and similarity search.
 * Uses OpenAI text-embedding-ada-002 with pgvector for storage.
 */

import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { embeddings, leads, visits } from "@/lib/db/schema";
import { EmbeddingInput, EmbeddingResult, SimilarityResult } from "./types";

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

interface IEmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  embed(input: EmbeddingInput): Promise<EmbeddingResult>;
}

// =============================================================================
// MOCK PROVIDER (for testing without API key)
// =============================================================================

class MockEmbeddingProvider implements IEmbeddingProvider {
  readonly name = "mock";
  readonly model = "mock-embedding-v1";
  readonly dimensions = 1536;

  async embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    // Generate deterministic embedding based on text hash
    const textHash = this.hashCode(input.text);
    const embedding = Array.from({ length: this.dimensions }, (_, i) => {
      return Math.sin(i * 0.1 + textHash * 0.001) * 0.5 + Math.cos(i * 0.05 + textHash * 0.002) * 0.3;
    });

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    const normalized = embedding.map((x) => x / magnitude);

    return {
      embedding: normalized,
      model: this.model,
      dimensions: this.dimensions,
    };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// =============================================================================
// OPENAI PROVIDER (when API key is available)
// =============================================================================

class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  readonly name = "openai";
  readonly model = "text-embedding-ada-002";
  readonly dimensions = 1536;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: input.text,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const embeddingData = data.data[0];

    return {
      embedding: embeddingData.embedding,
      model: this.model,
      dimensions: this.dimensions,
      tokens: data.usage?.total_tokens,
    };
  }
}

// =============================================================================
// EMBEDDING SERVICE
// =============================================================================

class EmbeddingService {
  private provider: IEmbeddingProvider;

  constructor() {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.provider = new OpenAIEmbeddingProvider(openaiKey);
    } else {
      this.provider = new MockEmbeddingProvider();
    }
  }

  /**
   * Generates and stores embedding for a lead's behavioral summary.
   */
  async embedLeadBehavior(tenantId: string, leadId: string): Promise<string> {
    // Fetch lead with related data
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    // Build behavioral summary
    const summary = await this.buildBehavioralSummary(tenantId, lead);

    // Generate embedding
    const result = await this.provider.embed({ text: summary });

    // Check if embedding already exists
    const [existing] = await db
      .select({ id: embeddings.id })
      .from(embeddings)
      .where(and(eq(embeddings.tenantId, tenantId), eq(embeddings.leadId, leadId)))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(embeddings)
        .set({
          sourceText: summary,
          embedding: result.embedding,
          model: result.model,
        })
        .where(eq(embeddings.id, existing.id));
      return existing.id;
    }

    // Insert new
    const [embedding] = await db
      .insert(embeddings)
      .values({
        tenantId,
        leadId,
        sourceText: summary,
        embedding: result.embedding,
        model: result.model,
      })
      .returning({ id: embeddings.id });

    return embedding.id;
  }

  /**
   * Finds similar leads based on behavioral embedding.
   */
  async findSimilarLeads(
    tenantId: string,
    leadId: string,
    limit = 10
  ): Promise<SimilarityResult[]> {
    // Get the lead's embedding
    const [sourceEmbedding] = await db
      .select()
      .from(embeddings)
      .where(and(eq(embeddings.tenantId, tenantId), eq(embeddings.leadId, leadId)))
      .limit(1);

    if (!sourceEmbedding?.embedding) {
      // Generate embedding if doesn't exist
      await this.embedLeadBehavior(tenantId, leadId);
      return this.findSimilarLeads(tenantId, leadId, limit);
    }

    // Find similar embeddings using cosine similarity
    // Note: This requires pgvector extension
    const similar = await db
      .select({
        id: embeddings.id,
        leadId: embeddings.leadId,
        sourceText: embeddings.sourceText,
        similarity: sql<number>`1 - (${embeddings.embedding} <=> ${JSON.stringify(sourceEmbedding.embedding)}::vector)`,
      })
      .from(embeddings)
      .where(
        and(
          eq(embeddings.tenantId, tenantId),
          sql`${embeddings.leadId} != ${leadId}`
        )
      )
      .orderBy(sql`${embeddings.embedding} <=> ${JSON.stringify(sourceEmbedding.embedding)}::vector`)
      .limit(limit);

    return similar.map((row) => ({
      id: row.id,
      leadId: row.leadId,
      sourceText: row.sourceText,
      similarity: row.similarity,
    }));
  }

  /**
   * Semantic search across all lead behaviors.
   */
  async searchLeads(
    tenantId: string,
    query: string,
    limit = 10
  ): Promise<SimilarityResult[]> {
    // Generate embedding for query
    const queryResult = await this.provider.embed({ text: query });

    // Search using cosine similarity
    const results = await db
      .select({
        id: embeddings.id,
        leadId: embeddings.leadId,
        sourceText: embeddings.sourceText,
        similarity: sql<number>`1 - (${embeddings.embedding} <=> ${JSON.stringify(queryResult.embedding)}::vector)`,
      })
      .from(embeddings)
      .where(eq(embeddings.tenantId, tenantId))
      .orderBy(sql`${embeddings.embedding} <=> ${JSON.stringify(queryResult.embedding)}::vector`)
      .limit(limit);

    return results.map((row) => ({
      id: row.id,
      leadId: row.leadId,
      sourceText: row.sourceText,
      similarity: row.similarity,
    }));
  }

  /**
   * Builds a natural language behavioral summary for a lead.
   */
  private async buildBehavioralSummary(
    tenantId: string,
    lead: { id: string; email: string; name: string | null; company: string | null; enrichedCompany: string | null; score: number; visitorId: string }
  ): Promise<string> {
    // Fetch visits for this lead
    const leadVisits = await db
      .select()
      .from(visits)
      .where(and(eq(visits.tenantId, tenantId), eq(visits.visitorId, lead.visitorId)))
      .orderBy(desc(visits.createdAt))
      .limit(20);

    // Build summary components
    const parts: string[] = [];

    // Lead info
    parts.push(`Lead: ${lead.email}`);
    if (lead.name) parts.push(`Name: ${lead.name}`);
    if (lead.enrichedCompany || lead.company) {
      parts.push(`Company: ${lead.enrichedCompany ?? lead.company}`);
    }
    parts.push(`Score: ${lead.score}`);

    // Visit info
    if (leadVisits.length > 0) {
      const uniqueUrls = Array.from(new Set(leadVisits.map((v) => v.url)));
      parts.push(`Pages viewed: ${uniqueUrls.length}`);
      parts.push(`Page URLs: ${uniqueUrls.slice(0, 5).join(", ")}`);

      // Attribution info
      const sources = Array.from(new Set(leadVisits.map((v) => v.utmSource).filter((x): x is string => x !== null)));
      const campaigns = Array.from(new Set(leadVisits.map((v) => v.utmCampaign).filter((x): x is string => x !== null)));

      if (sources.length > 0) {
        parts.push(`Traffic sources: ${sources.join(", ")}`);
      }
      if (campaigns.length > 0) {
        parts.push(`Campaigns: ${campaigns.join(", ")}`);
      }
    }

    return parts.join(". ");
  }

  /**
   * Gets the configured provider info.
   */
  getProviderInfo(): { name: string; model: string; dimensions: number } {
    return {
      name: this.provider.name,
      model: this.provider.model,
      dimensions: this.provider.dimensions,
    };
  }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}

/**
 * Helper function to embed a lead's behavior.
 */
export async function embedLeadBehavior(tenantId: string, leadId: string): Promise<string> {
  const service = getEmbeddingService();
  return service.embedLeadBehavior(tenantId, leadId);
}

/**
 * Helper function to find similar leads.
 */
export async function findSimilarLeads(
  tenantId: string,
  leadId: string,
  limit?: number
): Promise<SimilarityResult[]> {
  const service = getEmbeddingService();
  return service.findSimilarLeads(tenantId, leadId, limit);
}

/**
 * Helper function to search leads semantically.
 */
export async function searchLeads(
  tenantId: string,
  query: string,
  limit?: number
): Promise<SimilarityResult[]> {
  const service = getEmbeddingService();
  return service.searchLeads(tenantId, query, limit);
}
