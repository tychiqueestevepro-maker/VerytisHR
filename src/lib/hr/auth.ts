import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

type HrRole = "owner" | "admin" | "recruiter" | "reviewer" | "member";

type HrUserRow = {
  id: string;
  company_id: string | null;
  email: string;
  role: HrRole;
  status: string;
};

export type HrContext = {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  authUserId: string;
  companyId: string;
  role: HrRole;
  user: HrUserRow;
};

export class HrAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function canRecruit(role: HrRole) {
  return role === "owner" || role === "admin" || role === "recruiter";
}

export function canAdmin(role: HrRole) {
  return role === "owner" || role === "admin";
}

export async function getHrContext(options: { recruiter?: boolean; admin?: boolean } = {}): Promise<HrContext> {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser();

  if (authError || !user) {
    throw new HrAuthError("Authentication required", 401);
  }

  const supabase = createSupabaseServiceClient();
  const { data: hrUser, error: userError } = await supabase
    .from("users")
    .select("id, company_id, email, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (userError) {
    throw new HrAuthError(userError.message || "Unable to load HR user", 500);
  }

  const typedUser = hrUser as HrUserRow | null;
  if (!typedUser || typedUser.status !== "active" || !typedUser.company_id) {
    throw new HrAuthError("No active company attached to this user", 403);
  }

  if (options.recruiter && !canRecruit(typedUser.role)) {
    throw new HrAuthError("Recruiter access required", 403);
  }

  if (options.admin && !canAdmin(typedUser.role)) {
    throw new HrAuthError("Admin access required", 403);
  }

  return {
    supabase,
    authUserId: user.id,
    companyId: typedUser.company_id,
    role: typedUser.role,
    user: typedUser,
  };
}

export function statusFromError(error: unknown) {
  if (error instanceof HrAuthError) return error.status;
  return 500;
}

export function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
