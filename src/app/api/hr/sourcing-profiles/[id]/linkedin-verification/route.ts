import { POST as verifyCandidateLinkedIn } from "@/app/api/hr/candidates/[id]/linkedin-verification/route";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext) {
  return verifyCandidateLinkedIn(request, context);
}
