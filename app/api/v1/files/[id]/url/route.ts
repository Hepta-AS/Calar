import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { verifySignedSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { getSignedDownloadUrl, getTTL } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  // Authenticate user via session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySignedSession(sessionCookie.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = session;
  const { id: fileId } = await context.params;

  // Fetch file record with tenant isolation
  const [file] = await db
    .select({
      id: files.id,
      r2Key: files.r2Key,
      category: files.category,
      isDeleted: files.isDeleted,
    })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.tenantId, tenantId)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (file.isDeleted) {
    return NextResponse.json({ error: "File has been deleted" }, { status: 410 });
  }

  // Get TTL based on category
  const ttl = getTTL(file.category as "avatar" | "cover" | "upload");

  // Generate signed URL
  try {
    const url = await getSignedDownloadUrl(file.r2Key, ttl);

    return NextResponse.json({
      url,
      expires_in: ttl,
    });
  } catch (error) {
    console.error("[FILES] Failed to generate signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
