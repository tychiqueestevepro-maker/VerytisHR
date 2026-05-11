"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function ApplicationStatusToggle({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const statuses = ["Draft", "Active", "Paused"];

  async function handleStatusChange(status: string) {
    if (status.toLowerCase() === currentStatus.toLowerCase()) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/hr/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status.toLowerCase() }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Error updating application status");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className={cn(
      "flex items-center rounded-lg border border-white/60 bg-white/40 p-1 shadow-sm backdrop-blur-md transition-opacity",
      isUpdating && "opacity-50 pointer-events-none"
    )}>
      {statuses.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => handleStatusChange(s)}
          className={cn(
            "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all rounded-md",
            currentStatus.toLowerCase() === s.toLowerCase()
              ? "bg-foreground text-background shadow-sm"
              : "text-foreground/30 hover:text-foreground/60 hover:bg-black/5"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
