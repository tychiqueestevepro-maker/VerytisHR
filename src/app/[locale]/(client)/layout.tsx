import { redirect } from "next/navigation";
import { getUserWithProfile } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getApplicationListData } from "@/lib/hr/application-workspace";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserWithProfile();

  if (!user) {
    redirect("/login");
  }

  const { applications } = await getApplicationListData();

  return <AppShell user={user} applications={applications}>{children}</AppShell>;
}
