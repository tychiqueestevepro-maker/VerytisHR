import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { pickString } from "./utils";

export const CANDIDATE_PROFILE_IMAGES_BUCKET = "candidate-profile-images";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

let bucketEnsured = false;

export function normalizeProfileImageInput(...values: unknown[]) {
  const value = pickString(...values);
  return value?.replace(/&amp;/g, "&").replace(/\\u0026/g, "&") ?? null;
}

function normalizedMimeType(value: string | null) {
  return value?.split(";")[0]?.trim().toLowerCase() ?? null;
}

function imageExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/avif") return "avif";
  return "jpg";
}

async function ensureCandidateProfileImagesBucket(supabase: SupabaseServiceClient) {
  if (bucketEnsured) return;

  const { data: bucket, error: getError } = await supabase.storage.getBucket(CANDIDATE_PROFILE_IMAGES_BUCKET);

  if (!bucket && getError) {
    const { error: createError } = await supabase.storage.createBucket(CANDIDATE_PROFILE_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: MAX_PROFILE_IMAGE_BYTES,
      allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES,
    });

    if (createError && !/already exists/i.test(createError.message)) {
      throw createError;
    }
  }

  const allowedMimeTypes = Array.isArray(bucket?.allowed_mime_types) ? bucket.allowed_mime_types : [];
  const shouldUpdateBucket = Boolean(bucket) && (
    !bucket?.public ||
    PROFILE_IMAGE_MIME_TYPES.some((mimeType) => !allowedMimeTypes.includes(mimeType))
  );

  if (shouldUpdateBucket) {
    const { error: updateError } = await supabase.storage.updateBucket(CANDIDATE_PROFILE_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: MAX_PROFILE_IMAGE_BYTES,
      allowedMimeTypes: PROFILE_IMAGE_MIME_TYPES,
    });

    if (updateError) throw updateError;
  }

  bucketEnsured = true;
}

export async function storeCandidateProfileImage(
  supabase: SupabaseServiceClient,
  input: {
    companyId: string;
    candidateId: string;
    image: string | null;
  },
) {
  const image = normalizeProfileImageInput(input.image);
  if (!image) return null;
  if (image.includes(CANDIDATE_PROFILE_IMAGES_BUCKET)) return image;

  const isDataUrl = image.startsWith("data:image/");

  try {
    let buffer: Buffer;
    let contentType = "image/jpeg";

    if (isDataUrl) {
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return null;

      const detectedContentType = normalizedMimeType(match[1]);
      if (!detectedContentType || !PROFILE_IMAGE_MIME_TYPES.includes(detectedContentType)) return null;

      contentType = detectedContentType;
      buffer = Buffer.from(match[2], "base64");
    } else if (/^https?:\/\//i.test(image)) {
      const response = await fetch(image, {
        headers: {
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "user-agent": "Mozilla/5.0 VerytisHR/1.0",
        },
        redirect: "follow",
      });
      if (!response.ok) return image;

      const detectedContentType = normalizedMimeType(response.headers.get("content-type"));
      if (!detectedContentType || !PROFILE_IMAGE_MIME_TYPES.includes(detectedContentType)) return image;

      contentType = detectedContentType;
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      return null;
    }

    if (buffer.byteLength > MAX_PROFILE_IMAGE_BYTES) return isDataUrl ? null : image;

    await ensureCandidateProfileImagesBucket(supabase);

    const extension = imageExtension(contentType);
    const filename = `${input.companyId}/${input.candidateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error } = await supabase.storage
      .from(CANDIDATE_PROFILE_IMAGES_BUCKET)
      .upload(filename, buffer, {
        contentType,
        upsert: true,
      });

    if (error) return isDataUrl ? null : image;

    const { data } = supabase.storage.from(CANDIDATE_PROFILE_IMAGES_BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  } catch {
    return isDataUrl ? null : image;
  }
}
