import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { verifySignedSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { files, campaigns, tenantUsers } from "@/lib/db/schema";
import {
  validateImageFile,
  validateUploadFile,
  getSizeLimit,
  getExtension,
  buildTenantAvatarKey,
  buildUserAvatarKey,
  buildCampaignCoverKey,
  buildCampaignUploadKey,
  sanitizeFilename,
  uploadToR2,
} from "@/lib/storage";

export const runtime = "nodejs";

type UploadCategory =
  | "tenant-avatar"
  | "user-avatar"
  | "campaign-cover"
  | "campaign-upload";

const VALID_CATEGORIES = new Set<UploadCategory>([
  "tenant-avatar",
  "user-avatar",
  "campaign-cover",
  "campaign-upload",
]);

export async function POST(request: Request) {
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

  const { userId, tenantId } = session;

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const category = formData.get("category") as string | null;
  const campaignId = formData.get("campaign_id") as string | null;

  // Validate required fields
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "File is required" },
      { status: 400 }
    );
  }

  if (!category || !VALID_CATEGORIES.has(category as UploadCategory)) {
    return NextResponse.json(
      {
        error:
          "Invalid category. Must be one of: tenant-avatar, user-avatar, campaign-cover, campaign-upload",
      },
      { status: 400 }
    );
  }

  const uploadCategory = category as UploadCategory;

  // Check if campaign_id is required
  if (
    (uploadCategory === "campaign-cover" ||
      uploadCategory === "campaign-upload") &&
    !campaignId
  ) {
    return NextResponse.json(
      { error: "campaign_id is required for campaign uploads" },
      { status: 400 }
    );
  }

  // Validate campaign belongs to tenant if provided
  if (campaignId) {
    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.tenantId, tenantId),
          eq(campaigns.isDeleted, false)
        )
      )
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }
  }

  // Check file size
  const sizeLimit = getSizeLimit(uploadCategory);
  if (file.size > sizeLimit) {
    const limitMB = Math.round(sizeLimit / (1024 * 1024));
    return NextResponse.json(
      { error: `File size exceeds ${limitMB}MB limit` },
      { status: 422 }
    );
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Validate file content
  const isImageCategory =
    uploadCategory === "tenant-avatar" ||
    uploadCategory === "user-avatar" ||
    uploadCategory === "campaign-cover";

  let mimeType: string;

  if (isImageCategory) {
    const validation = validateImageFile(buffer);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 422 }
      );
    }
    mimeType = validation.mimeType!;
  } else {
    const validation = validateUploadFile(buffer, file.name);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 422 }
      );
    }
    mimeType = validation.mimeType!;
  }

  // Generate a file ID for the database record
  const fileId = crypto.randomUUID();
  const ext = getExtension(file.name) || mimeType.split("/")[1] || "bin";
  const sanitizedFilename = sanitizeFilename(file.name);

  // Build the R2 key based on category
  let r2Key: string;
  let entityType: "tenant" | "user" | "campaign" | null = null;
  let entityId: string | null = null;
  let dbCategory: "avatar" | "cover" | "upload";

  switch (uploadCategory) {
    case "tenant-avatar":
      r2Key = buildTenantAvatarKey(tenantId, ext);
      entityType = "tenant";
      entityId = tenantId;
      dbCategory = "avatar";
      break;
    case "user-avatar":
      r2Key = buildUserAvatarKey(tenantId, userId, ext);
      entityType = "user";
      entityId = userId;
      dbCategory = "avatar";
      break;
    case "campaign-cover":
      r2Key = buildCampaignCoverKey(tenantId, campaignId!, ext);
      entityType = "campaign";
      entityId = campaignId;
      dbCategory = "cover";
      break;
    case "campaign-upload":
      r2Key = buildCampaignUploadKey(
        tenantId,
        campaignId!,
        fileId,
        sanitizedFilename
      );
      entityType = "campaign";
      entityId = campaignId;
      dbCategory = "upload";
      break;
  }

  // Upload to R2
  try {
    await uploadToR2(r2Key, Buffer.from(buffer), mimeType);
  } catch (error) {
    console.error("[FILES] R2 upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }

  // Create database record
  const [newFile] = await db
    .insert(files)
    .values({
      id: fileId,
      tenantId,
      filename: sanitizedFilename,
      originalFilename: file.name,
      mimeType,
      sizeBytes: file.size,
      r2Key,
      category: dbCategory,
      entityType,
      entityId,
      uploadedBy: userId,
    })
    .returning({
      id: files.id,
      filename: files.filename,
    });

  // Update the entity with the file reference if applicable
  if (uploadCategory === "user-avatar") {
    await db
      .update(tenantUsers)
      .set({ avatarFileId: fileId })
      .where(eq(tenantUsers.id, userId));
  } else if (uploadCategory === "campaign-cover" && campaignId) {
    await db
      .update(campaigns)
      .set({ coverFileId: fileId })
      .where(eq(campaigns.id, campaignId));
  }

  return NextResponse.json(
    {
      file: {
        id: newFile.id,
        filename: newFile.filename,
      },
    },
    { status: 201 }
  );
}
