"use client";

import { motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Users } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AgentIcon,
  DashboardIcon,
  DocumentIcon,
  HelpIcon,
  SettingsIcon,
} from "@/components/layout/custom-icons";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

type AppHref = ComponentProps<typeof Link>["href"];

type NavItem = {
  key: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  basePath: string;
  subItems: Array<{ href: string; labelKey: string }>;
};

type AppShellUser = {
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
    role?: "owner" | "admin" | "recruiter" | "reviewer" | "member" | string | null;
  } | null;
};

const NAV_STRUCTURE: NavItem[] = [
  {
    key: "applications",
    labelKey: "applications",
    icon: AgentIcon,
    basePath: "/hr/applications",
    subItems: []
  },
  {
    key: "sourcing",
    labelKey: "sourcing",
    icon: DocumentIcon,
    basePath: "/hr/sourcing",
    subItems: [
      { href: "/hr/sourcing/queue", labelKey: "verification_queue" },
      { href: "/hr/sourcing/results", labelKey: "results" },
    ]
  },
  {
    key: "candidates",
    labelKey: "candidates",
    icon: Users,
    basePath: "/candidates",
    subItems: []
  },
  {
    key: "settings",
    labelKey: "settings",
    icon: SettingsIcon,
    basePath: "/settings",
    subItems: [
      { href: "/settings/company", labelKey: "company_profile" },
      { href: "/settings/team", labelKey: "team" },
      { href: "/settings/criteria", labelKey: "criteria" },
      { href: "/settings/billing", labelKey: "billing_credits" },
    ]
  }
];

export function AppShell({ 
  children, 
  user, 
  applications = [] 
}: { 
  children: ReactNode; 
  user: AppShellUser; 
  applications?: any[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({
    applications: true,
    sourcing: true,
  });

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const tNav = useTranslations("Nav");
  const tRoles = useTranslations("Settings.roles");

  const navItems: (NavItem & { isDynamic?: boolean })[] = NAV_STRUCTURE.map(item => {
    if (item.key === "applications") {
      return {
        ...item,
        subItems: applications
          .filter(m => m.workflowType === "application" && m.status === "Active")
          .map(m => ({
            href: `/hr/applications/${m.id}`,
            labelKey: m.title,
            isDynamic: true
          }))
      };
    }
    if (item.key === "sourcing") {
      return {
        ...item,
        subItems: applications
          .filter(m => m.workflowType === "sourcing" && m.status === "Active")
          .map(m => ({
            href: `/hr/sourcing/${m.id}`,
            labelKey: m.title,
            isDynamic: true
          }))
      };
    }
    return item;
  });

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-indigo-500/10">
      {/* Sidebar - Optimized for speed */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-30 flex flex-col border-r border-border bg-sidebar shrink-0"
      >
        <div className="flex flex-col h-full px-3 py-4 overflow-hidden">
          <div className={cn("mb-6 flex items-center px-1", collapsed ? "flex-col gap-6" : "justify-between")}>
            <img 
              src="/logo.png" 
              alt="Verytis" 
              className={cn(
                "h-14 w-auto object-contain grayscale contrast-125 opacity-70 transition-all duration-300 hover:opacity-100", 
                collapsed ? "h-9" : "h-14"
              )} 
            />
            {collapsed ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-foreground/35 hover:bg-secondary hover:text-foreground"
                onClick={() => setCollapsed(false)}
              >
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-foreground/35 hover:bg-secondary hover:text-foreground"
                onClick={() => setCollapsed(true)}
              >
                <ChevronLeft className="size-4" />
              </Button>
            )}
          </div>

          {!collapsed && (
            <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/25">
              {tNav("menu")}
            </p>
          )}
          <nav className="space-y-1">
            {/* Home */}
            <Link
              href="/"
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-foreground/50 transition duration-200 hover:bg-secondary hover:text-foreground",
                pathname === "/" && "bg-secondary text-foreground font-medium"
              )}
            >
              <DashboardIcon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{tNav("home")}</span>}
            </Link>

            {/* Dynamic Items */}
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasSubItems = item.subItems.length > 0;
              const isActiveGroup = pathname.startsWith(item.basePath);
              const isExpanded = expandedKeys[item.key];

              return (
                <div key={item.key} className="space-y-1">
                  <div
                    className={cn(
                      "group flex h-9 items-center justify-between rounded-[6px] px-2.5 text-[13px] text-foreground/50 transition duration-200 hover:bg-secondary hover:text-foreground",
                      isActiveGroup && "bg-secondary text-foreground font-medium"
                    )}
                  >
                    <Link href={item.basePath as AppHref} className="flex items-center gap-2.5 flex-1 h-full">
                      <Icon className="size-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{tNav(item.labelKey)}</span>}
                    </Link>
                    {!collapsed && hasSubItems && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleExpand(item.key);
                        }}
                        className="p-1 hover:bg-secondary/80 rounded transition-colors"
                      >
                        <ChevronDown className={cn("size-3.5 transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
                      </button>
                    )}
                  </div>

                  {!collapsed && hasSubItems && (
                    <motion.div
                      initial={false}
                      animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
                      className="overflow-hidden space-y-1 ml-4 border-l border-border/50 pl-2"
                    >
                      {item.subItems.map((subItem: any) => {
                        const isActiveSub = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
                        
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href as AppHref}
                            className={cn(
                              "flex h-8 items-center gap-2 px-2.5 text-[12px] text-foreground/40 transition hover:text-foreground",
                              isActiveSub && "text-foreground font-medium bg-secondary/50 rounded"
                            )}
                          >
                            <div className={cn(
                              "size-1.5 rounded-full",
                              isActiveSub ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" : "bg-foreground/20"
                            )} />
                            <span className="truncate">
                              {subItem.isDynamic ? subItem.labelKey : tNav(subItem.labelKey)}
                            </span>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto space-y-4">
            <Link
              href="#"
              className="flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] text-foreground/45 transition hover:bg-secondary hover:text-foreground"
            >
              <HelpIcon className="size-[18px] shrink-0" />
              {!collapsed ? <span>{tNav("help")}</span> : null}
            </Link>
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-3 px-2">
                {!collapsed ? (
                  <div className="flex min-w-0 flex-1 items-center justify-between">
                    <div className="min-w-0 flex flex-col">

                      <p className="truncate text-[13px] font-medium text-foreground/90 leading-none mb-1">
                        {user.profile?.first_name} {user.profile?.last_name}
                      </p>
                      <p className="truncate text-[10px] uppercase tracking-wider text-foreground/30 font-semibold leading-none">
                        {user.profile?.role === 'owner' ? tRoles('owner') : user.profile?.role === 'admin' ? tRoles('admin') : tRoles('member')}
                      </p>
                    </div>
                    <form action={logout}>
                      <button
                        type="submit"
                        className="text-foreground/30 transition hover:text-foreground ml-2"
                        title={tNav("logout")}
                      >
                        <LogOut className="size-3.5" />
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>

            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content - Flex-1 automatically fills space without animating padding */}
      <main className="flex-1 h-screen relative overflow-y-auto">
        <div className={cn(
          "w-full h-full",
          pathname !== "/" && "px-4 md:px-8 py-6"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}
