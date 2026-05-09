
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { authenticateExtensionRequest } from "@/lib/hr/extension-tokens";

/**
 * Verifies an extension request by checking the authorization header
 * and fetching the associated integration.
 */
export async function verifyExtensionRequest(request: Request) {
  try {
    const tokenRow = await authenticateExtensionRequest(request);
    
    if (!tokenRow) {
      return { ok: false, error: "Invalid or missing token", status: 401 };
    }

    const supabase = createSupabaseServiceClient();
    const clientId = tokenRow.company_id;
    const { data: integration, error } = await supabase
      .from("integrations")
      .select("*")
      .eq("client_id", clientId)
      .eq("integration_type", "chrome_extension")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }

    if (!integration || integration.status !== "connected") {
      return { ok: false, error: "Integration not connected", status: 403 };
    }

    return {
      ok: true,
      supabase,
      clientId,
      companyId: tokenRow.company_id,
      integration,
    };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : "Authentication failed",
      status: 500,
    };
  }
}
