/**
 * Unified Capture Endpoint
 * Matches the heptatech.io tracking script format.
 *
 * Accepts:
 * - X-API-Key header for authentication
 * - visitorUuid, email, name, company, attribution in body
 */
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { leads, visits, tenants } from "@/lib/db/schema";
import { processLeadIntelligence } from "@/lib/intelligence";

export const runtime = "nodejs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

interface Attribution {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  landingPage?: string | null;
}

interface CaptureBody {
  visitorUuid?: string;
  visitor_id?: string; // Also support snake_case
  email: string;
  name?: string | null;
  company?: string | null;
  attribution?: Attribution;
}

function parseBody(data: unknown): CaptureBody | null {
  if (data === null || typeof data !== "object") {
    return null;
  }

  const o = data as Record<string, unknown>;

  // Get visitor ID (support both formats)
  const visitorId = (o.visitorUuid || o.visitor_id) as string | undefined;
  const email = o.email as string | undefined;

  if (!visitorId || !email || !email.includes("@")) {
    return null;
  }

  return {
    visitorUuid: visitorId,
    email: email.toLowerCase().trim(),
    name: (o.name as string) || null,
    company: (o.company as string) || null,
    attribution: (o.attribution as Attribution) || {},
  };
}

export async function POST(request: Request) {
  console.log("[CAPTURE] Lead capture request received");

  // Get API key from header or body
  const apiKeyHeader = request.headers.get("X-API-Key");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders }
    );
  }

  // Also check for api_key in body as fallback
  const apiKey = apiKeyHeader || (body as Record<string, unknown>)?.api_key as string;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key" },
      { status: 401, headers: corsHeaders }
    );
  }

  const parsed = parseBody(body);
  if (!parsed) {
    console.log("[CAPTURE] Invalid body");
    return NextResponse.json(
      { error: "Invalid body - requires visitorUuid and email" },
      { status: 400, headers: corsHeaders }
    );
  }

  console.log("[CAPTURE] Email:", parsed.email, "Visitor:", parsed.visitorUuid?.slice(0, 8));

  // Find tenant by API key
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.apiKey, apiKey))
    .limit(1);

  if (!tenant) {
    console.log("[CAPTURE] Invalid API key");
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401, headers: corsHeaders }
    );
  }

  console.log("[CAPTURE] Tenant found:", tenant.id.slice(0, 8));

  const visitorId = parsed.visitorUuid!;
  const attr = parsed.attribution || {};

  // 1. Record the visit/landing page if we have attribution data
  if (attr.landingPage || attr.utmSource) {
    await db.insert(visits).values({
      tenantId: tenant.id,
      visitorId: visitorId,
      url: attr.landingPage || "",
      referrer: attr.referrer || null,
      utmSource: attr.utmSource || null,
      utmMedium: attr.utmMedium || null,
      utmCampaign: attr.utmCampaign || null,
      utmContent: attr.utmContent || null,
      utmTerm: attr.utmTerm || null,
    });
  }

  // 2. Check if lead already exists (by email + tenant)
  const [existingLead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.tenantId, tenant.id), eq(leads.email, parsed.email)))
    .limit(1);

  let leadId: string;

  if (existingLead) {
    // Update existing lead with new visitor ID (in case they cleared localStorage)
    leadId = existingLead.id;
    await db
      .update(leads)
      .set({ visitorId: visitorId })
      .where(eq(leads.id, leadId));
  } else {
    // 3. Create new lead
    const [newLead] = await db
      .insert(leads)
      .values({
        tenantId: tenant.id,
        visitorId: visitorId,
        email: parsed.email,
        name: parsed.name,
        company: parsed.company,
      })
      .returning({ id: leads.id });

    leadId = newLead.id;
  }

  // 4. Trigger intelligence processing (async)
  processLeadIntelligence({
    leadId: leadId,
    tenantId: tenant.id,
  }).catch((error) => {
    console.error(`Intelligence processing failed for lead ${leadId}:`, error);
  });

  return NextResponse.json(
    {
      success: true,
      leadId: leadId,
      isNew: !existingLead,
    },
    { status: 200, headers: corsHeaders }
  );
}
