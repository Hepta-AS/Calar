/**
 * R2 key construction utilities for multi-tenant file storage
 */

/**
 * Sanitize filename to be safe for R2 keys
 * - lowercase
 * - only [a-z0-9._-] allowed
 * - max 64 characters
 */
export function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized.slice(0, 64) || "file";
}

/**
 * Get file extension from filename
 */
export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Convert MIME type to file extension
 */
export function mimeToExtension(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/json": "json",
    "application/zip": "zip",
  };

  return mimeMap[mimeType] || "";
}

/**
 * Build R2 key for tenant avatar
 * Format: {tenantId}/profile/avatar.{ext}
 */
export function buildTenantAvatarKey(tenantId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${tenantId}/profile/avatar.${safeExt}`;
}

/**
 * Build R2 key for user avatar
 * Format: {tenantId}/users/{userId}/avatar.{ext}
 */
export function buildUserAvatarKey(
  tenantId: string,
  userId: string,
  ext: string
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${tenantId}/users/${userId}/avatar.${safeExt}`;
}

/**
 * Build R2 key for campaign cover image
 * Format: {tenantId}/campaigns/{campaignId}/cover.{ext}
 */
export function buildCampaignCoverKey(
  tenantId: string,
  campaignId: string,
  ext: string
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${tenantId}/campaigns/${campaignId}/cover.${safeExt}`;
}

/**
 * Build R2 key for campaign upload
 * Format: {tenantId}/campaigns/{campaignId}/uploads/{fileId}-{filename}
 */
export function buildCampaignUploadKey(
  tenantId: string,
  campaignId: string,
  fileId: string,
  filename: string
): string {
  const safeFilename = sanitizeFilename(filename);
  return `${tenantId}/campaigns/${campaignId}/uploads/${fileId}-${safeFilename}`;
}

/**
 * Build the deleted key path (for soft delete)
 * Format: _deleted/{originalKey}
 */
export function buildDeletedKey(originalKey: string): string {
  return `_deleted/${originalKey}`;
}
