import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { tenants, leads } from "@/lib/db/schema";
import { searchLeads } from "@/lib/intelligence";

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
  query: string;
  limit?: number;
} | null {
  if (data === null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const apiKey = requiredString(o.api_key);
  const query = requiredString(o.query);
  if (!apiKey || !query) return null;

  return {
    apiKey,
    query,
    limit: typeof o.limit === "number" ? o.limit : undefined,
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
      { error: "api_key and query required" },
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

  try {
    const results = await searchLeads(tenant.id, parsed.query, parsed.limit ?? 10);

    // Fetch lead details for each result
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

    const searchResults = results.map((r) => {
      const lead = leadMap.get(r.leadId);
      return {
        leadId: r.leadId,
        similarity: r.similarity,
        sourceText: r.sourceText,
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
        query: parsed.query,
        results: searchResults,
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
