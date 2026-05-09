import Link from "next/link";
import { ArrowUpRight, Building2, CreditCard, KeyRound, SlidersHorizontal, Users } from "lucide-react";
import { PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

const sections = [
  {
    href: "/settings/company",
    title: "Company profile",
    detail: "Identity and billing contact.",
    icon: Building2,
  },
  {
    href: "/settings/team",
    title: "Team",
    detail: "Members, roles and access status.",
    icon: Users,
  },
  {
    href: "/settings/criteria",
    title: "Criteria",
    detail: "Global thresholds and mission evaluation signals.",
    icon: SlidersHorizontal,
  },
  {
    href: "/settings/billing",
    title: "Billing & credits",
    detail: "Plan, credits, limits and recent usage.",
    icon: CreditCard,
  },
];

export default async function SettingsPage() {
  const data = await getSettingsWorkspaceData();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Workspace settings"
        title="Settings"
        meta={
          <>
            <StatusBadge>{data.company.status}</StatusBadge>
            <span>{data.company.plan} plan</span>
            <span>{data.team.total} members</span>
            <span>{data.workspace.applications} applications</span>
          </>
        }
        actions={<LocaleSwitcher />}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <SectionBlock title="Company">
          <p className="text-lg font-semibold text-foreground">{data.company.name}</p>
          <p className="mt-2 text-sm text-foreground/45">{data.company.industry}</p>
        </SectionBlock>
        <SectionBlock title="Credits">
          <p className="text-2xl font-semibold text-foreground">{data.company.creditsBalance}</p>
          <p className="mt-2 text-sm text-foreground/45">Available balance</p>
        </SectionBlock>
        <SectionBlock title="Criteria">
          <p className="text-2xl font-semibold text-foreground">{data.criteria.fitThreshold}</p>
          <p className="mt-2 text-sm text-foreground/45">Default fit threshold</p>
        </SectionBlock>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.href}
              href={section.href}
              className="group border-t border-border pt-4 transition hover:border-foreground/40"
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <Icon className="size-4 text-foreground/45 transition group-hover:text-foreground" />
                <ArrowUpRight className="size-4 text-foreground/30 transition group-hover:text-foreground" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-foreground/50">{section.detail}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
