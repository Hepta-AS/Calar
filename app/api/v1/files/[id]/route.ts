import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { verifySignedSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { files, tenantUsers, campaigns, tenants } from "@/lib/db/schema";
import { softDeleteFromR2 } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
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
      isDeleted: files.isDeleted,
      category: files.category,
      entityType: files.entityType,
      entityId: files.entityId,
    })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.tenantId, tenantId)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (file.isDeleted) {
    return NextResponse.json({ error: "File already deleted" }, { status: 410 });
  }

  // Soft delete in R2 (move to _deleted/)
  try {
    await softDeleteFromR2(file.r2Key);
  } catch (error) {
    console.error("[FILES] R2 soft delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }

  // Mark as deleted in database
  const now = new Date();
  await db
    .update(files)
    .set({
      isDeleted: true,
      deletedAt: now,
    })
    .where(eq(files.id, fileId));

  // Clear file reference from entity if applicable
  if (file.entityType && file.entityId) {
    switch (file.entityType) {
      case "tenant":
        if (file.category === "avatar") {
          await db
            .update(tenants)
            .set({ logoFileId: null })
            .where(
              and(
                eq(tenants.id, file.entityId),
                eq(tenants.logoFileId, fileId)
              )
            );
        }
        break;
      case "user":
        if (file.category === "avatar") {
          await db
            .update(tenantUsers)
            .set({ avatarFileId: null })
            .where(
              and(
                eq(tenantUsers.id, file.entityId),
                eq(tenantUsers.avatarFileId, fileId)
              )
            );
        }
        break;
      case "campaign":
        if (file.category === "cover") {
          await db
            .update(campaigns)
            .set({ coverFileId: null })
            .where(
              and(
                eq(campaigns.id, file.entityId),
                eq(campaigns.coverFileId, fileId)
              )
            );
        }
        break;
    }
  }

  return new NextResponse(null, { status: 204 });
}
