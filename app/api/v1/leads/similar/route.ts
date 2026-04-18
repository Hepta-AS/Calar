import { eq } from "drizzle-orm";
import { NextResponse, NextRequest } from "next/server";

import { db } from "@/lib/db";
import { tenants, leads } from "@/lib/db/schema";
import { findSimilarLeads } from "@/lib/intelligence";

export const runtime = "nodejs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get("api_key");
  const leadId = searchParams.get("lead_id");
  const limitParam = searchParams.get("limit");

  if (!apiKey) {
    return NextResponse.json(
      { error: "api_key required" },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!leadId) {
    return NextResponse.json(
      { error: "lead_id required" },
      { status: 400, headers: corsHeaders }
    );
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.apiKey, apiKey))
    .limit(1);

  if (!tenant) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  try {
    const similar = await findSimilarLeads(tenant.id, leadId, limit);

    // Fetch lead details for each similar result
    const leadDetails = await db
      .select({
        id: leads.id,
        email: leads.email,
        name: leads.name,
        company: leads.company,
        enrichedCompany: leads.enrichedCompany,
        score: leads.score,
      })
      .from(leads)
      .where(eq(leads.tenantId, tenant.id));

    const leadMap = new Map(leadDetails.map((l) => [l.id, l]));

    const results = similar.map((s) => {
      const lead = leadMap.get(s.leadId);
      return {
        leadId: s.leadId,
        similarity: s.similarity,
        sourceText: s.sourceText,
        lead: lead
          ? {
              email: lead.email,
              name: lead.name,
              company: lead.enrichedCompany ?? lead.company,
              score: lead.score,
            }
          : null,
      };
    });

    return NextResponse.json(
      {
        success: true,
        leadId,
        similar: results,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Search failed: ${message}` },
      { status: 500, headers: corsHeaders }
    );
  }
}
