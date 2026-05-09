import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { createExtensionToken } from "@/lib/hr/extension-tokens";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { companyId, authUserId } = await getHrContext({ recruiter: true });
    const token = await createExtensionToken({
      companyId,
      userId: authUserId,
    });

    return NextResponse.json(token, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to create extension token") }, { status: statusFromError(error) });
  }
}
