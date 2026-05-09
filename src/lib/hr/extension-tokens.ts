import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type ExtensionTokenRow = {
  id: string;
  company_id: string;
  user_id: string | null;
  token_hash: string;
  status: "active" | "revoked";
};

export function hashExtensionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createRawExtensionToken() {
  return `vhr_${crypto.randomBytes(32).toString("base64url")}`;
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function createExtensionToken(input: {
  companyId: string;
  userId: string;
}) {
  const supabase = createSupabaseServiceClient();
  const token = createRawExtensionToken();
  const tokenHash = hashExtensionToken(token);

  const { data, error } = await supabase
    .from("hr_extension_tokens")
    .insert({
      company_id: input.companyId,
      user_id: input.userId,
      token_hash: tokenHash,
      status: "active",
    })
    .select("id, created_at")
    .single();

  if (error) {
    throw new Error(error.message || "Unable to create extension token");
  }

  return {
    token,
    tokenId: String(data.id),
    createdAt: String(data.created_at),
  };
}

export async function authenticateExtensionRequest(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    throw new Error("Missing extension token");
  }

  const supabase = createSupabaseServiceClient();
  const tokenHash = hashExtensionToken(token);
  const { data, error } = await supabase
    .from("hr_extension_tokens")
    .select("id, company_id, user_id, token_hash, status")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to verify extension token");
  }

  if (!data) {
    throw new Error("Invalid extension token");
  }

  const tokenRow = data as ExtensionTokenRow;
  await supabase
    .from("hr_extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return tokenRow;
}
