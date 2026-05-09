"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  MapPin,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type ImportStep = "mapping" | "preview" | "importing" | "complete";
type FieldCategory = "Identity" | "Role" | "Company";
type FieldKey =
  | "full_name"
  | "first_name"
  | "last_name"
  | "linkedin_url"
  | "current_title"
  | "current_company"
  | "location"
  | "seniority"
  | "industry"
  | "company_website"
  | "company_size";

type ExpectedField = {
  key: FieldKey;
  label: string;
  category: FieldCategory;
  priority?: "required" | "recommended";
  synonyms: string[];
};

type CsvColumn = {
  index: number;
  header: string;
  sampleValues: string[];
};

type ParsedImportCsv = {
  headers: string[];
  dataRows: string[][];
};

type CandidatePreview = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  linkedin_url?: string;
  current_title?: string;
  current_company?: string;
  location?: string;
  seniority?: string;
  industry?: string;
  company_website?: string;
  company_size?: string;
  raw_profile?: Record<string, string>;
  name?: string;
  source?: string;
  import_source?: string;
  import_batch?: string;
};

const EXPECTED_FIELDS: ExpectedField[] = [
  { key: "full_name", label: "Full name", category: "Identity", priority: "required", synonyms: ["full name", "fullname", "name", "candidate name", "contact name", "nom complet", "nom"] },
  { key: "first_name", label: "First name", category: "Identity", synonyms: ["first name", "firstname", "given name", "prenom", "prénom"] },
  { key: "last_name", label: "Last name", category: "Identity", synonyms: ["last name", "lastname", "surname", "family name", "nom de famille"] },
  { key: "linkedin_url", label: "LinkedIn URL", category: "Identity", priority: "recommended", synonyms: ["linkedin", "linkedin url", "linkedin profile", "profile url", "person linkedin url", "url linkedin"] },
  { key: "current_title", label: "Current role", category: "Role", synonyms: ["title", "role", "current title", "job title", "position", "poste", "headline"] },
  { key: "current_company", label: "Current company", category: "Role", synonyms: ["company", "company name", "current company", "organization", "organisation", "entreprise", "societe", "société", "account", "account name"] },
  { key: "location", label: "Location", category: "Role", synonyms: ["location", "person location", "city", "country", "ville", "pays", "adresse", "localisation"] },
  { key: "seniority", label: "Seniority", category: "Role", synonyms: ["seniority", "level", "experience", "expérience"] },
  { key: "industry", label: "Industry", category: "Company", synonyms: ["industry", "sector", "industrie", "secteur"] },
  { key: "company_website", label: "Company website", category: "Company", synonyms: ["company website", "website", "site web", "domain"] },
  { key: "company_size", label: "Company size", category: "Company", synonyms: ["company size", "size", "employees", "taille entreprise", "effectif"] },
];

const CATEGORY_LABELS: FieldCategory[] = ["Identity", "Role", "Company"];
const PROFILE_IMAGE_HEADERS = [
  "photo",
  "photo url",
  "picture",
  "picture url",
  "profile image",
  "profile image url",
  "profile photo",
  "profile photo url",
  "profile picture",
  "profile picture url",
  "avatar",
  "avatar url",
  "person photo",
  "person photo url",
];

function cleanCell(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function normalizeHeader(value: string) {
  return cleanCell(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreHeader(header: string, field: ExpectedField) {
  const normalizedHeader = normalizeHeader(header);
  if (!normalizedHeader) return 0;
  if (field.key === "full_name" && ["first name", "firstname", "given name", "last name", "lastname", "surname", "family name"].includes(normalizedHeader)) return 0;
  if (field.key === "linkedin_url" && /\b(company|account|organization|organisation)\b/.test(normalizedHeader)) return 0;
  if (field.key === "current_company" && /\b(linkedin|website|url|description|size|employees|revenue|address|city|state|country|phone)\b/.test(normalizedHeader)) return 0;
  if (field.key === "location" && normalizedHeader.startsWith("company ")) return 0;

  return field.synonyms.reduce((bestScore, synonym) => {
    const normalizedSynonym = normalizeHeader(synonym);
    if (normalizedHeader === normalizedSynonym) return Math.max(bestScore, 100);
    if (field.key === "full_name" && normalizedSynonym === "name") return bestScore;
    if (normalizedHeader.endsWith(` ${normalizedSynonym}`) || normalizedHeader.startsWith(`${normalizedSynonym} `)) return Math.max(bestScore, 88);
    if (normalizedHeader.includes(normalizedSynonym)) return Math.max(bestScore, 76);
    if (normalizedSynonym.includes(normalizedHeader) && normalizedHeader.length > 2) return Math.max(bestScore, 62);
    return bestScore;
  }, 0);
}

function parseRows(text: string, delimiter: string) {
  const parsed = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: "greedy",
  });

  const rows = parsed.data
    .map((row) => row.map(cleanCell))
    .filter((row) => row.some(Boolean));

  return {
    rows: expandEmbeddedRows(rows, delimiter),
    errorCount: parsed.errors.length,
  };
}

function expandEmbeddedRows(rows: string[][], delimiter: string) {
  return rows.map((row) => {
    if (row.length !== 1) return row;

    const cell = row[0];
    const hasEmbeddedDelimiter = delimiter === "\t" ? cell.includes("\t") : cell.includes(delimiter);
    if (!cell || !hasEmbeddedDelimiter) return row;

    const parsed = Papa.parse<string[]>(cell, {
      delimiter,
      skipEmptyLines: false,
    });
    const embeddedRow = parsed.data[0]?.map(cleanCell).filter((value, index, values) => {
      return value || index < values.length - 1;
    });

    return embeddedRow && embeddedRow.length > 1 ? embeddedRow : row;
  });
}

function scoreHeaderRow(row: string[]) {
  const nonEmptyCells = row.filter(Boolean);
  const knownColumnsScore = nonEmptyCells.reduce((total, cell) => {
    const bestFieldScore = EXPECTED_FIELDS.reduce((bestScore, field) => Math.max(bestScore, scoreHeader(cell, field)), 0);
    if (bestFieldScore >= 100) return total + 8;
    if (bestFieldScore >= 76) return total + 5;
    if (bestFieldScore >= 62) return total + 3;
    return total;
  }, 0);

  return nonEmptyCells.length * 3 + knownColumnsScore;
}

function findHeaderRowIndex(rows: string[][]) {
  const rowsToScan = rows.slice(0, 20);
  let bestIndex = 0;
  let bestScore = 0;

  rowsToScan.forEach((row, index) => {
    const score = scoreHeaderRow(row);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function parseImportCsv(text: string): ParsedImportCsv {
  const candidates = [";", ",", "\t", "|"].map((delimiter) => {
    const { rows, errorCount } = parseRows(text, delimiter);
    const headerRowIndex = findHeaderRowIndex(rows);
    const headers = rows[headerRowIndex] ?? [];
    const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some(Boolean));
    const score = scoreHeaderRow(headers) * 3 + headers.filter(Boolean).length * 5 + Math.min(dataRows.length, 25) - errorCount * 20;

    return {
      headers,
      dataRows,
      score,
    };
  });

  const best = candidates.sort((left, right) => right.score - left.score)[0];
  if (!best || best.headers.filter(Boolean).length === 0 || best.dataRows.length === 0) {
    throw new Error("This CSV needs a header row and at least one profile.");
  }

  return {
    headers: best.headers.map((header, index) => cleanCell(header) || `Column ${index + 1}`),
    dataRows: best.dataRows,
  };
}

function buildInitialMapping(headers: string[]) {
  const usedColumns = new Set<number>();

  return EXPECTED_FIELDS.reduce<Record<FieldKey, number | null>>((acc, field) => {
    let bestIndex: number | null = null;
    let bestScore = 0;

    headers.forEach((header, index) => {
      if (usedColumns.has(index)) return;

      const score = scoreHeader(header, field);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const selectedIndex = bestScore >= 62 ? bestIndex : null;
    acc[field.key] = selectedIndex;
    if (selectedIndex !== null) usedColumns.add(selectedIndex);
    return acc;
  }, {} as Record<FieldKey, number | null>);
}

function buildRawProfile(headers: string[], row: string[], mapping: Record<FieldKey, number | null>) {
  const mappedIndexes = new Set(Object.values(mapping).filter((value): value is number => typeof value === "number"));

  return headers.reduce<Record<string, string>>((rawProfile, header, index) => {
    if (!mappedIndexes.has(index)) return rawProfile;

    const fallback = `Column ${index + 1}`;
    const key = cleanCell(header) || fallback;
    const safeKey = rawProfile[key] === undefined ? key : `${key} (${index + 1})`;
    rawProfile[safeKey] = cleanCell(row[index]);
    return rawProfile;
  }, {});
}

function findProfileImageUrl(headers: string[], row: string[]) {
  const index = headers.findIndex((header) => {
    const normalizedHeader = normalizeHeader(header);
    return (
      PROFILE_IMAGE_HEADERS.includes(normalizedHeader) ||
      ((normalizedHeader.includes("photo") ||
        normalizedHeader.includes("picture") ||
        normalizedHeader.includes("image") ||
        normalizedHeader.includes("avatar")) &&
        normalizedHeader.includes("url"))
    );
  });
  if (index === -1) return null;
  const value = cleanCell(row[index]).replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
  return value.startsWith("http://") || value.startsWith("https://") ? value : null;
}

function getCandidateName(profile: Partial<CandidatePreview>) {
  const fullName = cleanCell(profile.full_name);
  if (fullName) return fullName;
  return [profile.first_name, profile.last_name].map(cleanCell).filter(Boolean).join(" ");
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

function isIdentityReady(profile: Partial<CandidatePreview>) {
  return Boolean(getCandidateName(profile) || cleanCell(profile.linkedin_url));
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" }) {
  return (
    <div className="border-l border-border pl-3 first:border-l-0 first:pl-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/35">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold text-foreground",
          tone === "good" && "text-emerald-700",
          tone === "warn" && "text-amber-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StepPill({ active, done, children }: { active: boolean; done?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
        active ? "border-foreground bg-foreground text-background" : done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-background text-foreground/45",
      )}
    >
      {done ? <CheckCircle2 className="size-3.5" /> : null}
      {children}
    </span>
  );
}

function FieldBadge({ priority }: { priority?: ExpectedField["priority"] }) {
  if (!priority) return null;
  const className =
    priority === "required"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

  return <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium", className)}>{priority}</span>;
}

export function SourcingCsvImportModal({
  applicationId,
  file,
  onClose,
}: {
  applicationId: string;
  file: File;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("mapping");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number | null>>(() =>
    EXPECTED_FIELDS.reduce<Record<FieldKey, number | null>>((acc, field) => {
      acc[field.key] = null;
      return acc;
    }, {} as Record<FieldKey, number | null>),
  );
  const [isImporting, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function parseFile() {
      setError(null);
      setStep("mapping");
      setImportedCount(0);

      try {
        const text = await file.text();
        const { headers, dataRows } = parseImportCsv(text);
        const nextMapping = buildInitialMapping(headers);

        if (!cancelled) {
          setRawHeaders(headers);
          setRawData(dataRows);
          setMapping(nextMapping);
        }
      } catch (caught) {
        if (!cancelled) {
          setRawHeaders([]);
          setRawData([]);
          setError(caught instanceof Error ? caught.message : "Unable to parse this CSV file.");
        }
      }
    }

    void parseFile();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const columns = useMemo<CsvColumn[]>(
    () =>
      rawHeaders.map((header, index) => ({
        index,
        header,
        sampleValues: rawData
          .slice(0, 3)
          .map((row) => cleanCell(row[index]))
          .filter(Boolean),
      })),
    [rawData, rawHeaders],
  );

  const mappedFieldCount = useMemo(() => Object.values(mapping).filter((value) => typeof value === "number").length, [mapping]);

  const profiles = useMemo<CandidatePreview[]>(() => {
    return rawData.map((row) => {
      const profile = EXPECTED_FIELDS.reduce<CandidatePreview>((acc, field) => {
        const columnIndex = mapping[field.key];
        if (typeof columnIndex !== "number") return acc;
        const value = cleanCell(row[columnIndex]);
        if (value) acc[field.key] = value;
        return acc;
      }, {});

      if (profile.full_name) profile.name = profile.full_name;
      const profileImageUrl = findProfileImageUrl(rawHeaders, row);
      if (profileImageUrl) profile.profile_image_url = profileImageUrl;

      profile.raw_profile = buildRawProfile(rawHeaders, row, mapping);
      profile.source = "import";
      profile.import_source = "csv";
      profile.import_batch = `${file.name}-${file.lastModified}`;

      return profile;
    });
  }, [file.lastModified, file.name, mapping, rawData, rawHeaders]);

  const importableProfiles = useMemo(() => profiles.filter(isIdentityReady), [profiles]);
  const skippedCount = Math.max(rawData.length - importableProfiles.length, 0);
  const contactableCount = useMemo(() => importableProfiles.filter((profile) => cleanCell(profile.linkedin_url)).length, [importableProfiles]);
  const previewData = importableProfiles.slice(0, 8);
  const hasIdentityMapping = Boolean(mapping.full_name !== null || mapping.first_name !== null || mapping.last_name !== null || mapping.linkedin_url !== null);

  async function handleImport() {
    if (!importableProfiles.length) {
      setError("Map at least one identity column before importing.");
      setStep("mapping");
      return;
    }

    setImporting(true);
    setStep("importing");
    setError(null);

    try {
      const response = await fetch(`/api/hr/sourcing/${applicationId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles: importableProfiles }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Import failed");

      setImportedCount(Array.isArray(body.imported) ? body.imported.length : importableProfiles.length);
      setStep("complete");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "An error occurred during import.");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3 backdrop-blur-sm md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <div className="border-b border-border px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50">
                <FileSpreadsheet className="size-4 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/35">CSV import</p>
                <h2 id="csv-import-title" className="mt-1 truncate text-base font-semibold text-foreground">
                  {file.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/45">
                  <span>{formatBytes(file.size)}</span>
                  <span>{rawHeaders.length} columns</span>
                  <span>{rawData.length} rows</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 md:justify-end">
              <div className="flex flex-wrap gap-2">
                <StepPill active={step === "mapping"} done={step === "preview" || step === "importing" || step === "complete"}>
                  Map
                </StepPill>
                <StepPill active={step === "preview"} done={step === "importing" || step === "complete"}>
                  Preview
                </StepPill>
                <StepPill active={step === "complete"} done={step === "complete"}>
                  Done
                </StepPill>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/45 transition hover:bg-secondary hover:text-foreground"
                aria-label="Close CSV import"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-secondary/20 p-4 lg:border-b-0 lg:border-r md:p-6">
            <div className="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:gap-5">
              <Stat label="Ready" value={importableProfiles.length} tone={importableProfiles.length ? "good" : "warn"} />
              <Stat label="Mapped" value={`${mappedFieldCount}/${EXPECTED_FIELDS.length}`} />
              <Stat label="Contactable" value={contactableCount} tone={contactableCount ? "good" : "neutral"} />
            </div>

            <div className="mt-6 space-y-3 border-t border-border pt-5">
              <div className="flex items-start gap-2 text-sm text-foreground/65">
                <UserRound className="mt-0.5 size-4 text-foreground/35" />
                <span>{hasIdentityMapping ? "Identity columns detected" : "Identity columns missing"}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-foreground/65">
                <MapPin className="mt-0.5 size-4 text-foreground/35" />
                <span>{mapping.location !== null ? "Location mapped" : "Location not mapped"}</span>
              </div>
            </div>

            {skippedCount > 0 ? (
              <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                {skippedCount} row{skippedCount > 1 ? "s" : ""} without name or LinkedIn will be skipped.
              </div>
            ) : null}
          </aside>

          <div className="min-h-0 overflow-y-auto p-4 md:p-6">
            {error ? (
              <div className="mb-5 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            {step === "mapping" ? (
              <div className="space-y-6">
                {CATEGORY_LABELS.map((category) => (
                  <section key={category} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                      <p className="text-xs text-foreground/40">
                        {EXPECTED_FIELDS.filter((field) => field.category === category && mapping[field.key] !== null).length} mapped
                      </p>
                    </div>
                    <div className="divide-y divide-border rounded-md border border-border">
                      {EXPECTED_FIELDS.filter((field) => field.category === category).map((field) => {
                        const mappedIndex = mapping[field.key];
                        const selectedColumn = typeof mappedIndex === "number" ? columns[mappedIndex] : null;
                        return (
                          <div key={field.key} className="grid gap-3 p-3 md:grid-cols-[190px_minmax(0,1fr)_220px] md:items-center">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">{field.label}</span>
                              <FieldBadge priority={field.priority} />
                            </div>
                            <p className="min-h-5 truncate text-xs text-foreground/45">
                              {selectedColumn?.sampleValues.length ? selectedColumn.sampleValues.join(" · ") : "No sample"}
                            </p>
                            <select
                              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-1 focus:ring-ring"
                              value={mapping[field.key] ?? ""}
                              onChange={(event) =>
                                setMapping((current) => ({
                                  ...current,
                                  [field.key]: event.target.value === "" ? null : Number(event.target.value),
                                }))
                              }
                            >
                              <option value="">Skip</option>
                              {columns.map((column) => (
                                <option key={`${column.header}-${column.index}`} value={column.index}>
                                  {column.header}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {step === "preview" ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Talent pool preview</h3>
                    <p className="mt-1 text-xs text-foreground/45">{previewData.length} of {importableProfiles.length} importable profiles shown</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex h-6 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 font-medium text-emerald-700">
                      {importableProfiles.length} ready
                    </span>
                    {skippedCount > 0 ? (
                      <span className="inline-flex h-6 items-center rounded-full border border-amber-200 bg-amber-50 px-2 font-medium text-amber-700">
                        {skippedCount} skipped
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto border-y border-border">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                        <th className="px-3 py-3 font-medium">Candidate</th>
                        <th className="px-3 py-3 font-medium">Current role</th>
                        <th className="px-3 py-3 font-medium">Company</th>
                        <th className="px-3 py-3 font-medium">Location</th>
                        <th className="px-3 py-3 font-medium">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {previewData.map((row, index) => {
                        const name = getCandidateName(row) || "Unnamed profile";
                        const hasLinkedIn = Boolean(cleanCell(row.linkedin_url));
                        return (
                          <tr key={`${name}-${index}`} className="transition hover:bg-secondary/35">
                            <td className="px-3 py-4">
                              <div className="font-medium text-foreground">{name}</div>
                              <div className="mt-1 text-xs text-foreground/45">{row.industry || "No context"}</div>
                            </td>
                            <td className="px-3 py-4 text-foreground/65">{row.current_title || "-"}</td>
                            <td className="px-3 py-4 text-foreground/65">{row.current_company || "-"}</td>
                            <td className="px-3 py-4 text-foreground/65">{row.location || "-"}</td>
                            <td className="px-3 py-4">
                              {hasLinkedIn ? (
                                <span className="inline-flex h-6 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700">
                                  LinkedIn
                                </span>
                              ) : (
                                <span className="inline-flex h-6 items-center rounded-full border border-border bg-secondary px-2 text-xs font-medium text-foreground/60">
                                  Name only
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!previewData.length ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-12 text-center text-sm text-foreground/45">
                            No importable profile with the current mapping.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {step === "importing" ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="size-8 animate-spin text-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-foreground">Importing profiles</p>
                  <p className="mt-1 text-xs text-foreground/45">{importableProfiles.length} rows are being saved</p>
                </div>
              </div>
            ) : null}

            {step === "complete" ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-5 text-center">
                <div className="flex size-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                  <Check className="size-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{importedCount} profiles imported</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-foreground/50">
                    The talent pool has been refreshed with the mapped CSV data.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-background px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <p className="text-xs text-foreground/40">Only mapped CSV values are kept on each candidate profile.</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {step === "mapping" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground/65 transition hover:bg-secondary hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasIdentityMapping) {
                      setError("Map a name or LinkedIn column before preview.");
                      return;
                    }
                    setError(null);
                    setStep("preview");
                  }}
                  disabled={!rawData.length}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50"
                >
                  Preview
                  <ChevronRight className="size-4" />
                </button>
              </>
            ) : null}

            {step === "preview" ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep("mapping")}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground/65 transition hover:bg-secondary hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                  Mapping
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isImporting || !importableProfiles.length}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-700 bg-emerald-700 px-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:pointer-events-none disabled:opacity-50"
                >
                  Import {importableProfiles.length}
                  <Check className="size-4" />
                </button>
              </>
            ) : null}

            {step === "complete" ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-md border border-foreground bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/85"
              >
                Done
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
