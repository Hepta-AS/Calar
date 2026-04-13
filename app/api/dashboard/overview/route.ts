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

  const leadRows = rowsFromExecute(leadsRaw);
  const channelRows = rowsFromExecute(channelRaw);

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
  });
}
