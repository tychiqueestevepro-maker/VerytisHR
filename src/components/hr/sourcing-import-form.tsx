"use client";

import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, UploadCloud, type LucideIcon } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { SourcingCsvImportModal } from "./sourcing-csv-import-modal";

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
    <div className="flex items-start gap-3 border-b border-black/[0.03] py-5 last:border-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-pink-100 bg-pink-50/50 text-pink-500 shadow-sm">
        <Icon className="size-4.5" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-foreground/80">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-foreground/45">{detail}</p>
      </div>
    </div>
  );
}

export function SourcingImportForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        <section className="rounded-2xl border border-white/60 bg-white/30 p-1 backdrop-blur-md shadow-sm">
          <div className="group relative overflow-hidden rounded-xl border border-dashed border-black/10 bg-black/[0.01] transition-all hover:border-pink-500/30 hover:bg-pink-500/[0.02]">
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="sr-only" id="csv-upload" onChange={onFileChange} />
            <label htmlFor="csv-upload" className="flex min-h-[320px] cursor-pointer flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white bg-white text-pink-500 shadow-lg transition-transform group-hover:scale-110 group-active:scale-95">
                <UploadCloud className="size-7" />
              </div>
              <h2 className="mt-6 text-lg font-bold text-foreground">Import candidates from CSV</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-foreground/45">
                Drop your Apollo, Sales Navigator or ATS export here. We'll help you map the columns before importing.
              </p>
              <div className="mt-8 inline-flex h-9 items-center rounded-full bg-pink-500 px-6 text-[13px] font-bold text-white shadow-md transition hover:bg-pink-600">
                Select file
              </div>
            </label>
          </div>
        </section>

        {message && (
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>{message}</p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}
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
            icon={FileSpreadsheet}
            title="Lean profile data"
            detail="Only mapped sourcing fields are attached to the candidate profile."
          />
        </div>
      </aside>

      {selectedFile && (
        <SourcingCsvImportModal
          applicationId={applicationId}
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
