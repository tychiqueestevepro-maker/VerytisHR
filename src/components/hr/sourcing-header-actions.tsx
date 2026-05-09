"use client";

import { useState } from "react";
import { FileSpreadsheet, Link2, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { SourcingCsvImportModal } from "./sourcing-csv-import-modal";

export function SourcingHeaderActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [isImporting, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
    event.target.value = "";
  }

  async function handleLinkedInImport() {
    const url = prompt("Enter LinkedIn Profile URL:");
    if (!url || !url.includes("linkedin.com")) return;

    setImporting(true);
    try {
      const response = await fetch(`/api/hr/sourcing/${applicationId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          linkedin_url: url,
          source: "linkedin",
          import_source: "linkedin_manual",
        }),
      });
      if (!response.ok) throw new Error("Unable to import LinkedIn profile");
      alert("Profile imported successfully.");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error importing profile");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className={cn(
        "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/85",
        isImporting && "pointer-events-none opacity-50"
      )}>
        <input
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          className="sr-only"
          onChange={onFileChange}
          disabled={isImporting}
        />
        {isImporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
        <span>Import CSV</span>
      </label>

      {selectedFile && (
        <SourcingCsvImportModal 
          applicationId={applicationId}
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}

      <button
        type="button"
        onClick={handleLinkedInImport}
        disabled={isImporting}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <Link2 className="size-4 text-blue-600" />
        <span>LinkedIn</span>
      </button>
    </div>
  );
}
