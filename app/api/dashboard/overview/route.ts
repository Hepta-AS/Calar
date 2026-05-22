import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type UnknownRow = Record<string, unknown>;

function rowsFromExecute(result: unknown): UnknownRow[] {
  if (Array.isArray(result)) {
    return result as UnknownRow[];
  }
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: UnknownRow[] }).rows;
  }
  return [];
}

function toIso(v: unknown): string {
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (typeof v === "string") {
    return v;
  }
  return String(v);
}

export async function GET() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySignedSession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.tenantId;

  const leadsRaw = await db.execute(sql`
    SELECT
      l.id,
      l.email,
      l.name,
      l.company,
      l.created_at,
      v.utm_source,
      v.utm_medium,
      v.utm_campaign
    FROM leads l
    LEFT JOIN LATERAL (
      SELECT utm_source, utm_medium, utm_campaign
      FROM visits
      WHERE visits.tenant_id = l.tenant_id
        AND visits.visitor_id = l.visitor_id
      ORDER BY visits.created_at DESC
      LIMIT 1
    ) v ON true
    WHERE l.tenant_id = ${tenantId}
    ORDER BY l.created_at DESC
  `);

  const channelRaw = await db.execute(sql`
    SELECT
      COALESCE(v.utm_source, '') AS utm_source,
      COUNT(*)::int AS count
    FROM leads l
    LEFT JOIN LATERAL (
      SELECT utm_source
      FROM visits
      WHERE visits.tenant_id = l.tenant_id
        AND visits.visitor_id = l.visitor_id
      ORDER BY visits.created_at DESC
      LIMIT 1
    ) v ON true
    WHERE l.tenant_id = ${tenantId}
    GROUP BY COALESCE(v.utm_source, '')
    ORDER BY count DESC
  `);

  // Get visits data
  const visitsRaw = await db.execute(sql`
    SELECT
      id,
      url,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      created_at
    FROM visits
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT 100
  `);

  const visitStatsRaw = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_visits,
      COUNT(DISTINCT visitor_id)::int AS unique_visitors,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS visits_this_month,
      COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS visitors_this_month
    FROM visits
    WHERE tenant_id = ${tenantId}
  `);

  const topPagesRaw = await db.execute(sql`
    SELECT
      url,
      COUNT(*)::int AS views
    FROM visits
    WHERE tenant_id = ${tenantId}
    GROUP BY url
    ORDER BY views DESC
    LIMIT 10
  `);

  const leadRows = rowsFromExecute(leadsRaw);
  const channelRows = rowsFromExecute(channelRaw);
  const visitRows = rowsFromExecute(visitsRaw);
  const visitStatsRows = rowsFromExecute(visitStatsRaw);
  const topPagesRows = rowsFromExecute(topPagesRaw);

  const stats = visitStatsRows[0] || {};

  return NextResponse.json({
    leads: leadRows.map((row) => ({
      id: String(row.id),
      email: String(row.email ?? ""),
      name: row.name == null ? null : String(row.name),
      company: row.company == null ? null : String(row.company),
      utm_source: row.utm_source == null ? null : String(row.utm_source),
      utm_medium: row.utm_medium == null ? null : String(row.utm_medium),
      utm_campaign: row.utm_campaign == null ? null : String(row.utm_campaign),
      created_at: toIso(row.created_at),
    })),
    by_channel: channelRows.map((row) => ({
      utm_source: String(row.utm_source ?? ""),
      count: Number(row.count),
    })),
    visits: visitRows.map((row) => ({
      id: String(row.id),
      url: String(row.url ?? ""),
      referrer: row.referrer == null ? null : String(row.referrer),
      utm_source: row.utm_source == null ? null : String(row.utm_source),
      utm_medium: row.utm_medium == null ? null : String(row.utm_medium),
      utm_campaign: row.utm_campaign == null ? null : String(row.utm_campaign),
      created_at: toIso(row.created_at),
    })),
    visit_stats: {
      total_visits: Number(stats.total_visits ?? 0),
      unique_visitors: Number(stats.unique_visitors ?? 0),
      visits_this_month: Number(stats.visits_this_month ?? 0),
      visitors_this_month: Number(stats.visitors_this_month ?? 0),
    },
    top_pages: topPagesRows.map((row) => ({
      url: String(row.url ?? ""),
      views: Number(row.views ?? 0),
    })),
  });
}
