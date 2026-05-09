import { getApplicationListData } from "@/lib/hr/application-workspace";
import { DashboardClient } from "./dashboard-client";

export default async function HomePage() {
  const { applications } = await getApplicationListData();

  return <DashboardClient applications={applications} />;
}
