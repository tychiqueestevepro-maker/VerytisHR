import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import mammoth from "mammoth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { completeHrJson, HR_FAST_MODEL } from "./openai";
import { CV_PARSING_SYSTEM, buildCvParsingUserPrompt, CV_PARSING_SCHEMA_NAME, CvParsingJsonSchema, PROMPT_VERSIONS } from "./prompts";
import { computeAnalysisHash, findCachedAnalysis, storeCachedAnalysis } from "./analysis-cache";
import { asObject, pickString, sanitizeFilename, truncateText } from "./utils";

export const CANDIDATE_CVS_BUCKET = "candidate-cvs";

const nodeRequire = createRequire(import.meta.url);
let pdfWorkerConfigured = false;

type CandidateDocumentRow = {
  id: string;
  company_id: string;
  candidate_id: string;
  mission_id: string | null;
  storage_bucket: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
};

export function buildCandidateCvPath(input: {
  companyId: string;
  candidateId: string;
  filename: string;
}) {
  const safeFilename = sanitizeFilename(input.filename);
  return `${input.companyId}/${input.candidateId}/${Date.now()}-${safeFilename}`;
}

export async function ensureCandidateCvsBucket() {
  const supabase = createSupabaseServiceClient();
  const { data: bucket, error: getError } = await supabase.storage.getBucket(CANDIDATE_CVS_BUCKET);

  if (bucket || !getError) return;

  const { error: createError } = await supabase.storage.createBucket(CANDIDATE_CVS_BUCKET, {
    public: false,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw createError;
  }
}

export async function extractTextFromBuffer(input: {
  buffer: Buffer;
  mimeType?: string | null;
  filename?: string | null;
}) {
  const mimeType = input.mimeType || "";
  const filename = input.filename?.toLowerCase() || "";

  if (mimeType.includes("pdf") || filename.endsWith(".pdf")) {
    // Keep pdf-parse out of Next's server bundle so pdf.js resolves its worker from node_modules.
    const { PDFParse } = nodeRequire("pdf-parse") as typeof import("pdf-parse");
    if (!pdfWorkerConfigured) {
      const workerPath = join(dirname(nodeRequire.resolve("pdf-parse")), "pdf.worker.mjs");
      PDFParse.setWorker(pathToFileURL(workerPath).toString());
      pdfWorkerConfigured = true;
    }

    const parser = new PDFParse({ data: input.buffer });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("msword") ||
    filename.endsWith(".docx") ||
    filename.endsWith(".doc")
  ) {
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    return result.value.trim();
  }

  return input.buffer.toString("utf8").trim();
}

function fallbackParsedResume(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    summary: truncateText(lines.slice(0, 8).join(" "), 1200),
    experiences: [],
    companies: [],
    job_titles: [],
    dates: [],
    skills: [],
    education: [],
    location: null,
    seniority_level: null,
  };
}

export async function parseResumeTextWithAI(input: {
  companyId: string;
  text: string;
}) {
  const model = HR_FAST_MODEL;
  const truncated = truncateText(input.text, 18000);

  const inputHash = computeAnalysisHash({
    missionData: {},
    profileData: { text: truncated },
    linkedinData: null,
    promptVersion: PROMPT_VERSIONS.cv_parsing,
    scoringVersion: "v1",
    model,
  });

  const cached = await findCachedAnalysis({
    companyId: input.companyId,
    inputHash,
    analysisType: "cv_parsing",
  });
  if (cached) {
    return asObject(cached.result);
  }

  const ai = await completeHrJson({
    companyId: input.companyId,
    model,
    system: CV_PARSING_SYSTEM,
    user: buildCvParsingUserPrompt(truncated),
    schema: CvParsingJsonSchema,
    schemaName: CV_PARSING_SCHEMA_NAME,
  });

  const data = ai?.data ?? fallbackParsedResume(input.text);

  await storeCachedAnalysis({
    companyId: input.companyId,
    inputHash,
    analysisType: "cv_parsing",
    result: data,
    promptVersion: PROMPT_VERSIONS.cv_parsing,
    scoringVersion: "v1",
    model: ai?.model ?? model,
  });

  return data;
}

export async function parseCandidateDocument(documentId: string, companyId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: document, error } = await supabase
    .from("candidate_documents")
    .select("*")
    .eq("id", documentId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load candidate document");
  if (!document) throw new Error("Candidate document not found");

  const typedDocument = document as CandidateDocumentRow;
  const { data: file, error: downloadError } = await supabase.storage
    .from(typedDocument.storage_bucket || CANDIDATE_CVS_BUCKET)
    .download(typedDocument.file_path);

  if (downloadError || !file) {
    throw new Error(downloadError?.message || "Unable to download candidate CV");
  }

  await supabase
    .from("candidate_documents")
    .update({ status: "processing" })
    .eq("id", typedDocument.id);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractTextFromBuffer({
      buffer,
      mimeType: typedDocument.mime_type,
      filename: typedDocument.file_name,
    });
    const parsedData = await parseResumeTextWithAI({
      companyId,
      text: extractedText,
    });

    const { data: updated, error: updateError } = await supabase
      .from("candidate_documents")
      .update({
        status: "parsed",
        extracted_text: extractedText,
        parsed_data: parsedData,
      })
      .eq("id", typedDocument.id)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message || "Unable to save parsed CV");
    return updated;
  } catch (parseError) {
    await supabase
      .from("candidate_documents")
      .update({
        status: "failed",
        metadata: {
          parse_error: parseError instanceof Error ? parseError.message : "Unknown parse error",
        },
      })
      .eq("id", typedDocument.id);

    throw parseError;
  }
}

export async function findCandidateDocument(input: {
  companyId: string;
  candidateId: string;
  documentId?: string | null;
}) {
  const supabase = createSupabaseServiceClient();

  if (input.documentId) {
    const { data, error } = await supabase
      .from("candidate_documents")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("candidate_id", input.candidateId)
      .eq("id", input.documentId)
      .maybeSingle();

    if (error) throw new Error(error.message || "Unable to load document");
    return data ? asObject(data) : null;
  }

  const { data, error } = await supabase
    .from("candidate_documents")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("candidate_id", input.candidateId)
    .eq("document_type", "resume")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load document");
  return data ? asObject(data) : null;
}

export function publicDocumentFields(document: unknown) {
  const row = asObject(document);
  return {
    id: pickString(row.id),
    fileName: pickString(row.file_name),
    mimeType: pickString(row.mime_type),
    fileSizeBytes: row.file_size_bytes,
    status: pickString(row.status),
    createdAt: pickString(row.created_at),
    updatedAt: pickString(row.updated_at),
  };
}
