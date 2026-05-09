"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUSES = [
  { id: "all", label: "All Statuses" },
  { id: "Active", label: "Active" },
  { id: "Draft", label: "Draft" },
  { id: "Analyzing", label: "Analyzing" },
  { id: "Completed", label: "Completed" },
];

export function ApplicationsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";

  const setStatus = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-block text-left">
        <select
          value={currentStatus}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 w-[160px] appearance-none rounded-md border border-border bg-secondary/50 px-3 pr-8 text-xs font-medium text-foreground transition hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {STATUSES.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-foreground/40" />
      </div>
    </div>
  );
}
