/**
 * Engagement Tracking Endpoint
 * Updates visit with engagement metrics (duration, scroll depth)
 * Called when user leaves page or periodically
 */
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { visits, tenants } from "@/lib/db/schema";

export const runtime = "nodejs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

interface EngagementBody {
  visitor_id: string;
  url: string;
  duration: number; // seconds
  scroll_depth: number; // 0-100
  is_exit?: boolean;
}

function parseBody(data: unknown): EngagementBody | null {
  if (data === null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const visitorId = o.visitor_id as string;
  const url = o.url as string;
  const duration = o.duration as number;
  const scrollDepth = o.scroll_depth as number;

  if (!visitorId || !url || typeof duration !== "number") {
    return null;
  }

  return {
    visitor_id: visitorId,
    url: url,
    duration: Math.round(duration),
    scroll_depth: Math.min(100, Math.max(0, Math.round(scrollDepth || 0))),
    is_exit: o.is_exit === true,
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

  // Find the most recent visit for this visitor and URL
  const [visit] = await db
    .select({ id: visits.id, duration: visits.duration, scrollDepth: visits.scrollDepth })
    .from(visits)
    .where(
      and(
        eq(visits.tenantId, tenant.id),
        eq(visits.visitorId, parsed.visitor_id),
        eq(visits.url, parsed.url)
      )
    )
    .orderBy(desc(visits.createdAt))
    .limit(1);

  if (!visit) {
    // No visit found, that's okay - might have been created on different endpoint
    return new NextResponse(null, { status: 200, headers: corsHeaders });
  }

  // Calculate if engaged (>10s or >50% scroll)
  const isEngaged = parsed.duration > 10 || parsed.scroll_depth > 50;

  // Update with max values (in case of multiple updates)
  await db
    .update(visits)
    .set({
      duration: Math.max(parsed.duration, visit.duration || 0),
      scrollDepth: Math.max(parsed.scroll_depth, visit.scrollDepth || 0),
      isEngaged: isEngaged,
      exitedAt: parsed.is_exit ? new Date() : undefined,
    })
    .where(eq(visits.id, visit.id));

  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
