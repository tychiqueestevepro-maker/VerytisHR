"use client";

import { useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";

export function ArchiveApplicationButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [isArchiving, setArchiving] = useState(false);

  async function archiveApplication() {
    setArchiving(true);

    try {
      const response = await fetch(`/api/hr/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });

      if (!response.ok) {
        throw new Error("Unable to archive application");
      }

      router.push("/hr/applications");
      router.refresh();
    } catch {
      setArchiving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={archiveApplication}
      disabled={isArchiving}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 disabled:pointer-events-none disabled:opacity-50"
    >
      {isArchiving ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
      Archive
    </button>
  );
}
