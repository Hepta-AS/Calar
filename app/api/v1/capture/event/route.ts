/**
 * Event Tracking Endpoint
 * Captures clicks, custom events, form interactions, etc.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { events, tenants } from "@/lib/db/schema";

export const runtime = "nodejs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

interface EventBody {
  visitor_id: string;
  type: string; // 'click' | 'custom' | 'form_start' | 'video_play' etc
  name: string; // event name / element identifier
  properties?: Record<string, unknown>;
  url?: string;
}

function parseBody(data: unknown): EventBody | null {
  if (data === null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const visitorId = o.visitor_id as string;
  const type = o.type as string;
  const name = o.name as string;

  if (!visitorId || !type || !name) {
    return null;
  }

  return {
    visitor_id: visitorId,
    type: type,
    name: name,
    properties: (o.properties as Record<string, unknown>) || undefined,
    url: (o.url as string) || undefined,
  };
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("X-API-Key");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400, headers: corsHeaders });
  }

  const apiKeyFromBody = (body as Record<string, unknown>)?.api_key as string;
  const finalApiKey = apiKey || apiKeyFromBody;

  if (!finalApiKey) {
    return new NextResponse(null, { status: 401, headers: corsHeaders });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return new NextResponse(null, { status: 400, headers: corsHeaders });
  }

  // Find tenant
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.apiKey, finalApiKey))
    .limit(1);

  if (!tenant) {
    return new NextResponse(null, { status: 401, headers: corsHeaders });
  }

  // Insert event
  await db.insert(events).values({
    tenantId: tenant.id,
    visitorId: parsed.visitor_id,
    type: parsed.type,
    name: parsed.name,
    properties: parsed.properties,
    url: parsed.url || null,
  });

  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
