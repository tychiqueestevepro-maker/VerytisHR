import { pickString, asObject } from "../utils";
import { encryptLinkedInCredential, decryptLinkedInCredential } from "../crypto";
import { createSupabaseServiceClient } from "../../supabase/server";

/**
 * Résout le chemin exécutable de Chrome selon l'environnement.
 * 1. Variable d'env PUPPETEER_EXECUTABLE_PATH (si elle existe réellement)
 * 2. Chemin bundlé par Puppeteer via executablePath()
 * 3. Chemins Linux courants en fallback
 */
async function getChromePath(): Promise<string | undefined> {
  const { existsSync } = await import("fs");

  // 1. Variable d'env — mais vérifier que le binaire existe réellement
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

  console.warn(`[Chrome] No Chrome binary found anywhere — puppeteer.launch() will use its own default`);
  return undefined;
}

/**
 * LinkedIn Scraper Service
 * 
 * Ported logic from VerytisAGNT LinkedIn Extension.
 * This service can run server-side using a headless browser (Puppeteer/Playwright)
 * or by processing HTML snapshots.
 */

export interface LinkedInProfileData {
  full_name: string | null;
  headline: string | null;
  location: string | null;
  profile_image_url: string | null;
  experiences: LinkedInExperience[];
  education: string[];
  activity: {
    is_recently_active: boolean;
    topics: string[];
    summary: string | null;
  };
}

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
 * Port of date parsing logic from extension
 */
export function parseDateTextToIso(value: string): string | null {
  const months: Record<string, string> = {
    jan: "01", janv: "01", janvier: "01", january: "01",
    feb: "02", fev: "02", fevr: "02", fevrier: "02", february: "02",
    mar: "03", mars: "03", march: "03",
    apr: "04", avr: "04", avril: "04", april: "04",
    mai: "05", may: "05",
    jun: "06", juin: "06", june: "06",
    jul: "07", juil: "07", juillet: "07", july: "07",
    aug: "08", aout: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12", decembre: "12"
  };

  const normalized = value.toLowerCase();
  const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;

  const year = yearMatch[0];
  const monthKey = Object.keys(months)
    .sort((a, b) => b.length - a.length)
    .find(key => normalized.includes(key));
  
  const month = monthKey ? months[monthKey] : "01";
  return `${year}-${month}`;
}

/**
 * Main scraping function using Puppeteer
 * Optimized for environments like Railway or Docker
 */
export async function scrapeLinkedInProfile(
  url: string, 
  sessionOrCookie?: any | string | null,
  proxyConfig?: any
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
        "--lang=fr-FR,fr"
      ],
    };

    if (proxyConfig && proxyConfig.server) {
      launchOptions.args.push(`--proxy-server=${proxyConfig.server}`);
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    if (proxyConfig && proxyConfig.username && proxyConfig.password) {
      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password,
      });
    }

    // Stealth masks
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      (navigator as any).chrome = { runtime: {} };
      (navigator as any).permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: "denied" })
          : (navigator as any).permissions.query(parameters);
    });

    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1");
    
    let liAtFound = false;

    if (sessionOrCookie) {
      console.log(`[Scraper] Injecting LinkedIn session data...`);
      
      if (typeof sessionOrCookie === "object" && sessionOrCookie.cookies) {
        // New session format
        await page.setCookie(...sessionOrCookie.cookies);
        liAtFound = sessionOrCookie.cookies.some((c: any) => c.name === "li_at");
        
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
        // Legacy cookie string format
        const cookieValue = String(sessionOrCookie).trim();
        if (cookieValue.includes(";")) {
          const cookies = cookieValue.split(";").map(c => c.trim());
          for (const c of cookies) {
            const [name, ...valueParts] = c.split("=");
            const value = valueParts.join("=");
            if (name && value) {
              await page.setCookie({
                name,
                value,
                domain: ".linkedin.com",
                path: "/",
                secure: true
              });
              if (name === "li_at") liAtFound = true;
            }
          }
        } else {
          await page.setCookie({
            name: "li_at",
            value: cookieValue.startsWith("li_at=") ? cookieValue.split("=")[1] : cookieValue,
            domain: ".linkedin.com",
            path: "/",
            secure: true,
          });
          liAtFound = true;
        }
      }

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

      console.log(`[Scraper] Navigating DIRECTLY to profile: ${targetUrl}`);
      
      let success = false;
      let retries = 0;
      const maxRetries = 3;

      while (!success && retries < maxRetries) {
        try {
          await page.goto(targetUrl, {
            waitUntil: "networkidle2",
            timeout: 60000,
          });
          success = true;
        } catch (e: any) {
          if (e.message.includes("ERR_TOO_MANY_REDIRECTS") && retries < maxRetries - 1) {
            retries++;
            const delay = 2000 + Math.random() * 3000;
            console.warn(`[Scraper] Redirect loop detected. Retry ${retries}/${maxRetries} in ${Math.round(delay)}ms...`);
            await new Promise(r => setTimeout(r, delay));
            const client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            // Re-inject cookies (Simplified for brevity)
            if (typeof sessionOrCookie === "object" && sessionOrCookie.cookies) {
              await page.setCookie(...sessionOrCookie.cookies);
            }
          } else {
            throw e;
          }
        }
      }
    } else {
      console.warn("[Scraper] No LinkedIn session provided. Scraping might be limited or blocked.");
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
      await page.setViewport({ width: 1280, height: 800 });
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
    if (browser) {
      await browser.close();
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
      const parts = dateText.split(/[-–—]| a | to /i);
      
      experiences.push({
        title: title || null,
        company: company || null,
        start_date: parseDateTextToIso(parts[0] || ""),
        end_date: isCurrent ? null : parseDateTextToIso(parts[1] || ""),
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

/**
 * Fetches the identity of the connected LinkedIn account using the provided cookie.
 */
export async function getLinkedInSessionIdentity(cookie: string): Promise<{ name: string | null; image: string | null }> {
  let browser = null;
  try {
    const puppeteer = (await import("puppeteer")) as any;
    const chromePath = await getChromePath();
    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    await page.setCookie({
      name: "li_at",
      value: cookie,
      domain: ".www.linkedin.com"
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
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
    }
  }
}

/**
 * Starts a LinkedIn login session and handles 2FA if necessary.
 * This is a long-running process that might wait for user input (2FA).
 */
export async function runLinkedInLoginFlow(accountId: string) {
  const supabase = createSupabaseServiceClient();
  
  // 1. Fetch account details
  const { data: account, error: fetchError } = await supabase
    .from("linkedin_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (fetchError || !account) {
    console.error("[Scraper] Account not found:", accountId);
    return { success: false, error: "Account not found" };
  }

  const password = decryptLinkedInCredential(account.password);
  const email = account.email; // We should probably encrypt email too as per plan
  const proxy = account.proxy_config as any;

  let browser = null;
  try {
    const puppeteer = (await import("puppeteer")) as any;
    const chromePath = await getChromePath();
    console.log(`[Scraper] runLinkedInLoginFlow — chrome: ${chromePath ?? "auto"}, proxy: ${proxy?.server ?? "none"}`);
    
    const launchOptions: any = {
      headless: true,
      executablePath: chromePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1280,800",
      ],
    };

    if (proxy && proxy.server) {
      launchOptions.args.push(`--proxy-server=${proxy.server}`);
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (proxy && proxy.username && proxy.password) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password,
      });
    }

    // User-Agent moderne
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    
    // Injection furtive avancée (Canvas noise + WebGL + Audio)
    await page.evaluateOnNewDocument(() => {
      // Masquer Puppeteer
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Ajouter du bruit au Canvas pour casser le fingerprinting
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
        const result = originalGetImageData.apply(this, [x, y, w, h] as any);
        for (let i = 0; i < result.data.length; i += 4) {
          result.data[i] = result.data[i] + (Math.random() > 0.5 ? 1 : -1);
        }
        return result;
      };

      // Simuler les plugins et langues
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en'] });
    });

    // Headers minimalistes mais propres
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9',
    });

    // --- Proxy Verification ---
    if (proxy && proxy.is_managed) {
      console.log(`[Scraper] Proxy setup...`);
      try {
        await page.goto("http://api.ipify.org?format=json", { waitUntil: "networkidle2", timeout: 15000 });
        const text = await page.evaluate(() => document.body.innerText);
        const ipInfo = JSON.parse(text);
        console.log(`[Scraper] Proxy IP: ${ipInfo.ip}`);
        await supabase.from("linkedin_accounts").update({ last_detected_ip: ipInfo.ip }).eq("id", accountId);
      } catch (err: any) {
        console.warn("[Scraper] Proxy check skipped:", err.message);
      }
    }
    
    console.log(`[Scraper] Human navigation: Landing on home page...`);
    // Étape 1 : Aller sur la Home comme un humain
    await page.goto("https://www.linkedin.com/", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

    console.log(`[Scraper] Navigating to login...`);
    // Étape 2 : Aller sur la page de login via le lien
    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });

    const userSelector = "#username, input[name='session_key']";
    const passSelector = "#password, input[name='session_password']";
    
    try {
      await page.waitForSelector(userSelector, { timeout: 15000 });
    } catch (e) {
      const title = await page.title();
      const body = await page.evaluate(() => document.body.innerText.substring(0, 300));
      console.error(`[Scraper] Detection. Title: "${title}". Body: "${body}..."`);
      throw new Error(`LinkedIn bloque l'accès (Title: ${title}). Testez dans 10 min, LinkedIn a temporairement banni cette IP.`);
    }

    await new Promise(r => setTimeout(r, 2000));
    await page.type(userSelector, email, { delay: 180 });
    await page.type(passSelector, password, { delay: 200 });
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});

    // Check for 2FA
    const is2FA = await page.evaluate(() => {
      return !!(document.querySelector('input[name="pin"]') || 
                document.querySelector('#email-pin') || 
                document.querySelector('#input__email_verification_pin') ||
                document.location.href.includes("checkpoint/challenge"));
    });

    if (is2FA) {
      console.log("[Scraper] 2FA detected. Creating challenge record...");
      
      const challengeType = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        if (text.includes("email") || text.includes("e-mail")) return "email_code";
        if (text.includes("sms") || text.includes("téléphone")) return "sms_code";
        return "captcha";
      });

      // Create challenge in DB
      const { data: challenge, error: challengeError } = await supabase
        .from("linkedin_challenges")
        .insert({
          account_id: accountId,
          challenge_type: challengeType,
          challenge_status: "pending"
        })
        .select()
        .single();

      if (challengeError) throw challengeError;

      // Update account status
      await supabase.from("linkedin_accounts").update({ status: "challenge_pending" }).eq("id", accountId);

      // Wait for the code to be provided in the DB (polling for 2 minutes max)
      console.log(`[Scraper] Waiting for 2FA code for challenge ${challenge.id}...`);
      let code = null;
      const startTime = Date.now();
      while (Date.now() - startTime < 120000) {
        const { data: updatedChallenge } = await supabase
          .from("linkedin_challenges")
          .select("code, challenge_status")
          .eq("id", challenge.id)
          .single();
        
        if (updatedChallenge?.code) {
          code = updatedChallenge.code;
          break;
        }
        if (updatedChallenge?.challenge_status === "expired") break;
        
        await new Promise(r => setTimeout(r, 5000));
      }

      if (code) {
        console.log("[Scraper] Code received. Injecting...");
        // Handle different 2FA input structures
        const pinInputSelector = 'input[name="pin"], #email-pin, #input__email_verification_pin';
        await page.type(pinInputSelector, code, { delay: 100 });
        await page.click('button[type="submit"], #email-pin-submit-button');
        await page.waitForNavigation({ waitUntil: "networkidle2" });
      } else {
        await supabase.from("linkedin_challenges").update({ challenge_status: "expired" }).eq("id", challenge.id);
        throw new Error("2FA timeout");
      }
    }

    // Verify login success
    const cookies = await page.cookies();
    const liAt = cookies.find((c: any) => c.name === "li_at");

    if (liAt) {
      console.log("[Scraper] Login successful. Saving session...");
      
      // Get all session data
      const sessionData = {
        cookies: cookies,
        localStorage: await page.evaluate(() => JSON.stringify(localStorage)),
        sessionStorage: await page.evaluate(() => JSON.stringify(sessionStorage)),
      };

      // Save to linkedin_sessions
      await supabase.from("linkedin_sessions").insert({
        account_id: accountId,
        session_data: sessionData,
        user_agent: await page.evaluate(() => navigator.userAgent)
      });

      // Update account
      await supabase.from("linkedin_accounts").update({ 
        status: "connected",
        last_error: null 
      }).eq("id", accountId);

      return { success: true };
    } else {
      throw new Error("Login failed - li_at cookie not found");
    }

  } catch (error: any) {
    console.error("[Scraper] Login flow failed:", error);
    await supabase.from("linkedin_accounts").update({ 
      status: "error",
      last_error: error.message 
    }).eq("id", accountId);
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}
