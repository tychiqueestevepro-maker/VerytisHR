import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { LandingHero } from "@/components/landing/landing-hero";

export const metadata: Metadata = {
  title: "Verytis — Verify every candidate. Hire with confidence.",
  description: "Verytis cross-checks CVs against LinkedIn, scores each profile on Fit, Trust and Opportunity, and builds custom assessment pipelines — all in one AI-powered platform.",
  openGraph: {
    title: "Verytis — Verify every candidate. Hire with confidence.",
    description: "Verytis cross-checks CVs against LinkedIn, scores each profile on Fit, Trust and Opportunity, and builds custom assessment pipelines — all in one AI-powered platform.",
    type: "website",
  },
};

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getUser();

  if (user) {
    redirect({ href: "/dashboard", locale });
  }

  return <LandingHero />;
}
