import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const headerList = await headers();
  const authHeader = headerList.get("Authorization");

  // Si on a un header Bearer, on l'utilise pour l'auth (cas de l'extension)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    console.log("[Supabase] Using Bearer token for authentication");
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        cookies: {
          getAll() { return []; },
          setAll() {},
        },
      }
    );
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — les cookies Set sont ignorés si appelé depuis SC
          }
        },
      },
    }
  );
}

/**
 * Service role client — contourne RLS.
 * Utiliser UNIQUEMENT côté serveur pour des opérations sensibles.
 */
export function createSupabaseServiceClient() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
