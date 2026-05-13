/**
 * Utility functions for LinkedIn scraping that don't require server context
 */

export interface LinkedInExperience {
  title: string | null;
  company: string | null;
  company_linkedin_url?: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_months: number | null;
  is_current: boolean;
  description?: string | null;
}

export interface LinkedInProfileData {
  full_name: string | null;
  headline: string | null;
  location: string | null;
  profile_image_url: string | null;
  experiences: LinkedInExperience[];
  education: any[];
  activity: {
    is_recently_active: boolean;
    topics: string[];
    summary: string | null;
  };
}

/**
 * Normalizes text extracted from DOM/HTML
 */
export function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses a standard cookie string (name=value; name2=value2) into Puppeteer-compatible cookie objects
 */
export function parseCookieString(cookieStr: string, domain: string) {
  return cookieStr.split(";").map(pair => {
    const [name, ...value] = pair.trim().split("=");
    if (!name) return null;
    return {
      name,
      value: value.join("="),
      domain: ".linkedin.com", // Force global domain to avoid sub-domain redirect loops
      path: "/",
      secure: true,
      sameSite: "Lax"
    };
  }).filter(Boolean) as any[];
}

/**
 * Parses date text (e.g. "Jan 2020") into ISO format (2020-01-01)
 */
export function parseDateTextToIso(value: string): string | null {
  const months: Record<string, string> = {
    jan: "01", janv: "01", janvier: "01", january: "01",
    feb: "02", fev: "02", fevr: "02", fevrier: "02", february: "02",
    mar: "03", mars: "03", march: "03",
    apr: "04", avr: "04", avril: "04", april: "04",
    may: "05", mai: "05",
    jun: "06", juin: "06", june: "06",
    jul: "07", juil: "07", juillet: "07", july: "07",
    aug: "08", aout: "08", août: "08", august: "08",
    sep: "09", sept: "09", septembre: "09", september: "09",
    oct: "10", octobre: "10", october: "10",
    nov: "11", novembre: "11", november: "11",
    dec: "12", decembre: "12", décembre: "12", december: "12",
  };

  const clean = cleanText(value).toLowerCase();
  const yearMatch = clean.match(/\d{4}/);
  if (!yearMatch) return null;

  const year = yearMatch[0];
  let month = "01";

  for (const [key, val] of Object.entries(months)) {
    if (clean.includes(key)) {
      month = val;
      break;
    }
  }

  return `${year}-${month}-01`;
}

/**
 * Formats the scraped data to match the sourcing verification schema
 */
export function formatScrapedDataForVerification(profile: LinkedInProfileData) {
  return {
    profile_name: profile.full_name,
    headline: profile.headline,
    location: profile.location,
    profile_image_url: profile.profile_image_url,
    current_company: profile.experiences.find(e => e.is_current)?.company || null,
    verification_data: {
      name: profile.full_name,
      headline: profile.headline,
      location: profile.location,
      profile_image_url: profile.profile_image_url,
      experiences: profile.experiences,
      education: profile.education,
      activity: profile.activity,
      source: "server_side_scraper"
    },
    confidence_score: 100,
    status: "verified"
  };
}
