import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, CircleAlert, Clock, FileText, Inbox, Link2, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("verified") || normalized.includes("strong") || normalized.includes("parsed")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("analyzing") || normalized.includes("review") || normalized.includes("pending") || normalized.includes("draft")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (normalized.includes("missing")) {
    return "border-border bg-secondary text-foreground/40";
  }
  if (normalized.includes("failed") || normalized.includes("reject") || normalized.includes("low")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (normalized.includes("completed") || normalized.includes("submitted")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-border bg-secondary text-foreground/70";
}

export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/35">{eyebrow}</p>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-normal text-foreground md:text-3xl">{title}</h1>
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-foreground/50">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function ActionLink({
  href,
  children,
  icon: Icon = ArrowRight,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition",
        variant === "primary"
          ? "border-foreground bg-foreground text-background hover:bg-foreground/85"
          : "border-border bg-background text-foreground/70 hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {children}
    </Link>
  );
}

export function PlainButton({
  children,
  icon: Icon,
  type = "button",
  disabled,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground/75 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export const applicationIcons = {
  overview: BriefcaseBusiness,
  progress: CheckCircle2,
  alerts: CircleAlert,
  clock: Clock,
  pipeline: Link2,
  sourcing: Search,
  applications: Inbox,
  settings: Settings,
  file: FileText,
};

function LinkedinIcon({ className, fill = "none" }: { className?: string; fill?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export function LinkedinBadge({ url }: { url?: string | null }) {
  const isLinked = Boolean(url && (url.includes("linkedin.com") || url.includes("/in/")));
  const href = url?.startsWith("http://") || url?.startsWith("https://") ? url : url ? `https://${url}` : null;
  
  if (!isLinked) {
    return (
      <div className="flex size-8 items-center justify-center rounded-lg bg-secondary/50 text-foreground/15">
        <LinkedinIcon className="size-4.5" />
      </div>
    );
  }

  return (
    <a 
      href={href!} 
      target="_blank" 
      rel="noopener noreferrer"

      className="flex size-8 items-center justify-center rounded-lg bg-[#0077b5] text-white transition-all hover:bg-[#006097] hover:shadow-sm active:scale-95"
      title={href!}
    >
      <LinkedinIcon className="size-4.5" fill="currentColor" />
    </a>
  );
}

export function StatusBadge({ children }: { children: React.ReactNode }) {
  const label = typeof children === "string" ? children : String(children ?? "");
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium", statusTone(label))}>
      {children}
    </span>
  );
}

export function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-foreground/30">-</span>;

  const tone =
    value >= 80
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : value >= 60
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-rose-700 bg-rose-50 border-rose-200";

  return <span className={cn("inline-flex h-6 min-w-10 items-center justify-center rounded-full border px-2 text-xs font-semibold", tone)}>{value}</span>;
}

function TabNav({
  tabs,
  active,
}: {
  tabs: Array<{ key: string; label: string; href: string }>;
  active: string;
}) {
  return (
    <nav className="mb-7 flex gap-1 overflow-x-auto border-b border-border pb-px">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "-mb-px inline-flex h-10 items-center whitespace-nowrap border-b px-3 text-sm transition",
            active === tab.key
              ? "border-foreground text-foreground"
              : "border-transparent text-foreground/45 hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function ApplicationTabs({ 
  applicationId, 
  active, 
  workflowType = "application" 
}: { 
  applicationId: string; 
  active: "overview" | "sourcing" | "applications" | "settings" | "pipeline" | "sessions" | "results";
  workflowType?: "sourcing" | "application";
}) {
  const base = workflowType === "sourcing" ? "/hr/sourcing" : "/hr/applications";
  const tabs = [
    { key: "overview", label: "Overview", href: `${base}/${applicationId}` },
    workflowType === "sourcing" && { key: "sourcing", label: "Sourcing", href: `${base}/${applicationId}/candidates` },
    workflowType === "application" && { key: "pipeline", label: "Pipeline", href: `${base}/${applicationId}/applications/pipeline` },
    workflowType === "application" && { key: "sessions", label: "Sessions", href: `${base}/${applicationId}/applications/sessions` },
    workflowType === "application" && { key: "results", label: "Application Results", href: `${base}/${applicationId}/applications/results` },
    { key: "settings", label: "Settings", href: `${base}/${applicationId}/settings` },
  ].filter((t): t is { key: string; label: string; href: string } => Boolean(t));

  return <TabNav tabs={tabs} active={active} />;
}

export function SourcingTabs({ 
  applicationId, 
  active 
}: { 
  applicationId: string; 
  active: "overview" | "import" | "candidates" | "results" | "settings" 
}) {
  const base = "/hr/sourcing";
  return (
    <TabNav
      active={active}
      tabs={[
        { key: "overview", label: "Overview", href: `${base}/${applicationId}` },
        { key: "import", label: "Import", href: `${base}/${applicationId}/import` },
        { key: "candidates", label: "Talent Pool", href: `${base}/${applicationId}/candidates` },
        { key: "results", label: "Sourcing Results", href: `${base}/${applicationId}/results` },
        { key: "settings", label: "Settings", href: `${base}/${applicationId}/settings` },
      ]}
    />
  );
}

export function MetricLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border/70 py-3 last:border-0">
      <span className="text-sm text-foreground/45">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function SectionBlock({
  title,
  children,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className="border-t border-border pt-4">
      <div className="mb-3 flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-foreground/45" /> : null}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center border-y border-border py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {detail ? <p className="mt-2 max-w-md text-sm leading-6 text-foreground/45">{detail}</p> : null}
    </div>
  );
}


