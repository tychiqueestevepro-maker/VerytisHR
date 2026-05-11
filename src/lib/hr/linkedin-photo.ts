
import * as cheerio from "cheerio";
import { pickString } from "./utils";

/**
 * Fetches the public profile photo URL from LinkedIn metadata.
 * This works for most public profiles without authentication.
 */
export async function fetchLinkedInPublicPhoto(linkedinUrl: string): Promise<string | null> {
  try {
    let url = linkedinUrl.trim();
    if (!url.startsWith("http")) {
      url = `https://${url.replace(/^\/+/, "")}`;
      if (!url.includes("linkedin.com")) {
        url = `https://www.linkedin.com/in/${linkedinUrl.trim().replace(/^\/+/, "")}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const photoUrl = pickString(
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $(".pv-top-card-profile-picture__image").attr("src"),
    );

    // LinkedIn default placeholders should be ignored if possible
    if (photoUrl?.includes("ghost_person") || photoUrl?.includes("default_profile")) {
      return null;
    }

    return photoUrl;
  } catch (error) {
    console.error("[LinkedInPhoto] Fetch failed:", error);
    return null;
  }
}
