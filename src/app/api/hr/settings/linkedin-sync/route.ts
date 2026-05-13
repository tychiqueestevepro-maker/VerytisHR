import { NextResponse } from "next/server";
import { getHrContext, statusFromError, messageFromError } from "@/lib/hr/auth";
import { asObject, pickString } from "@/lib/hr/utils";

/**
 * API Route: Sync LinkedIn Cookie from Extension
 * POST /api/hr/settings/linkedin-sync
 * 
 * This allows the extension to automatically update the LinkedIn session cookie
 * used for server-side scraping, without manual F12 manipulation by the user.
 */
export async function POST(request: Request) {
  try {
    const { supabase, companyId, authUserId } = await getHrContext({ recruiter: true });
    const body = await request.json();
    const action = body.action;

    // Handle manual fallback from Push to Email
    if (action === "fallback_to_email" && body.challengeId) {
      const { error: fallbackError } = await supabase
        .from("linkedin_challenges")
        .update({ challenge_status: "expired" })
        .eq("id", body.challengeId);

      if (fallbackError) throw fallbackError;
      return NextResponse.json({ success: true });
    }

    const cookie = pickString(body.cookie);
    const name = pickString(body.name);
    const image = pickString(body.image);
    const html = pickString(body.html);

    if (!cookie) {
      return NextResponse.json({ error: "Cookie missing" }, { status: 400 });
    }

    // On récupère les métadonnées actuelles pour les fusionner
    const { data: company } = await supabase
      .from("companies")
      .select("metadata")
      .eq("id", companyId)
      .single();

    const currentMetadata = asObject(company?.metadata);
    // 1. On prépare le cookie de session (li_at ou chaîne complète document.cookie)
    // Pour une fiabilité maximale sur le serveur, envoyer tout document.cookie depuis l'extension
    const normalizedCookie = cookie.includes("li_at=") ? cookie : `li_at=${cookie}`;

    const nextMetadata: any = {
      ...currentMetadata,
      linkedin_session_cookie: normalizedCookie,
      linkedin_cookie_updated_at: new Date().toISOString(),
    };

    if (name) nextMetadata.linkedin_account_name = name;
    if (image) nextMetadata.linkedin_account_image = image;
    if (html) nextMetadata.last_scraped_html = html;

    // 1. Mise à jour de l'entreprise
    const { error: companyUpdateError } = await supabase
      .from("companies")
      .update({ metadata: nextMetadata })
      .eq("id", companyId);

    // 2. Mise à jour de l'utilisateur (Fallback)
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ metadata: nextMetadata })
      .eq("id", authUserId);

    if (companyUpdateError && userUpdateError) {
      return NextResponse.json({ 
        error: "Impossible d'enregistrer les données"
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "LinkedIn session synchronized",
      identity: { 
        name: nextMetadata.linkedin_account_name, 
        image: nextMetadata.linkedin_account_image 
      } 
    });

  } catch (caught) {
    console.error("[LinkedInSync] Sync failed:", caught);
    const status = statusFromError(caught);
    
    // On essaie de récupérer le maximum d'infos sur l'erreur
    let errorMessage = "Unable to sync LinkedIn cookie";
    if (caught instanceof Error) errorMessage = caught.message;
    else if (typeof caught === "object" && caught !== null) {
      errorMessage = (caught as any).message || (caught as any).error_description || JSON.stringify(caught);
    }

    return NextResponse.json(
      { 
        error: errorMessage, 
        caught: caught,
        stack: caught instanceof Error ? caught.stack : undefined 
      },
      { status }
    );
  }
}

export async function DELETE() {
  try {
    const { supabase, companyId } = await getHrContext({ recruiter: true });

    const { data: company } = await supabase
      .from("companies")
      .select("metadata")
      .eq("id", companyId)
      .single();

    // 1. Get all LinkedIn accounts for this company
    const { data: accounts } = await supabase
      .from("linkedin_accounts")
      .select("id")
      .eq("company_id", companyId);

    const accountIds = (accounts || []).map((a: any) => a.id);

    if (accountIds.length > 0) {
      // 2. Delete all active sessions from the database
      await supabase
        .from("linkedin_sessions")
        .delete()
        .in("account_id", accountIds);

      // 3. Delete accounts entirely
      await supabase
        .from("linkedin_accounts")
        .delete()
        .in("id", accountIds);
    }

    const metadata = asObject(company?.metadata);
    delete metadata.linkedin_session_cookie;
    delete metadata.linkedin_cookie_updated_at;
    delete metadata.linkedin_account_name;
    delete metadata.linkedin_account_image;

    const { error: updateError } = await supabase
      .from("companies")
      .update({ metadata })
      .eq("id", companyId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, message: "LinkedIn session revoked" });
  } catch (caught) {
    return NextResponse.json(
      { error: messageFromError(caught, "Unable to revoke LinkedIn session") },
      { status: statusFromError(caught) }
    );
  }
}
