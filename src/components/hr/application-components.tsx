import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock, FileText, Inbox, Link2, Search, Settings, ArrowLeft, Brain, ChevronDown, Loader2, MoreHorizontal, Plus, Settings2, Sparkles, Trophy, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
export { Avatar } from "./avatar";

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
    <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-pink-600/60">{eyebrow}</p>
        ) : null}
        <h1 className="truncate text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">{title}</h1>
        {meta ? (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-medium text-foreground/40">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
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
  variant?: "primary" | "secondary" | "pink";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all duration-200",
        variant === "primary"
          ? "border-foreground bg-foreground text-background hover:bg-foreground/85 shadow-sm"
          : variant === "pink"
          ? "border-pink-500/20 bg-pink-500 text-white hover:bg-pink-600 shadow-[0_4px_12px_rgba(236,72,153,0.25)] hover:shadow-[0_6px_16px_rgba(236,72,153,0.35)] active:scale-[0.98]"
          : "border-border bg-background text-foreground/70 hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4", variant === "pink" ? "text-white" : "")} />
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

export function LinkedinIcon({ className, fill = "none" }: { className?: string; fill?: string }) {
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
    <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-wider shadow-sm", statusTone(label))}>
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

  return <span className={cn("inline-flex h-6 min-w-10 items-center justify-center rounded-full border px-2.5 text-[11px] font-bold shadow-sm", tone)}>{value}</span>;
}

function TabNav({
  tabs,
  active,
}: {
  tabs: Array<{ key: string; label: string; href: string }>;
  active: string;
}) {
  return (
    <nav className="mb-10 flex gap-2 overflow-x-auto p-1.5 bg-black/[0.03] rounded-xl w-fit">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "relative inline-flex h-9 items-center whitespace-nowrap px-5 text-[13px] font-semibold transition-all duration-300 rounded-lg",
              isActive
                ? "bg-white text-pink-600 shadow-sm ring-1 ring-black/[0.05]"
                : "text-foreground/40 hover:text-foreground/70 hover:bg-black/[0.02]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
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

export function MetricLine({ 
  label, 
  value, 
  vertical = false,
  className
}: { 
  label: string; 
  value: React.ReactNode; 
  vertical?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex min-h-12 gap-2 border-b border-black/[0.04] py-3.5 last:border-0 transition-colors hover:bg-black/[0.01] px-2 rounded-lg",
      vertical ? "flex-col items-start justify-center" : "items-center justify-between gap-4",
      className
    )}>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">{label}</span>
      <span className={cn(
        "text-[13px] font-semibold text-foreground/80",
        !vertical && "text-right"
      )}>{value}</span>
    </div>
  );
}

export function SectionBlock({
  title,
  children,
  icon: Icon,
  className,
}: {
  title: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <section className={cn(
      "rounded-2xl border border-white/60 bg-white/40 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] hover:border-white/80",
      className
    )}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600 shadow-inner">
          {Icon ? <Icon className="size-4.5" /> : <BriefcaseBusiness className="size-4.5" />}
        </div>
        <h2 className="text-[16px] font-bold tracking-tight text-foreground/90">{title}</h2>
      </div>
      <div className="space-y-0.5">
        {children}
      </div>
    </section>
  );
}

export function DataTable({
  headers,
  children,
  minWidth = "800px",
}: {
  headers: string[];
  children: React.ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-black/[0.04] bg-black/[0.02] text-left">
              {headers.map((header, i) => (
                <th 
                  key={i} 
                  className={cn(
                    "px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30",
                    header.toLowerCase().includes("score") || header.toLowerCase().includes("action") || header.toLowerCase().includes("fit") || header.toLowerCase().includes("trust") || header.toLowerCase().includes("team") ? "text-right" : "",
                    header.toLowerCase().includes("cv") || header.toLowerCase().includes("linkedin") ? "text-center" : ""
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.03]">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TagCloud({ items, variant = "default" }: { items: string[]; variant?: "default" | "pink" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span 
          key={item} 
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm border",
            variant === "pink" 
              ? "bg-pink-500/5 text-pink-600 border-pink-500/10" 
              : "bg-black/[0.03] text-foreground/50 border-black/[0.05]"
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}



export function LinkedInLink({ url }: { url?: string | null }) {
  const label = <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-foreground/25">LinkedIn</span>;
  
  if (!url) return (
    <div className="flex flex-col items-center gap-1.5 opacity-30 grayscale">
      {label}
      <div className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-black/5">
        <LinkedinIcon className="size-5" />
      </div>
    </div>
  );
  
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noreferrer" 
      className="group/ln flex flex-col items-center gap-1.5 transition-transform hover:scale-110 active:scale-95"
    >
      {label}
      <div className="flex size-9 items-center justify-center rounded-full border border-sky-500/10 bg-sky-500/5 text-[#0A66C2] transition-colors group-hover/ln:bg-sky-500/10">
        <LinkedinIcon className="size-5" fill="currentColor" />
      </div>
    </a>
  );
}

export function CVLink({ url }: { url?: string | null }) {
  const label = <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-foreground/25">CV</span>;

  if (!url) return (
    <div className="flex flex-col items-center gap-1.5 opacity-20 grayscale">
      {label}
      <div className="relative flex size-9 items-center justify-center rounded-full border border-black/10 bg-black/5">
        <FileText className="size-5" />
      </div>
    </div>
  );

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noreferrer" 
      className="group/cv flex flex-col items-center gap-1.5 transition-transform hover:scale-110 active:scale-95"
    >
      {label}
      <div className="flex size-9 items-center justify-center rounded-full border border-pink-500/10 bg-pink-500/5 text-pink-500 transition-colors group-hover/cv:bg-pink-500/10">
        <div className="relative">
          <FileText className="size-5" />
          <div className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-pink-500 border-2 border-white" />
        </div>
      </div>
    </a>
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

export function Pagination({ 
  total, 
  pageSize, 
  currentPage,
  baseUrl = ""
}: { 
  total: number; 
  pageSize: number; 
  currentPage: number;
  baseUrl?: string;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const getHref = (page: number) => {
    const url = new URL(baseUrl || "/", "http://localhost"); // dummy base for URL parsing
    url.searchParams.set("page", String(page));
    return `${url.pathname}${url.search}`;
  };

  return (
    <div className="mt-8 flex items-center justify-between border-t border-border/50 pt-6">
      <p className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">
        Showing <span className="text-foreground/60">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-foreground/60">{Math.min(currentPage * pageSize, total)}</span> of <span className="text-foreground/60">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={getHref(currentPage - 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/40 text-foreground/60 transition hover:bg-foreground hover:text-white"
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/40 text-foreground/60 opacity-30 pointer-events-none">
            <ChevronLeft className="size-4" />
          </div>
        )}
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <Link
              key={i}
              href={getHref(i + 1)}
              className={cn(
                "inline-flex h-9 min-w-9 items-center justify-center rounded-xl border text-[11px] font-black transition-all",
                currentPage === i + 1
                  ? "border-pink-500 bg-pink-500 text-white shadow-[0_4px_12px_rgba(236,72,153,0.25)]"
                  : "border-white/60 bg-white/40 text-foreground/60 hover:bg-secondary hover:text-foreground"
              )}
            >
              {i + 1}
            </Link>
          ))}
        </div>

        {currentPage < totalPages ? (
          <Link
            href={getHref(currentPage + 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/40 text-foreground/60 transition hover:bg-foreground hover:text-white"
          >
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/40 text-foreground/60 opacity-30 pointer-events-none">
            <ChevronRight className="size-4" />
          </div>
        )}
      </div>
    </div>
  );
}
