import { redirect } from "next/navigation";
import { getUserWithProfile } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getApplicationListData } from "@/lib/hr/application-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getSidebarBilling() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.company_id) return null;

    const [companyRes, limitsRes] = await Promise.all([
      supabase
        .from("companies")
        .select("credits_balance, plan_id")
        .eq("id", profile.company_id)
        .maybeSingle(),
      supabase
        .from("company_usage_limits")
        .select("max_monthly_credits")
        .eq("company_id", profile.company_id)
        .maybeSingle(),
    ]);

    return {
      creditsBalance: Number(companyRes.data?.credits_balance ?? 0),
      maxMonthlyCredits: Number(limitsRes.data?.max_monthly_credits ?? 200),
      planId: companyRes.data?.plan_id ?? null,
    };
  } catch {
    return null;
  }
}

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserWithProfile();

  if (!user) {
    redirect("/login");
  }

  const [{ applications }, billing] = await Promise.all([
    getApplicationListData(),
    getSidebarBilling(),
  ]);

  return <AppShell user={user} applications={applications} billing={billing}>{children}</AppShell>;
}
