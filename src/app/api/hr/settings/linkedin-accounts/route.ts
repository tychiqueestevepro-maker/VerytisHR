import { NextResponse } from "next/server";
import { getHrContext, statusFromError, messageFromError } from "@/lib/hr/auth";
import { pickString } from "@/lib/hr/utils";
import { encryptLinkedInCredential } from "@/lib/hr/crypto";
import { runLinkedInLoginFlow } from "@/lib/hr/scraper/linkedin";

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

export async function POST(request: Request) {
  try {
    const { supabase, companyId, authUserId } = await getHrContext({ recruiter: true });
    
    // 1. On cherche d'abord le pays de l'UTILISATEUR (Recruteur)
    const { data: userProfile } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", authUserId)
      .single();
    
    // 2. On cherche le pays de l'ENTREPRISE (Fallback 1)
    const { data: company } = await supabase
      .from("companies")
      .select("country, city")
      .eq("id", companyId)
      .single();

    // 3. On regarde les headers de la requête (Fallback 2 - utile en prod)
    const headerCountry = request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry");

    const body = await request.json();
    const email = pickString(body.email);
    const password = pickString(body.password);
    
    // Logique de sélection du pays : User > Header > Company
    const userMeta = userProfile?.metadata as any;
    let selectedCountry = userMeta?.country || headerCountry || pickString(company?.country) || "";
    
    const countryCodeUpper = selectedCountry.toUpperCase();
    const preferredCity = userMeta?.city || pickString(company?.city);

    // Tentative de récupération des variables spécifiques au pays, sinon global
    const countryHost = countryCodeUpper ? process.env[`MANAGED_PROXY_HOST_${countryCodeUpper}`] : null;
    const proxyHost = countryHost || process.env.MANAGED_PROXY_HOST;
    const proxyPort = (countryCodeUpper ? process.env[`MANAGED_PROXY_PORT_${countryCodeUpper}`] : null) || process.env.MANAGED_PROXY_PORT;
    const proxyUser = (countryCodeUpper ? process.env[`MANAGED_PROXY_USER_${countryCodeUpper}`] : null) || process.env.MANAGED_PROXY_USER;
    const proxyPass = (countryCodeUpper ? process.env[`MANAGED_PROXY_PASS_${countryCodeUpper}`] : null) || process.env.MANAGED_PROXY_PASS;
 
    console.log(`[Proxy Selection] Country: ${selectedCountry || "GLOBAL"}, Host: ${proxyHost}`);
    if (countryHost) console.log(`[Proxy Selection] Successfully matched country-specific proxy for ${countryCodeUpper}`);
 
    let finalProxyConfig = {};
    const proxyApiUrl = process.env.SMARTPROXY_API_URL;



    if (proxyApiUrl) {
      // API extraction mode — fetch a fresh proxy IP at runtime (bypasses port restrictions)
      finalProxyConfig = { api_url: proxyApiUrl, is_managed: true };
    } else if (proxyHost && proxyUser && proxyPass) {
      // Fallback: static user:pass proxy
      let managedUsername = proxyUser;

      finalProxyConfig = {
        server: `${proxyHost}:${proxyPort || '3121'}`,
        username: managedUsername,
        password: proxyPass,
        is_managed: true,
        country: selectedCountry.toLowerCase()
      };

    }


    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const encryptedPassword = encryptLinkedInCredential(password);

    // On garde l'historique pour le débug (au lieu de tout supprimer systématiquement)
    // await supabase.from("linkedin_accounts").delete().eq("company_id", companyId);

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

    // Trigger background login flow
    console.log(`[API] Triggering LinkedIn login flow for account: ${account.id}`);
    runLinkedInLoginFlow(account.id).catch(err => {
      console.error(`[API] Background login flow failed for ${account.id}:`, err);
    });

    return NextResponse.json({ 
      success: true, 
      account: { id: account.id, email: account.email, status: account.status } 
    });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}
