/**
 * File validation utilities with magic bytes detection
 */

/** Size limits in bytes */
export const SIZE_LIMITS = {
  AVATAR: 2 * 1024 * 1024, // 2MB
  COVER: 5 * 1024 * 1024, // 5MB
  UPLOAD: 50 * 1024 * 1024, // 50MB
} as const;

/** Magic bytes signatures for common image formats */
const MAGIC_BYTES = {
  jpeg: [
    [0xff, 0xd8, 0xff],
  ],
  png: [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  ],
  gif: [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  webp: [
    // RIFF....WEBP
    [0x52, 0x49, 0x46, 0x46], // First 4 bytes (RIFF), then check offset 8-11 for WEBP
  ],
} as const;

/** Blocked executable extensions */
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "sh",
  "bat",
  "ps1",
  "dll",
  "bin",
  "cmd",
  "com",
  "msi",
  "vbs",
  "js", // JavaScript files could be executed
  "jar",
  "app",
  "dmg",
  "deb",
  "rpm",
]);

/**
 * Check if bytes match a signature
 */
function matchesSignature(
  buffer: Uint8Array,
  signature: readonly number[],
  offset = 0
): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detect MIME type from magic bytes
 * Returns null if format is not recognized
 */
export function detectMimeType(buffer: Uint8Array): string | null {
  // Check JPEG
  for (const sig of MAGIC_BYTES.jpeg) {
    if (matchesSignature(buffer, sig)) {
      return "image/jpeg";
    }
  }

  // Check PNG
  for (const sig of MAGIC_BYTES.png) {
    if (matchesSignature(buffer, sig)) {
      return "image/png";
    }
  }

  // Check GIF
  for (const sig of MAGIC_BYTES.gif) {
    if (matchesSignature(buffer, sig)) {
      return "image/gif";
    }
  }

  // Check WebP (RIFF at 0, WEBP at offset 8)
  if (
    matchesSignature(buffer, MAGIC_BYTES.webp[0]) &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "image/webp";
  }

  return null;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
}

/**
 * Validate image file using magic bytes
 * Accepts: JPEG, PNG, GIF, WebP
 */
export function validateImageFile(buffer: Uint8Array): ValidationResult {
  const mimeType = detectMimeType(buffer);

  if (!mimeType) {
    return {
      valid: false,
      error: "Invalid image format. Supported formats: JPEG, PNG, GIF, WebP",
    };
  }

  return {
    valid: true,
    mimeType,
  };
}

/**
 * Validate general upload file
 * - Blocks executable extensions
 * - Allows most other file types
 */
export function validateUploadFile(
  buffer: Uint8Array,
  filename: string
): ValidationResult {
  // Check for blocked extensions
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type .${ext} is not allowed for security reasons`,
    };
  }

  // Try to detect MIME type from magic bytes
  const mimeType = detectMimeType(buffer);

  // If it's an image, return the detected type
  if (mimeType) {
    return {
      valid: true,
      mimeType,
    };
  }

  // For non-image files, use extension-based MIME type
  const extMimeMap: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };

  return {
    valid: true,
    mimeType: extMimeMap[ext] || "application/octet-stream",
  };
}

/**
 * Get the appropriate size limit for a category
 */
export function getSizeLimit(
  category: "tenant-avatar" | "user-avatar" | "campaign-cover" | "campaign-upload"
): number {
  switch (category) {
    case "tenant-avatar":
    case "user-avatar":
      return SIZE_LIMITS.AVATAR;
    case "campaign-cover":
      return SIZE_LIMITS.COVER;
    case "campaign-upload":
      return SIZE_LIMITS.UPLOAD;
    default:
      return SIZE_LIMITS.UPLOAD;
  }
}
