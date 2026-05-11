import Link from "next/link";
import { ArrowUpRight, Building2, CreditCard, KeyRound, SlidersHorizontal, Users } from "lucide-react";
import { PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

const sections = [
  {
    href: "/settings/profile",
    title: "Profil",
    detail: "Nom, email et photo de profil.",
    icon: KeyRound,
  },
  {
    href: "/settings/company",
    title: "Entreprise",
    detail: "Identité et contact de facturation.",
    icon: Building2,
  },
  {
    href: "/settings/team",
    title: "Équipe",
    detail: "Membres, rôles et accès.",
    icon: Users,
  },
  {
    href: "/settings/billing",
    title: "Facturation",
    detail: "Plan, crédits, limites et usage.",
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

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <SectionBlock title="Profil">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/40 bg-pink-500/10 shadow-sm">
              {data.user.avatarUrl ? (
                <img src={data.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-black text-pink-600">
                  {data.user.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-foreground truncate max-w-[140px]">{data.user.name}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-600 opacity-60">{data.role}</p>
            </div>
          </div>
        </SectionBlock>
        <SectionBlock title="Entreprise">
          <p className="text-lg font-semibold text-foreground truncate">{data.company.name}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-foreground/30">{data.company.industry}</p>
        </SectionBlock>
        <SectionBlock title="Facturation">
          <p className="text-2xl font-black text-foreground">{data.company.creditsBalance}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-foreground/30">Solde disponible</p>
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
