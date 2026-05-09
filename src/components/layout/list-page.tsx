import Link from "next/link";
import { SectionHeading } from "@/components/layout/section-heading";
import { StatusDot, statusLabel } from "@/components/layout/status-dot";
import type { Status } from "@/types/models";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  title: string;
  detail: string;
  status?: string;
  link?: string;
};

export function ListPage({ 
  title, 
  rows, 
  emptyState
}: { 
  title: string; 
  rows: Row[];
  emptyState?: string;
}) {
  const t = useTranslations("Common");
  const finalEmptyState = emptyState ?? t("no_items_found");

  return (
    <div className="pt-2">
      <SectionHeading>{title}</SectionHeading>
      <div className="max-w-4xl divide-y divide-border/50">
        {rows.length > 0 ? (
          rows.map((row) => {
            const content = (
              <div className="flex items-center justify-between gap-8 py-6 transition-all hover:pl-2">
                <div>
                  <p className="text-2xl text-foreground">{row.title}</p>
                  <p className="mt-2 text-sm text-foreground/40">{row.detail}</p>
                </div>
                {row.status ? (
                  <span className="flex items-center gap-2 text-sm text-foreground/55">
                    <StatusDot status={row.status} pulse={row.status === "active" || row.status === "actif" || row.status === "open"} />
                    {statusLabel(row.status)}
                  </span>
                ) : null}
              </div>
            );

            return (
              <div key={row.id}>
                {row.link ? (
                  <Link href={row.link} className="block group">
                    {content}
                  </Link>
                ) : content}
              </div>
            );
          })
        ) : (
          <div className="py-12">
            <p className="text-foreground/40 italic">{finalEmptyState}</p>
          </div>
        )}
      </div>
    </div>
  );
}
