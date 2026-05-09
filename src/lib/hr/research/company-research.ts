import { completeHrJson, HR_FAST_MODEL } from "../openai";
import { asObject, pickString, truncateText } from "@/lib/hr/utils";

export type CompanyResearchInput = {
  companyName: string;
  currentRole?: string;
  location?: string;
  missionContext?: string;
  companyId: string;
};

export type CompanySignal = {
  type: string;
  label: string;
  description: string;
  impact_on_opportunity: "high" | "medium" | "low" | "neutral";
  source_title: string;
  source_url: string;
  source_relevance: "matched" | "uncertain" | "rejected";
  reason: string;
};

export type CompanyResearchOutput = {
  company_name: string;
  summary: string;
  recent_signals: CompanySignal[];
  market_context: string;
  organizational_structure: string;
  source_urls: string[];
  excluded_sources?: { title: string; url: string; reason: string; source_relevance?: CompanySignal["source_relevance"] }[];
};

type TavilySearchResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
};

type TavilySearchResponse = {
  answer?: unknown;
  results?: unknown;
};

function sourceRelevance(value: unknown): CompanySignal["source_relevance"] {
  const normalized = pickString(value)?.toLowerCase();
  if (normalized === "matched" || normalized === "uncertain" || normalized === "rejected") return normalized;
  return "uncertain";
}

function opportunityImpact(value: unknown): CompanySignal["impact_on_opportunity"] {
  const normalized = pickString(value)?.toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low" || normalized === "neutral") return normalized;
  return "neutral";
}

export async function researchCompany(input: CompanyResearchInput): Promise<CompanyResearchOutput> {
  const companyName = input.companyName.trim();
  if (!companyName) {
    throw new Error("Company name is required for company research");
  }

  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const query = [
    `"${companyName}"`,
    input.currentRole,
    "recent news funding layoffs restructuring hiring growth acquisition product launch",
  ]
    .filter(Boolean)
    .join(" ");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: truncateText(query, 500),
      topic: "general",
      search_depth: "advanced",
      max_results: 8,
      include_answer: true,
      include_raw_content: false,
      time_range: "year",
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = asObject(await response.json().catch(() => ({}))) as TavilySearchResponse;
  const results = Array.isArray(data.results)
    ? data.results.map((item) => asObject(item) as TavilySearchResult)
    : [];

  // AI Summarization (gpt-5.4-nano / FAST)
  const ai = await completeHrJson({
    companyId: input.companyId,
    model: HR_FAST_MODEL,
    system: `
      You provide a concise and factual executive summary of a company based on search results. 
      Focus on their core business, recent activity, and growth or risk signals for recruiters.
      
      Entity Matching Rules:
      - You MUST verify each search result refers to the correct company: "${companyName}".
      - If a result is about a different company (even with a similar name), mark it as "rejected".
      - If you are unsure if it's the same entity, mark it as "uncertain".
      - Only "matched" sources should be used for positive growth/opportunity signals.
      
      Rules for signals:
      - Each signal must have a type (funding, layoffs, hiring, growth, etc.)
      - Each signal must include a source_title and source_url from the provided results.
      - source_relevance: "matched" | "uncertain" | "rejected"
      - reason: Brief explanation of why the source was matched or rejected (e.g., "Refers to ${companyName}", "Refers to a different company: New American Funding").
      - Each signal must have an impact_on_opportunity: high, medium, low, or neutral.
    `.trim(),
    user: `
Search Results:
${JSON.stringify(results.map(r => ({ title: r.title, url: r.url, content: r.content })), null, 2)}

Direct Answer:
${pickString(data.answer) || "No direct answer found."}

Provide a JSON object matching this schema:
{
  "summary": "2-3 sentences max on business model and size. If no reliable signals are found for this specific company, say so.",
  "market_context": "market positioning and competition",
  "organizational_structure": "concise description of hierarchy",
  "recent_signals": [
    {
      "type": "layoffs",
      "label": "Recent restructuring",
      "description": "Company announced 10% layoffs in sales department.",
      "impact_on_opportunity": "high",
      "source_title": "Source Article Title",
      "source_url": "https://example.com/news",
      "source_relevance": "matched",
      "reason": "Explicitly mentions ${companyName}"
    }
  ]
}
`.trim(),
  });

  const aiData = asObject(ai?.data);
  const recentSignals = Array.isArray(aiData.recent_signals) ? aiData.recent_signals.map(asObject) : [];

  const reviewedSignals = recentSignals
    .map(s => ({
      type: pickString(s.type) ?? "news",
      label: pickString(s.label) ?? "Recent update",
      description: pickString(s.description) ?? "Recent company activity found.",
      impact_on_opportunity: opportunityImpact(s.impact_on_opportunity),
      source_title: pickString(s.source_title) ?? "Web result",
      source_url: pickString(s.source_url) ?? "",
      source_relevance: sourceRelevance(s.source_relevance),
      reason: pickString(s.reason) ?? "Unverified source",
    }));

  const excluded = reviewedSignals
    .filter(s => s.source_relevance !== "matched")
    .map(s => ({ title: s.source_title, url: s.source_url, reason: s.reason, source_relevance: s.source_relevance }));

  const matchedSignals = reviewedSignals.filter(s => s.source_relevance === "matched");

  return {
    company_name: companyName,
    summary: matchedSignals.length > 0
      ? pickString(aiData.summary) || pickString(data.answer) || ""
      : `No reliable recent company signal found for ${companyName}.`,
    recent_signals: matchedSignals,
    market_context: matchedSignals.length > 0 ? pickString(aiData.market_context) || pickString(data.answer) || "" : "",
    organizational_structure: matchedSignals.length > 0
      ? pickString(aiData.organizational_structure) || "Structure details not found in current search depth."
      : "Structure details not confirmed by matched sources.",
    source_urls: results.map((result) => pickString(result.url)).filter((url): url is string => Boolean(url)),
    excluded_sources: excluded,
  };
}
