import { NextResponse } from "next/server";
import { getHrContext } from "@/lib/hr/auth";
import { processHrChat } from "@/lib/hr/chat";

export async function POST(req: Request) {
  try {
    const { companyId } = await getHrContext();
    const body = await req.json();
    const { message, flowId, contextId, locale } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const result = await processHrChat({
      companyId,
      message,
      flowId,
      contextId,
      locale,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
