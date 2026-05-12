import { NextResponse } from "next/server";
import { getHrContext, statusFromError, messageFromError } from "@/lib/hr/auth";
import { pickString } from "@/lib/hr/utils";
import { encryptLinkedInCredential } from "@/lib/hr/crypto";
import { runLinkedInLoginFlow } from "@/lib/hr/scraper/linkedin";

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

export async function POST(request: Request) {
  try {
    const { supabase, companyId } = await getHrContext({ recruiter: true });
    
    // On récupère les infos de l'entreprise pour le pays par défaut
    const { data: company } = await supabase
      .from("companies")
      .select("country, city")
      .eq("id", companyId)
      .single();

    const body = await request.json();
    
    const email = pickString(body.email);
    const password = pickString(body.password);
    const preferredCity = pickString(company?.city);
    let finalProxyConfig = {};
    const proxyApiUrl = process.env.SMARTPROXY_API_URL;
    const proxyHost = process.env.MANAGED_PROXY_HOST;
    const proxyPort = process.env.MANAGED_PROXY_PORT;
    const proxyUser = process.env.MANAGED_PROXY_USER;
    const proxyPass = process.env.MANAGED_PROXY_PASS;

    if (proxyApiUrl) {
      // API extraction mode — fetch a fresh proxy IP at runtime (bypasses port restrictions)
      finalProxyConfig = { api_url: proxyApiUrl, is_managed: true };
    } else if (proxyHost && proxyUser && proxyPass) {
      // Fallback: static user:pass proxy
      const countryCode = (pickString(company?.country) || "FR").toLowerCase();
      let managedUsername = proxyUser;
      // Decodo (new Smartproxy) uses -country- format; legacy used -area-
      if (!managedUsername.includes("-country-") && !managedUsername.includes("-area-")) {
        managedUsername = `${managedUsername}-country-${countryCode}`;
      }
      finalProxyConfig = {
        server: `${proxyHost}:${proxyPort || '3121'}`,
        username: managedUsername,
        password: proxyPass,
        is_managed: true,
      };
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const encryptedPassword = encryptLinkedInCredential(password);

    const { data: account, error } = await supabase
      .from("linkedin_accounts")
      .insert({
        company_id: companyId,
        email,
        password: encryptedPassword,
        proxy_config: finalProxyConfig,
        preferred_city: preferredCity,
        status: "disconnected"
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger background login flow (don't await it to avoid timeout)
    runLinkedInLoginFlow(account.id).catch(console.error);

    return NextResponse.json({ 
      success: true, 
      account: { id: account.id, email: account.email, status: account.status } 
    });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}
