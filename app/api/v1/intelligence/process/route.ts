import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { processLeadIntelligence, recalculateAllScores } from "@/lib/intelligence";

export const runtime = "nodejs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function requiredString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseBody(data: unknown): {
  apiKey: string;
  leadId?: string;
  batch?: boolean;
  skipEnrichment?: boolean;
  skipSignals?: boolean;
  skipEmbeddings?: boolean;
} | null {
  if (data === null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const apiKey = requiredString(o.api_key);
  if (!apiKey) return null;

  return {
    apiKey,
    leadId: requiredString(o.lead_id) ?? undefined,
    batch: o.batch === true,
    skipEnrichment: o.skip_enrichment === true,
    skipSignals: o.skip_signals === true,
    skipEmbeddings: o.skip_embeddings === true,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders }
    );
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid body - api_key required" },
      { status: 400, headers: corsHeaders }
    );
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.apiKey, parsed.apiKey))
    .limit(1);

  if (!tenant) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  // Batch mode: recalculate all scores
  if (parsed.batch) {
    try {
      const result = await recalculateAllScores(tenant.id);
      return NextResponse.json(
        {
          success: true,
          mode: "batch",
          processed: result.processed,
          errors: result.errors,
        },
        { headers: corsHeaders }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: `Batch processing failed: ${message}` },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // Single lead mode
  if (!parsed.leadId) {
    return NextResponse.json(
      { error: "lead_id required for single lead processing" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const result = await processLeadIntelligence({
      leadId: parsed.leadId,
      tenantId: tenant.id,
      skipEnrichment: parsed.skipEnrichment,
      skipSignals: parsed.skipSignals,
      skipEmbeddings: parsed.skipEmbeddings,
    });

    return NextResponse.json(
      {
        success: true,
        leadId: result.leadId,
        previousScore: result.previousScore,
        newScore: result.newScore,
        signalTriggered: result.signalTriggered,
        signalId: result.signalId,
        embeddingId: result.embeddingId,
        enrichment: result.enrichment
          ? {
              success: result.enrichment.success,
              companyName: result.enrichment.companyName,
              industry: result.enrichment.industry,
              provider: result.enrichment.provider,
            }
          : null,
        scoring: {
          totalScore: result.scoring.totalScore,
          breakdown: result.scoring.breakdown,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Processing failed: ${message}` },
      { status: 500, headers: corsHeaders }
    );
  }
}
