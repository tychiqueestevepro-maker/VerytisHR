import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { extractTextFromBuffer } from "./cv";
import { asObject, pickString, sanitizeFilename, truncateText } from "./utils";

export const MISSION_WORK_SAMPLES_BUCKET = "mission-work-samples";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/yaml",
  "application/octet-stream",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/javascript",
  "text/typescript",
  "text/x-python",
  "text/x-sql",
  "text/html",
  "text/css",
  "text/xml",
  "text/yaml",
];

export type MissionWorkSampleRow = Record<string, unknown>;

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

export function buildMissionWorkSamplePath(input: {
  companyId: string;
  missionId: string;
  filename: string;
}) {
  const safeFilename = sanitizeFilename(input.filename);
  return `${input.companyId}/${input.missionId}/${Date.now()}-${safeFilename}`;
}

export async function ensureMissionWorkSamplesBucket(supabase: SupabaseServiceClient = createSupabaseServiceClient()) {
  const { data: bucket, error: getError } = await supabase.storage.getBucket(MISSION_WORK_SAMPLES_BUCKET);

  if (!bucket && getError) {
    const { error: createError } = await supabase.storage.createBucket(MISSION_WORK_SAMPLES_BUCKET, {
      public: false,
      fileSizeLimit: 52_428_800,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });

    if (createError && !/already exists/i.test(createError.message)) {
      throw createError;
    }
    return;
  }

  const allowedMimeTypes = Array.isArray(bucket?.allowed_mime_types) ? bucket.allowed_mime_types : [];
  const shouldUpdateBucket = Boolean(bucket) && (
    bucket?.public ||
    bucket?.file_size_limit !== 52_428_800 ||
    ALLOWED_MIME_TYPES.some((mimeType) => !allowedMimeTypes.includes(mimeType))
  );

  if (shouldUpdateBucket) {
    const { error: updateError } = await supabase.storage.updateBucket(MISSION_WORK_SAMPLES_BUCKET, {
      public: false,
      fileSizeLimit: 52_428_800,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });

    if (updateError) throw updateError;
  }
}

export async function storeMissionWorkSample(input: {
  supabase?: SupabaseServiceClient;
  companyId: string;
  missionId: string;
  userId?: string | null;
  filename: string;
  mimeType?: string | null;
  buffer: Buffer;
  sampleType?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = input.supabase ?? createSupabaseServiceClient();
  await ensureMissionWorkSamplesBucket(supabase);

  const filePath = buildMissionWorkSamplePath({
    companyId: input.companyId,
    missionId: input.missionId,
    filename: input.filename,
  });
  const mimeType = input.mimeType || "text/plain";

  const { error: uploadError } = await supabase.storage
    .from(MISSION_WORK_SAMPLES_BUCKET)
    .upload(filePath, input.buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message || "Unable to upload work sample");

  const { data: inserted, error: insertError } = await supabase
    .from("mission_work_samples")
    .insert({
      company_id: input.companyId,
      mission_id: input.missionId,
      uploaded_by: input.userId ?? null,
      sample_type: input.sampleType || "real_team_material",
      status: "uploaded",
      storage_bucket: MISSION_WORK_SAMPLES_BUCKET,
      file_name: input.filename,
      file_path: filePath,
      mime_type: mimeType,
      file_size_bytes: input.buffer.byteLength,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message || "Unable to save work sample metadata");

  const row = asObject(inserted);
  try {
    const extractedText = await extractTextFromBuffer({
      buffer: input.buffer,
      mimeType,
      filename: input.filename,
    });

    const { data: parsed, error: updateError } = await supabase
      .from("mission_work_samples")
      .update({
        status: "parsed",
        extracted_text: extractedText,
      })
      .eq("id", row.id)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message || "Unable to save parsed work sample");
    return parsed as MissionWorkSampleRow;
  } catch (error) {
    await supabase
      .from("mission_work_samples")
      .update({
        status: "failed",
        metadata: {
          ...asObject(row.metadata),
          parse_error: error instanceof Error ? error.message : "Unknown parse error",
        },
      })
      .eq("id", row.id);

    throw error;
  }
}

export async function getMissionWorkSamples(input: {
  supabase?: SupabaseServiceClient;
  companyId: string;
  missionId: string;
}) {
  const supabase = input.supabase ?? createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("mission_work_samples")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("mission_id", input.missionId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || "Unable to load work samples");
  return Array.isArray(data) ? (data as MissionWorkSampleRow[]) : [];
}

export async function getMissionWorkSample(input: {
  supabase?: SupabaseServiceClient;
  companyId: string;
  missionId: string;
  sampleId: string;
}) {
  const supabase = input.supabase ?? createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("mission_work_samples")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("mission_id", input.missionId)
    .eq("id", input.sampleId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load work sample");
  return data ? (data as MissionWorkSampleRow) : null;
}

export async function createMissionWorkSampleSignedUrl(input: {
  supabase?: SupabaseServiceClient;
  sample: MissionWorkSampleRow;
  expiresIn?: number;
}) {
  const supabase = input.supabase ?? createSupabaseServiceClient();
  const bucket = pickString(input.sample.storage_bucket) ?? MISSION_WORK_SAMPLES_BUCKET;
  const filePath = pickString(input.sample.file_path);

  if (!filePath) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, input.expiresIn ?? 300);

  if (error) throw new Error(error.message || "Unable to create work sample link");
  return data.signedUrl;
}

export async function deleteMissionWorkSample(input: {
  supabase?: SupabaseServiceClient;
  companyId: string;
  missionId: string;
  sampleId: string;
}) {
  const supabase = input.supabase ?? createSupabaseServiceClient();
  const sample = await getMissionWorkSample({
    supabase,
    companyId: input.companyId,
    missionId: input.missionId,
    sampleId: input.sampleId,
  });

  if (!sample) return false;

  const bucket = pickString(sample.storage_bucket) ?? MISSION_WORK_SAMPLES_BUCKET;
  const filePath = pickString(sample.file_path);

  if (filePath) {
    const { error: storageError } = await supabase.storage.from(bucket).remove([filePath]);
    if (storageError) throw new Error(storageError.message || "Unable to delete work sample file");
  }

  const { error: deleteError } = await supabase
    .from("mission_work_samples")
    .delete()
    .eq("company_id", input.companyId)
    .eq("mission_id", input.missionId)
    .eq("id", input.sampleId);

  if (deleteError) throw new Error(deleteError.message || "Unable to delete work sample");
  return true;
}

export function workSamplePromptItems(samples: MissionWorkSampleRow[]) {
  return samples
    .map((sample) => {
      const content = pickString(sample.extracted_text);
      if (!content) return null;

      return {
        type: pickString(sample.sample_type) ?? "real_team_material",
        content: truncateText(content, 12000),
        fileName: pickString(sample.file_name),
      };
    })
    .filter((item): item is { type: string; content: string; fileName: string | null } => Boolean(item));
}

export function publicWorkSampleFields(sample: unknown) {
  const row = asObject(sample);
  const metadata = asObject(row.metadata);

  return {
    id: pickString(row.id),
    fileName: pickString(row.file_name),
    sampleType: pickString(row.sample_type),
    mimeType: pickString(row.mime_type),
    fileSizeBytes: row.file_size_bytes,
    status: pickString(row.status),
    parseError: pickString(metadata.parse_error),
    extractedText: pickString(row.extracted_text),
    createdAt: pickString(row.created_at),
    updatedAt: pickString(row.updated_at),
  };
}
