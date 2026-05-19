/**
 * Storage module - R2 file storage with multi-tenant isolation
 */

export {
  sanitizeFilename,
  getExtension,
  mimeToExtension,
  buildTenantAvatarKey,
  buildUserAvatarKey,
  buildCampaignCoverKey,
  buildCampaignUploadKey,
  buildDeletedKey,
} from "./keys";

export {
  SIZE_LIMITS,
  detectMimeType,
  validateImageFile,
  validateUploadFile,
  getSizeLimit,
  type ValidationResult,
} from "./validate";

export {
  TTL,
  getTTL,
  getR2Client,
  uploadToR2,
  softDeleteFromR2,
  getSignedDownloadUrl,
} from "./r2";
