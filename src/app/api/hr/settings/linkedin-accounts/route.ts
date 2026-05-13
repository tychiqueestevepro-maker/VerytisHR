import { NextResponse } from "next/server";
import { getHrContext, statusFromError, messageFromError } from "@/lib/hr/auth";

export const dynamic = 'force-dynamic'; // Désactive le cache agressif de Next.js
export const revalidate = 0;

export async function GET() {
  try {
    const { supabase, companyId } = await getHrContext({ recruiter: true });

    const { data: accounts, error } = await supabase
      .from("linkedin_accounts")
      .select("id, email, status, last_error, updated_at, proxy_config, last_detected_ip, last_detected_country, last_detected_city")
      .eq("company_id", companyId);

    if (error) throw error;

    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}

