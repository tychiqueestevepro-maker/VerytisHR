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
    const proxyInput = null; // No manual proxy for beta

    let finalProxyConfig = {};
    const proxyHost = process.env.MANAGED_PROXY_HOST;
    const proxyPort = process.env.MANAGED_PROXY_PORT;
    const proxyUser = process.env.MANAGED_PROXY_USER;
    const proxyPass = process.env.MANAGED_PROXY_PASS;

    if (proxyHost && proxyUser && proxyPass) {
      // Utilisation du pool géré par Verytis avec ciblage par pays
      const countryCode = (pickString(company?.country) || "FR").toLowerCase();
      
      let managedUsername = proxyUser;
      
      // Smartproxy utilise -area- pour le pays d'après la capture
      if (managedUsername.includes("{country}")) {
        managedUsername = managedUsername.replace("{country}", countryCode);
      } else if (!managedUsername.includes("-area-")) {
        managedUsername = `${managedUsername}-area-${countryCode}`;
      }
      
      // Ajout d'une SESSION STICKY rafraîchie à chaque tentative (pour changer d'IP si bloqué)
      // On utilise l'email + l'heure actuelle pour forcer une nouvelle IP propre
      const safeEmail = email || "default";
      const timestamp = Math.floor(Date.now() / (1000 * 60 * 10)); // Change toutes les 10 min
      const sessionId = Buffer.from(safeEmail + timestamp).toString('hex').substring(0, 8);
      if (!managedUsername.includes("-session-")) {
        managedUsername = `${managedUsername}-session-${sessionId}`;
      }
      
      if (preferredCity) {
        const citySlug = preferredCity.toLowerCase().trim().replace(/\s+/g, "");
        if (managedUsername.includes("{city}")) {
          managedUsername = managedUsername.replace("{city}", citySlug);
        } else if (!managedUsername.includes("-city-")) {
          managedUsername = `${managedUsername}-city-${citySlug}`;
        }
      }

      finalProxyConfig = {
        server: `http://${proxyHost}:${proxyPort || '10001'}`,
        username: managedUsername,
        password: proxyPass,
        is_managed: true,
        country: countryCode,
        city: preferredCity
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
