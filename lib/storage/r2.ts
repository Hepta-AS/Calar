/**
 * Cloudflare R2 client and operations
 */

import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildDeletedKey } from "./keys";

/** URL expiration TTLs in seconds */
export const TTL = {
  AVATAR: 24 * 60 * 60, // 24 hours
  COVER: 24 * 60 * 60, // 24 hours
  UPLOAD: 1 * 60 * 60, // 1 hour
} as const;

/**
 * Get TTL based on file category
 */
export function getTTL(
  category: "avatar" | "cover" | "upload"
): number {
  switch (category) {
    case "avatar":
    case "cover":
      return TTL.AVATAR;
    case "upload":
      return TTL.UPLOAD;
    default:
      return TTL.UPLOAD;
  }
}

let r2Client: S3Client | null = null;

/**
 * Get configured R2 client (singleton)
 */
export function getR2Client(): S3Client {
  if (r2Client) {
    return r2Client;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 configuration missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
    );
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2Client;
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME environment variable is not set");
  }
  return bucket;
}

/**
 * Upload file to R2
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

/**
 * Soft delete file from R2
 * - Copies file to _deleted/{originalKey}
 * - Deletes the original
 */
export async function softDeleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();
  const deletedKey = buildDeletedKey(key);

  // Copy to deleted location
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: deletedKey,
    })
  );

  // Delete original
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Generate a signed download URL for a file
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds: number
): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  return url;
}
