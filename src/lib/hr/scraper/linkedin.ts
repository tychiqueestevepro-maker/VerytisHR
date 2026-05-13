"use server";

import { pickString, asObject } from "../utils";
import { createSupabaseServiceClient } from "../../supabase/server";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as ProxyChain from "proxy-chain";
import { 
  cleanText, 
  parseCookieString, 
  parseDateTextToIso, 
  formatScrapedDataForVerification,
  type LinkedInExperience,
  type LinkedInProfileData
} from "./scraper-utils";

// Fetches a single proxy from Smartproxy's extraction API.
// Response format (TXT): "host:port" or "host:port:user:pass"
async function fetchProxyFromApiUrl(apiUrl: string): Promise<{ server: string; username?: string; password?: string } | null> {
  try {
    const res = await fetch(apiUrl);
    const text = (await res.text()).trim();

    // Detect JSON error response (e.g. {"code":202,"msg":"..."})
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        const json = JSON.parse(text);
        console.warn(`[Scraper] Smartproxy API error: code=${json.code} msg=${json.msg ?? json.message ?? text}`);
      } catch { console.warn(`[Scraper] Smartproxy API returned unexpected JSON: ${text.substring(0, 200)}`); }
      return null;
    }

    const line = text.split(/[\n\r]/)[0].trim();
    if (!line) return null;
    const parts = line.split(":");
    // host:port:user:pass
    if (parts.length === 4) {
      let rawUsername = parts[2].replace(/\s+/g, '');
      
      return { 
        server: `${parts[0].trim()}:${parts[1].trim()}`, 
        username: rawUsername, 

        password: parts[3].replace(/\s+/g, '') 
      };
    }

    // host:port
    if (parts.length >= 2) return { server: `${parts[0].trim()}:${parts[1].trim()}` };
    return null;

  } catch (e: any) {
    console.warn(`[Scraper] fetchProxyFromApiUrl failed: ${e.message}`);
    return null;
  }
}

/**
 * Résout le chemin exécutable de Chrome selon l'environnement.
 * 1. Variable d'env PUPPETEER_EXECUTABLE_PATH (si elle existe réellement)
 * 2. Chemin bundlé par Puppeteer via executablePath()
 * 3. Chemins Linux courants en fallback
 */
async function getChromePath(): Promise<string | undefined> {
  const { existsSync } = await import("fs");

  // 1. Variable d'env - mais vérifier que le binaire existe réellement
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && existsSync(envPath)) {
    console.log(`[Chrome] Using env PUPPETEER_EXECUTABLE_PATH: ${envPath}`);
    return envPath;
  }
  if (envPath) {
    console.warn(`[Chrome] PUPPETEER_EXECUTABLE_PATH=${envPath} set but binary NOT found, skipping`);
  }

  // 2. Chemin résolu par Puppeteer lui-même (cache local)
  try {
    const { executablePath } = (await import("puppeteer")) as any;
    const resolved = typeof executablePath === "function" ? executablePath() : executablePath;
    if (resolved && existsSync(resolved)) {
      console.log(`[Chrome] Using puppeteer executablePath: ${resolved}`);
      return resolved;
    }
    if (resolved) {
      console.warn(`[Chrome] puppeteer executablePath=${resolved} but binary NOT found`);
    }
  } catch (e) {
    console.warn(`[Chrome] Failed to resolve puppeteer executablePath:`, e);
  }

  // 3. Fallback Linux paths
  const fallbacks = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  for (const p of fallbacks) {
    if (existsSync(p)) {
      console.log(`[Chrome] Using fallback path: ${p}`);
      return p;
    }
  }

  console.warn(`[Chrome] No Chrome binary found anywhere - puppeteer.launch() will use its own default`);
  return undefined;
}

/**
 * LinkedIn Scraper Service
 * 
 * Ported logic from VerytisAGNT LinkedIn Extension.
 * This service can run server-side using a headless browser (Puppeteer/Playwright)
 * or by processing HTML snapshots.
 */

/**
 * Main scraping function using Puppeteer
 * Optimized for environments like Railway or Docker
 */
export async function scrapeLinkedInProfile(
  url: string, 
  sessionOrCookie?: any | string | null,
  proxyConfig?: any,
  accountId?: string
): Promise<LinkedInProfileData | null> {
  if (!url) return null;

  // Normalisation de l'URL
  let targetUrl = url.trim();
  if (!targetUrl.startsWith("http")) {
    if (targetUrl.startsWith("linkedin.com")) {
      targetUrl = "https://www." + targetUrl;
    } else if (targetUrl.startsWith("www.linkedin.com")) {
      targetUrl = "https://" + targetUrl;
    } else {
      targetUrl = "https://www.linkedin.com/" + targetUrl.replace(/^\/+/, "");
    }
  }

  let browser = null;
  let scrapeAnonProxy: string | null = null;
  try {
    const puppeteer = (await import("puppeteer")) as any;
    const chromePath = await getChromePath();
    console.log(`[Scraper] Launching browser for: ${targetUrl} (chrome: ${chromePath ?? "auto"})`);

    const launchOptions: any = {
      headless: true,
      executablePath: chromePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1280,800",
        "--lang=fr-FR,fr",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--disable-infobars",
        "--disable-extensions",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list"
      ],
    };

    let anonymizedProxy: string | null = null;

    if (proxyConfig?.server && proxyConfig?.username && proxyConfig?.password) {
      const rawServer = String(proxyConfig.server).replace(/^https?:\/\//, "");
      const rawUsername = proxyConfig.username.replace(/\s+/g, "");
      const rawPassword = proxyConfig.password.replace(/\s+/g, "");
      
      const proxyUrl = `http://${rawUsername}:${rawPassword}@${rawServer.trim()}`;
      console.log(`[Scraper] Anonymizing proxy via proxy-chain...`);
      
      try {
        anonymizedProxy = await ProxyChain.anonymizeProxy(proxyUrl);
        console.log(`[Scraper] Proxy anonymized: ${anonymizedProxy}`);
        launchOptions.args.push(`--proxy-server=${anonymizedProxy}`);
      } catch (err) {
        console.error(`[Scraper] Failed to anonymize proxy, falling back to direct: ${err}`);
      }
    }


    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Auth is now handled by proxy-chain if available
    if (!anonymizedProxy && proxyConfig?.server && (launchOptions as any)._resolvedUsername) {
      console.log(`[Scraper] Fallback: Setting legacy proxy auth...`);
      await page.authenticate({ 
        username: (launchOptions as any)._resolvedUsername, 
        password: (launchOptions as any)._resolvedPassword 
      });
    }




    // --- Advanced Anti-Detect Fingerprinting ---
    await page.evaluateOnNewDocument(() => {
      // 1. Hide Webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // 2. Mock Chrome runtime
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };

      // 3. Mock hardware signals
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 1 });

      // 4. Mock Plugins (LinkedIn looks for these)
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
          { name: 'Google Docs Offline', filename: 'mhjfbmdcljmapbaitedoijbeohimnoih' }
        ]
      });

      // 5. Mock Permissions
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as PermissionStatus) :
          originalQuery(parameters)
      );
    });

    // Use a very common, high-trust Desktop User Agent
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1440, height: 900 });

    
    let liAtFound = false;

    if (sessionOrCookie) {
      console.log(`[Scraper] Injecting LinkedIn session data...`);
      
      let cookies: any[] = [];
      if (Array.isArray(sessionOrCookie)) {
        // Raw cookies array passed directly
        cookies = sessionOrCookie;
      } else if (typeof sessionOrCookie === "object" && sessionOrCookie.cookies) {
        // New session format from DB/Polling
        cookies = sessionOrCookie.cookies;
        
        // Inject LocalStorage if available
        if (sessionOrCookie.localStorage) {
          try {
            const ls = typeof sessionOrCookie.localStorage === "string" 
              ? JSON.parse(sessionOrCookie.localStorage) 
              : sessionOrCookie.localStorage;
            await page.evaluate((data: any) => {
              for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, value as string);
              }
            }, ls);
          } catch (e) {
            console.warn("[Scraper] Failed to inject localStorage", e);
          }
        }
      } else {
        // Legacy cookie string format from extension or company metadata
        cookies = parseCookieString(String(sessionOrCookie), ".linkedin.com");
      }

      console.log(`[Scraper] Injecting ${cookies.length} LinkedIn cookies...`);
      await page.setCookie(...cookies);

      // Petite pause pour laisser Chrome synchroniser les cookies
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Headers ultra-réalistes
      await page.setExtraHTTPHeaders({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      });

      // 2. Navigation vers le profil cible
      console.log(`[Scraper] Navigating to profile: ${targetUrl}`);
      let success = false;
      let retries = 0;
      const maxRetries = 2;

      while (!success && retries < maxRetries) {
        try {
          // Un petit délai aléatoire avant d'y aller
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
          
          await page.goto(targetUrl, {
            waitUntil: "domcontentloaded", // Plus rapide et moins suspect que networkidle2
            timeout: 60000,
          });
          
          // Simuler un petit scroll ou mouvement pour paraître humain
          await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
          await new Promise(resolve => setTimeout(resolve, 2000));

          const finalUrl = page.url();
          if (finalUrl.includes("linkedin.com/login") || finalUrl.includes("checkpoint/challenges")) {
             console.error(`[Scraper] Security checkpoint detected at ${finalUrl}`);
             throw new Error("LinkedIn a détecté une activité inhabituelle (CAPTCHA). Veuillez rafraîchir votre session sur LinkedIn et attendre quelques minutes.");
          }
          
          success = true;
        } catch (error) {
          retries++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Scraper] Attempt ${retries} failed: ${errorMessage}`);
          
          if (retries >= maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, 5000 * retries));
        }
      }
    } else {
      console.warn("[Scraper] No LinkedIn session provided. Scraping might be limited or blocked.");
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    }
    
    // Wait for the main content to load
    await page.waitForSelector("main", { timeout: 10000 });

    // Get the HTML content
    const html = await page.content();
    
    // Parse the HTML
    return await parseLinkedInProfile(html);

  } catch (error) {
    console.error("[Scraper] Puppeteer execution failed:", error);
    return null;
  } finally {
    if (browser) await browser.close();
    if (scrapeAnonProxy) {
      const proxyChain = (await import("proxy-chain")) as any;
      await proxyChain.closeAnonymizedProxy(scrapeAnonProxy, true).catch(() => {});
    }
  }
}

/**
 * Ported parsing logic from extension
 */
export async function parseLinkedInProfile(html: string): Promise<LinkedInProfileData | null> {
  try {
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    
    // Extraction logic (ported from extension content.js)
    const fullName = cleanText($(".pv-text-details__left-panel h1, main h1, .text-heading-xlarge").first().text());
    const headline = cleanText($(".pv-text-details__left-panel .text-body-medium, .text-body-medium.break-words").first().text());
    const location = cleanText($(".pv-text-details__left-panel .text-body-small.inline, .pv-text-details__left-panel .text-body-small").first().text());
    const profileImageUrl = $(".pv-top-card-profile-picture__image, .profile-photo-edit__preview, .pv-top-card__photo img, .identity-block__image, .pv-top-card-section__photo").first().attr("src") || null;

    const experiences: LinkedInExperience[] = [];
    // Target both legacy and new LinkedIn DOM structures
    $("section#experience-section li, .pvs-list__paged-list-item, .experience-item").each((_, el) => {
      const item = $(el);
      const title = cleanText(item.find("h3, .t-bold span, .display-flex.align-items-center.mr1.t-bold span").first().text());
      const company = cleanText(item.find(".t-normal span, .pv-entity__secondary-title, .t-14.t-normal span").first().text()).split("·")[0].trim();
      const dateText = cleanText(item.find(".pv-entity__date-range span:last-child, .t-14.t-normal.t-black--light span").first().text());
      
      if (!title && !company) return;

      const isCurrent = /present|actuel|aujourd|current/i.test(dateText);
      const parts = dateText.split(/[-–-]| a | to /i);
      
      // Note: This logic assumes these functions are globally available via imports now
      // This part would ideally be updated to use async calls if the imports are async
      // But preserving sync calls per instructions:
      experiences.push({
        title: title as any,
        company: company as any,
        start_date: parseDateTextToIso(parts[0] || "") as any,
        end_date: isCurrent ? null : parseDateTextToIso(parts[1] || "") as any,
        duration_months: null,
        is_current: isCurrent,
      });
    });

    return {
      full_name: fullName || null,
      headline: headline || null,
      location: location || null,
      profile_image_url: profileImageUrl,
      experiences: experiences.slice(0, 10),
      education: [],
      activity: {
        is_recently_active: false,
        topics: [],
        summary: null
      }
    };
  } catch (error) {
    console.error("[Scraper] Parsing failed:", error);
    return null;
  }
}

/**
 * Fetches the identity of the connected LinkedIn account using the provided cookie.
 */
export async function getLinkedInSessionIdentity(cookie: string): Promise<{ name: string | null; image: string | null }> {
  let browser = null;
  let anonymizedProxy: string | null = null;
  try {
    const chromePath = await getChromePath();
    const launchOptions: any = {
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--ignore-certificate-errors"]
    };

    // Note: In a real production scenario, we should also use a proxy for identity checks
    // to match the geographical location of the session.

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    // Injection de TOUS les cookies pour l'identité
    const cookies = parseCookieString(cookie, ".linkedin.com");
    await page.setCookie(...cookies);

    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1280, height: 800 });

    // Go to feed to see the identity card
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "networkidle2", timeout: 30000 });
    
    const identity = await page.evaluate(() => {
      const nameEl = document.querySelector(".feed-identity-module__name, .identity-block__name, [data-control-name='identity_profile_photo'] + div");
      const imgEl = document.querySelector(".feed-identity-module__member-photo, .identity-block__image, .feed-identity-module__image") as HTMLImageElement;
      
      return {
        name: nameEl?.textContent?.trim() || null,
        image: imgEl?.src || null
      };
    });

    return identity;
  } catch (error) {
    console.error("[Scraper] Identity fetch failed:", error);
    return { name: null, image: null };
  } finally {
    if (browser) {
      await browser.close();
      if (anonymizedProxy) {
        await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true);
        console.log(`[Scraper] Local proxy tunnel closed.`);
      }
    }
  }
}
