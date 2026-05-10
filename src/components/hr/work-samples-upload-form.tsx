"use client";

import { Fragment, useState, type FormEvent } from "react";
import { ExternalLink, Eye, FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { StatusBadge } from "@/components/hr/application-components";

type WorkSample = {
  id: string | null;
  fileName: string | null;
  sampleType: string | null;
  mimeType: string | null;
  fileSizeBytes: unknown;
  status: string | null;
  parseError: string | null;
  extractedText: string | null;
  createdAt: string | null;
};

function formatSize(value: unknown) {
  const size = typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;
  if (!size || !Number.isFinite(size)) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
}

function displayType(value: string | null) {
  return value?.replaceAll("_", " ") || "real team material";
}

function previewText(sample: WorkSample) {
  if (sample.extractedText) return sample.extractedText;
  if (sample.parseError) return sample.parseError;
  if (sample.status === "uploaded") return "Text extraction has not finished yet.";
  return "No extracted text available. Open the original file to inspect this material.";
}

export function WorkSamplesUploadForm({
  applicationId,
  samples,
}: {
  applicationId: string;
  samples: WorkSample[];
}) {
  const router = useRouter();
  const [isUploading, setUploading] = useState(false);
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadSample(form: FormData) {
    const response = await fetch(`/api/hr/applications/${applicationId}/work-samples`, {
      method: "POST",
      body: form,
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Unable to upload work sample");
    }
  }

  async function deleteSample(sample: WorkSample) {
    if (!sample.id) return;
    if (!confirm(`Delete ${sample.fileName ?? "this material"} from the pipeline material?`)) return;

    setDeletingId(sample.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/hr/applications/${applicationId}/work-samples/${sample.id}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to delete work sample");
      }

      if (expandedSampleId === sample.id) setExpandedSampleId(null);
      setMessage("Material deleted.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete work sample");
    } finally {
      setDeletingId(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setUploading(true);
    setMessage(null);

    const form = new FormData(formElement);
    const sampleType = String(form.get("sample_type") || "real_team_material");
    const content = typeof form.get("content") === "string" ? String(form.get("content")).trim() : "";
    const files = form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);

    try {
      if (!content && !files.length) {
        throw new Error("Add pasted content or at least one document.");
      }

      if (content) {
        const contentForm = new FormData();
        contentForm.set("sampleType", sampleType);
        contentForm.set("content", content);
        await uploadSample(contentForm);
      }

      for (const file of files) {
        const fileForm = new FormData();
        fileForm.set("sampleType", sampleType);
        fileForm.set("file", file);
        await uploadSample(fileForm);
      }

      const uploadedCount = (content ? 1 : 0) + files.length;
      formElement.reset();
      setMessage(`${uploadedCount} item${uploadedCount === 1 ? "" : "s"} uploaded.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload work samples");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4 border-y border-border py-4">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/40">Material type</span>
            <select
              name="sample_type"
              defaultValue="real_team_material"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="real_team_material">Real team material</option>
              <option value="task">Real task</option>
              <option value="client_case">Client case</option>
              <option value="code">Code</option>
              <option value="process">Internal process</option>
              <option value="mission_example">Mission example</option>
              <option value="business_situation">Business situation</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/40">Documents</span>
            <input
              name="files"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.rb,.go,.java,.cs,.sql,.yaml,.yml,.xml,.html,.css,.scss,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/40">Pasted material</span>
          <textarea
            name="content"
            placeholder="Paste a task, code excerpt, internal process, client case, mission example or frequent business situation."
            className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isUploading}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-foreground bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Add material
          </button>
          {message ? <p className="text-sm text-foreground/55">{message}</p> : null}
        </div>
      </form>

      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
              <th className="px-3 py-3 font-medium">Material</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Size</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {samples.map((sample, index) => {
              const rowId = sample.id ?? `${sample.fileName ?? "sample"}-${index}`;
              const isExpanded = expandedSampleId === rowId;
              const originalHref = sample.id ? `/api/hr/applications/${applicationId}/work-samples/${sample.id}?open=1` : null;

              return (
                <Fragment key={rowId}>
                  <tr className="transition hover:bg-secondary/35">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <Plus className="size-3.5 text-foreground/35" />
                        {sample.fileName ?? "Work sample"}
                      </div>
                      <div className="mt-1 text-xs text-foreground/40">{sample.mimeType ?? "-"}</div>
                    </td>
                    <td className="px-3 py-4 text-foreground/65">{displayType(sample.sampleType)}</td>
                    <td className="px-3 py-4 text-foreground/55">{formatSize(sample.fileSizeBytes)}</td>
                    <td className="px-3 py-4">
                      <div className="space-y-1">
                        <StatusBadge>{sample.status ?? "uploaded"}</StatusBadge>
                        {sample.status === "failed" && sample.parseError ? (
                          <p className="max-w-xs text-xs leading-5 text-rose-600">{sample.parseError}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setExpandedSampleId(isExpanded ? null : rowId)}
                          title={isExpanded ? "Hide preview" : "View extracted material"}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground/55 transition hover:bg-secondary hover:text-foreground"
                        >
                          <Eye className="size-4" />
                          <span className="sr-only">{isExpanded ? "Hide preview" : "View extracted material"}</span>
                        </button>
                        {originalHref ? (
                          <a
                            href={originalHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open original file"
                            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground/55 transition hover:bg-secondary hover:text-foreground"
                          >
                            <ExternalLink className="size-4" />
                            <span className="sr-only">Open original file</span>
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => deleteSample(sample)}
                          disabled={!sample.id || deletingId === sample.id}
                          title="Delete material"
                          className="inline-flex size-8 items-center justify-center rounded-md border border-rose-200 bg-background text-rose-500 transition hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-50"
                        >
                          {deletingId === sample.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                          <span className="sr-only">Delete material</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-secondary/20">
                      <td colSpan={5} className="px-3 pb-4">
                        <div className="border-t border-border pt-3">
                          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/40">Preview</p>
                          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs leading-5 text-foreground/70">{previewText(sample)}</pre>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!samples.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-foreground/45">
                  No pipeline material stored yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
