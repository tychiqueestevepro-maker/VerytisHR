/** HR utility functions for data normalization and score processing */
export type JsonObject = Record<string, unknown>;

export function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

export function clampScore(value: unknown, fallback = 50): number {
  const score = pickNumber(value) ?? fallback;
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

export function scoreLevel(score: number): "low" | "medium" | "high" | "excellent" {
  if (score >= 90) return "excellent";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function splitName(fullName: string | null | undefined) {
  const cleaned = fullName?.trim();
  if (!cleaned) return { firstName: null, lastName: null };

  const parts = cleaned.split(/\s+/);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function cleanNameValue(value: unknown) {
  return pickString(value)
    ?.replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim() ?? null;
}

function isLikelyHandle(value: string) {
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.includes("@") || normalized.includes("/")) return true;
  return /^[a-z][a-z0-9]*[._-][a-z0-9._-]+$/i.test(normalized);
}

function isLikelyNonName(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("linkedin.com") || normalized.includes("http://") || normalized.includes("https://") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function splitDisplayName(value: string | null) {
  const cleaned = cleanNameValue(value);
  if (!cleaned || isLikelyNonName(cleaned)) {
    return { firstName: null, lastName: null, displayName: null };
  }

  const split = splitName(cleaned);
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    displayName: [split.firstName, split.lastName].filter(Boolean).join(" ") || cleaned,
  };
}

export function normalizeImportedCandidateName(input: {
  fullName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}) {
  const fullName = cleanNameValue(input.fullName);
  if (fullName) return splitDisplayName(fullName);

  const firstName = cleanNameValue(input.firstName);
  const lastName = cleanNameValue(input.lastName);

  if (firstName && lastName) {
    const lastParts = lastName.split(/\s+/);
    if (lastParts.length > 1 && (isLikelyHandle(firstName) || lastName.toLowerCase().startsWith(`${firstName.toLowerCase()} `))) {
      return splitDisplayName(lastName);
    }

    const firstParts = firstName.split(/\s+/);
    if (firstParts.length > 1 && firstName.toLowerCase().endsWith(` ${lastName.toLowerCase()}`)) {
      return splitDisplayName(firstName);
    }

    return {
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
    };
  }

  if (firstName && firstName.split(/\s+/).length > 1) return splitDisplayName(firstName);
  if (lastName && lastName.split(/\s+/).length > 1) return splitDisplayName(lastName);

  return {
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" ") || null,
  };
}

export function normalizeEmail(value: unknown): string | null {
  const email = pickString(value);
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : null;
}

export function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return cleaned || "document";
}

export function truncateText(value: string, maxLength = 12000) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export function parseJsonObject(raw: string): JsonObject {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const json = start >= 0 && end >= start ? candidate.slice(start, end + 1) : candidate;
  return asObject(JSON.parse(json));
}

export function formatDate(value: unknown) {
  const date = pickString(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
}

export function relativeTime(value: unknown) {
  const date = pickString(value);
  if (!date) return "No activity";

  const diff = Date.now() - new Date(date).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;

  return formatDate(date);
}
