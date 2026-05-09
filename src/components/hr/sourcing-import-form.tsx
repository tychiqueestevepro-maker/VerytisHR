"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, FileSpreadsheet, Link2, Loader2, UploadCloud, type LucideIcon } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { SourcingCsvImportModal } from "./sourcing-csv-import-modal";

function splitLinkedInUrls(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];

  return value
    .split(/[\s,]+/)
    .map((url) => url.trim())
    .filter((url) => url.includes("linkedin.com/"));
}

function MethodLine({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 py-4 last:border-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
        <Icon className="size-4 text-foreground/50" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-foreground/50">{detail}</p>
      </div>
    </div>
  );
}

export function SourcingImportForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImportingUrls, setImportingUrls] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setError(null);
      setMessage(null);
      setSelectedFile(file);
    }
    event.target.value = "";
  }

  async function importLinkedInUrls(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const urls = splitLinkedInUrls(form.get("linkedin_urls"));

    if (!urls.length) {
      setError("Add at least one valid LinkedIn URL.");
      return;
    }

    setImportingUrls(true);

    try {
      const response = await fetch(`/api/hr/sourcing/${applicationId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profiles: urls.map((url) => ({
            linkedin_url: url,
            source: "linkedin",
            import_source: "linkedin_manual",
          })),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to import LinkedIn URLs");

      event.currentTarget.reset();
      setMessage(`${urls.length} LinkedIn profile${urls.length > 1 ? "s" : ""} imported.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to import LinkedIn URLs");
    } finally {
      setImportingUrls(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-8">
        <section className="border-t border-border pt-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">CSV upload</h2>
              <p className="mt-1 text-sm leading-6 text-foreground/50">Apollo, Sales Navigator, spreadsheet or ATS exports.</p>
            </div>
          </div>

          <label className="group flex min-h-52 cursor-pointer flex-col items-center justify-center border-y border-dashed border-border px-6 py-10 text-center transition hover:border-foreground/35 hover:bg-secondary/25">
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="sr-only" onChange={onFileChange} />
            <div className="flex size-11 items-center justify-center rounded-md border border-border bg-background transition group-hover:border-foreground/30">
              <UploadCloud className="size-5 text-foreground/50" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">Select a CSV file</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-foreground/50">
              You will review detected columns and preview the talent pool before anything is saved.
            </p>
          </label>
        </section>

        <section className="border-t border-border pt-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">LinkedIn URLs</h2>
            <p className="mt-1 text-sm leading-6 text-foreground/50">Paste one or multiple profile URLs to add lightweight sourcing profiles.</p>
          </div>

          <form onSubmit={importLinkedInUrls} className="space-y-3">
            <textarea
              name="linkedin_urls"
              className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="https://www.linkedin.com/in/..."
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isImportingUrls}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground/75 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {isImportingUrls ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                Import URLs
              </button>
            </div>
          </form>
        </section>

        {message ? (
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>{message}</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>

      <aside className="border-t border-border pt-5">
        <h2 className="text-sm font-semibold text-foreground">Import quality</h2>
        <div className="mt-2 divide-y divide-border">
          <MethodLine
            icon={FileSpreadsheet}
            title="Column mapping"
            detail="Name, LinkedIn, role, company and location are matched before import."
          />
          <MethodLine
            icon={CheckCircle2}
            title="Visual preview"
            detail="The candidates are shown as they will appear in the sourcing pool."
          />
          <MethodLine
            icon={Link2}
            title="Lean profile data"
            detail="Only mapped sourcing fields are attached to the candidate profile."
          />
        </div>
      </aside>

      {selectedFile ? (
        <SourcingCsvImportModal
          applicationId={applicationId}
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      ) : null}
    </div>
  );
}
