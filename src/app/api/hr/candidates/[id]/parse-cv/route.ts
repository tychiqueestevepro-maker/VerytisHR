import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { findCandidateDocument, parseCandidateDocument, publicDocumentFields } from "@/lib/hr/cv";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { asObject, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { companyId, authUserId } = await getHrContext({ recruiter: true });
    await assertUsageLimit({ companyId, candidateId: id, eventType: "document_parse" });

    const body = asObject(await request.json().catch(() => ({})));
    const document = await findCandidateDocument({
      companyId,
      candidateId: id,
      documentId: pickString(body.documentId, body.document_id),
    });

    if (!document) {
      return NextResponse.json({ error: "Candidate CV document not found" }, { status: 404 });
    }

    const parsed = await parseCandidateDocument(String(document.id), companyId);
    await logUsageEvent({
      companyId,
      userId: authUserId,
      candidateId: id,
      applicationId: pickString(document.mission_id),
      eventType: "document_parse",
      provider: "openai",
      metadata: {
        document_id: document.id,
      },
    });

    return NextResponse.json({
      document: publicDocumentFields(parsed),
      parsedData: asObject(parsed).parsed_data ?? {},
    });
  } catch (error) {
    const message = messageFromError(error, "Unable to parse CV");
    const status = message.includes("Usage limit") ? 402 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
