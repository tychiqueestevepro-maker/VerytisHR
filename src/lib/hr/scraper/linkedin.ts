import { pickString, asObject } from "../utils";
import { encryptLinkedInCredential, decryptLinkedInCredential } from "../crypto";
import { createSupabaseServiceClient } from "../../supabase/server";

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
        "--lang=fr-FR,fr"
      ],
    };

    if (proxyConfig?.server && proxyConfig?.username && proxyConfig?.password) {
      const rawServer = String(proxyConfig.server).replace(/^https?:\/\//, "");
      let rawUsername = proxyConfig.username.replace(/\s+/g, "");
      
      // For standard scraping: Use a STABLE session ID based on account ID or a hash
      if (rawUsername && (rawUsername.includes('smartproxy') || rawUsername.includes('verytis'))) {
        const stableSession = accountId ? accountId.substring(0, 8) : "default"; 
        if (rawUsername.includes('-session-')) {
          rawUsername = rawUsername.replace(/-session-[^:-]+/, `-session-${stableSession}`);
        } else {
          rawUsername = `${rawUsername}-session-${stableSession}`;
        }
      }


      launchOptions.args.push(`--proxy-server=http://${rawServer}`);
      // Save for authentication
      (launchOptions as any)._resolvedUsername = rawUsername;
    }


    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    if (proxyConfig?.server && (launchOptions as any)._resolvedUsername && proxyConfig?.password) {
      await page.authenticate({ 
        username: (launchOptions as any)._resolvedUsername, 
        password: proxyConfig.password.replace(/\s+/g, "") 
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
  let finalProxyUrl: string | null = null;

  const puppeteer = (await import("puppeteer")) as any;
  const proxyChain = (await import("proxy-chain")) as any;

  try {
    const chromePath = await getChromePath();
    console.log(`[Scraper] runLinkedInLoginFlow — chrome: ${chromePath ?? "auto"}, proxy: ${proxy?.server ?? "none"}`);

    // Build launch args — proxy-chain creates a local tunnel to handle HTTPS CONNECT auth
    const launchArgs: string[] = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,800",
      "--ignore-certificate-errors",
      "--allow-running-insecure-content",
    ];

    // Resolve proxy config — API extraction takes priority over static user:pass
    let resolvedProxy: { server: string; username?: string; password?: string } | null = null;
    if (proxy?.api_url) {
      console.log(`[Scraper] Fetching proxy from Smartproxy API...`);
      resolvedProxy = await fetchProxyFromApiUrl(proxy.api_url);
      console.log(`[Scraper] Proxy from API: ${resolvedProxy?.server ?? "none"}`);
    } else if (proxy?.server) {
      const rawServer = String(proxy.server).replace(/^https?:\/\//, "").replace(/\s+/g, "");
      let rawUsername = proxy.username ? String(proxy.username).replace(/\s+/g, "") : undefined;
      
      // The user's specific proxy provider (smartproxy.fr) uses `_area-FR` for targeting.
      // Appending `-session-xxx` corrupts their parser and causes random global IPs.
      // We will leave rawUsername exactly as configured in .env.local.

      resolvedProxy = { 
        server: rawServer, 
        username: rawUsername, 
        password: proxy.password ? String(proxy.password).replace(/\s+/g, "") : undefined 
      };
    }


    if (resolvedProxy) {
      launchArgs.push(`--proxy-server=http://${resolvedProxy.server}`);
      console.log(`[Scraper] Using native Puppeteer proxy authentication for: ${resolvedProxy.server}`);
    } else if (proxy && (proxy.server || proxy.api_url)) {
      throw new Error("Proxy configuré mais aucune IP résolue — vérifiez les credentials Smartproxy.");
    }

    // Pre-flight: raw TCP socket to see exact proxy response
    let proxyReady = false;
    let retryCount = 0;
    while (!proxyReady && retryCount < 2) {
      if (resolvedProxy) {
        let { server, username, password } = resolvedProxy;
        let [pHost, pPortStr] = server.split(":");
        let pPort = parseInt(pPortStr || "3120", 10);
        if (retryCount === 1 && pPort === 3120) pPort = 80;
        
        try {
          await new Promise<void>((resolve, reject) => {
            const net = require("net");
            const socket: any = net.createConnection({ host: pHost, port: pPort, timeout: 20000 });
            socket.on("connect", () => {
              const auth = Buffer.from(`${username}:${password}`).toString("base64");
              socket.write(`GET http://httpbin.org/ip HTTP/1.1\r\nHost: httpbin.org\r\nProxy-Authorization: Basic ${auth}\r\nConnection: close\r\n\r\n`);
            });
            let responseData = "";
            socket.on("data", (data: Buffer) => { responseData += data.toString(); });
            socket.on("end", () => {
              if (responseData.includes("200 OK") || responseData.includes("origin")) {
                proxyReady = true;
                resolve();
              } else {
                reject(new Error("Auth failed"));
              }
            });
            socket.on("error", (err: any) => reject(err));
            socket.on("timeout", () => { socket.destroy(); reject(new Error("Timeout")); });
          });
        } catch (e) {
          console.error(`[Scraper] Proxy health check failed for ${pHost}:${pPort} (Attempt ${retryCount+1})`, e);
          retryCount++;
          // We no longer append session strings to rotate, as the provider doesn't support it.
          if (retryCount >= 2) {
            throw new Error(`Le proxy Smartproxy (${pHost}:${pPort}) ne répond pas. Vérifiez vos identifiants ou votre connexion réseau.`);
          }
        }
      } else {
        proxyReady = true;
      }
    }

    // --- Dissimulation & Tunneling ---
    let finalProxyUrl: string | null = null;
    if (resolvedProxy) {
      const { server, username, password } = resolvedProxy;
      let [host, port] = server.split(":");
      
      // Fallback: If we had a failure, try port 80 for the external connection
      if (retryCount >= 1 && port === "3120") {
        console.log(`[Scraper] Using port 80 for stealth fallback...`);
        port = "80";
      }

      const encUser = encodeURIComponent(username || "");
      const encPass = encodeURIComponent(password || "");
      const upstreamUrl = `http://${encUser}:${encPass}@${host}:${port}`;
      try {
        // Create an anonymous local tunnel
        finalProxyUrl = await proxyChain.anonymizeProxy(upstreamUrl);

        console.log(`[Scraper] Stealth tunnel created: ${finalProxyUrl}`);
      } catch (e) {
        console.error("[Scraper] Failed to create stealth tunnel, using direct proxy", e);
        finalProxyUrl = upstreamUrl;
      }
    }

    const launchOptions: any = {
      headless: true,
      executablePath: chromePath,
      ignoreHTTPSErrors: true,
      args: [...launchArgs]
    };

    if (finalProxyUrl) {
      launchOptions.args.push(`--proxy-server=${finalProxyUrl}`);
    }
    
    browser = await puppeteer.launch(launchOptions);
    let page = await browser.newPage();

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

    // Headers minimalistes mais propres et sécurisés pour éviter "Unknown Browser/OS"
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
    });

    let detectedIp = null;

    // --- Clear Cookies for a Fresh Start ---
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    console.log(`[Scraper] Browser cookies cleared for a fresh login session.`);

    let loginFinished = false;

    async function updateStatus(msg: string) {
      console.log(`[Scraper] Status: ${msg}`);
      await supabase.from("linkedin_accounts").update({ 
        status: "connecting", // Ensure status remains connecting while updating message
        last_error: msg 
      }).eq("id", accountId);
    }

    // --- Phase 1: Pre-flight check ---
    // Check if we already have a session from cookies (unlikely if cleared, but for robustness)
    const initialCookies = await page.cookies();
    if (initialCookies.find((c: any) => c.name === "li_at")) {
      console.log("[Scraper] Existing li_at found before login. Skipping to success.");
      loginFinished = true;
    }

    if (!loginFinished) {
      // --- Phase 2: Human-like Navigation ---
      await updateStatus("Connexion au tunnel résidentiel...");
      await page.goto("https://www.linkedin.com/", { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
      
      // --- Human Warm-up Phase ---
      await updateStatus("Simulation d'activité humaine...");
      await page.evaluate(async () => {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, Math.floor(Math.random() * 400) + 200);
          await delay(Math.floor(Math.random() * 1000) + 500);
        }
      });
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

      await updateStatus("Accès à la page de connexion...");
      await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2", timeout: 45000 });
    }

    // --- Phase 3: Login Interaction ---
    const userSelector = "#username, #session_key, input[name='session_key'], input[type='email'], input[autocomplete='username']";
    const passSelector = "#password, #session_password, input[name='session_password'], input[type='password'], input[autocomplete='current-password']";

    try {
      // Vérifier si déjà connecté
      const alreadyLoggedIn = await page.evaluate(() => {
        return !!document.querySelector('.global-nav') || window.location.href.includes('feed');
      });
      
      if (alreadyLoggedIn) {
        console.log("[Scraper] Already logged in!");
        loginFinished = true;
      } else {
        await page.waitForSelector(userSelector, { timeout: 45000 });
        console.log(`[Scraper] Entering credentials...`);
        
        // Trouver la case e-mail VISIBLE (ignore les champs cachés)
        const emailFound = await page.evaluate(() => {
          const emails = Array.from(document.querySelectorAll("input[type='email'], input[autocomplete='username'], #username, #session_key"));
          const el = emails.find(e => (e as HTMLElement).offsetWidth > 0 && (e as HTMLElement).offsetHeight > 0) || document.querySelector("input[type='email']");
          if (el) { (el as HTMLElement).focus(); return true; }
          return false;
        });
        
        if (emailFound) {
          await page.keyboard.type(email, { delay: 120 });
        }
        
        // Trouver la case mot de passe VISIBLE
        const passFound = await page.evaluate(() => {
          const passes = Array.from(document.querySelectorAll("input[type='password'], input[autocomplete='current-password'], #password, #session_password"));
          const el = passes.find(e => (e as HTMLElement).offsetWidth > 0 && (e as HTMLElement).offsetHeight > 0) || document.querySelector("input[type='password']");
          if (el) { (el as HTMLElement).focus(); return true; }
          return false;
        });
        
        if (passFound) {
          await page.keyboard.type(password, { delay: 150 });
        }

        await updateStatus("Validation des identifiants...");
        await page.keyboard.press('Enter');

        // Fallback click if Enter doesn't work
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button[type="submit"], .login__form_action_container button, button[value="Sign in"], button[aria-label="Sign in"]'));
          const el = btns.find(b => (b as HTMLElement).offsetWidth > 0 && (b as HTMLElement).offsetHeight > 0);
          if (el) (el as HTMLElement).click();
        });

        console.log(`[Scraper] Login submission sent.`);
      }
    } catch (e: any) {
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText);
      const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(i => `${i.tagName} id=${i.id} type=${i.type} name=${i.name}`).join(', ');
      });
      
      if (bodyText.includes("CAPTCHA") || bodyText.includes("vérification de sécurité") || bodyText.includes("security check")) {
        throw new Error("LinkedIn demande un CAPTCHA. Changez d'IP ou réessayez plus tard.");
      }
      console.error(`[Scraper] Login interaction failed: ${e.message}. Title: ${title}. Inputs found: ${inputs}`);
      throw new Error(`Impossible de trouver le formulaire de connexion (Page: ${title}). Inputs: ${inputs || "aucun"}`);
    }

    // Wait for either navigation or error message
    await new Promise(r => setTimeout(r, 5000));
    
    const loginError = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      if (text.includes("e-mail ou mot de passe erroné") || 
          text.includes("adresse e-mail ou mot de passe incorrect") ||
          text.includes("wrong email or password") ||
          text.includes("identifiants sont incorrects")) {
        return "Email ou mot de passe incorrect sur LinkedIn.";
      }
      return null;
    });

    if (loginError) throw new Error(loginError);

    // Check for CAPTCHA/Security Check right after submission
    const securityCheck = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("vérification de sécurité") || text.includes("security check") || 
             text.includes("captcha") || document.querySelector('#captcha-internal') || 
             document.location.href.includes('checkpoint/rp/captcha');
    });

    if (securityCheck) {
      console.error("[Scraper] CAPTCHA or Security Check detected after login.");
      throw new Error("LinkedIn demande une vérification de sécurité (CAPTCHA). Changez d'IP ou réessayez plus tard.");
    }

    await updateStatus("Finalisation de la session...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {
      console.log("[Scraper] Navigation timeout (this is common if 2FA or slow redirect happens).");
    });

    // --- Phase 4: Handle 2FA Challenges (Looping for transitions) ---
    let challengeAttempts = 0;

    while (!loginFinished && challengeAttempts < 3) {
      const currentUrl = page.url();
      console.log(`[Scraper] 2FA Loop — Attempt ${challengeAttempts + 1}, URL: ${currentUrl}`);

      // Early exit if cookie is found
      const cookies = await page.cookies();
      if (cookies.find((c: any) => c.name === "li_at")) {
        console.log("[Scraper] li_at cookie found! Login successful.");
        loginFinished = true;
        break;
      }

      const is2FA = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const url = window.location.href.toLowerCase();
        return !!(
          document.querySelector('input[name="pin"]') ||
          document.querySelector('#input__email_verification_pin') ||
          document.querySelector('#input__phone_verification_pin') ||
          document.querySelector('#email-pin') ||
          document.querySelector('input[autocomplete="one-time-code"]') ||
          url.includes("checkpoint/challenge") ||
          url.includes("checkpoint/lg/login-submit") ||
          url.includes("checkpoint/lg/2fa") ||
          text.includes("confirmez votre identité") ||
          text.includes("confirm your identity") ||
          text.includes("vérification en deux étapes") ||
          text.includes("two-step verification") ||
          text.includes("code de vérification") ||
          text.includes("verification code")
        );
      }).catch(() => false);

      if (!is2FA) {
        // If we are on a login page but no 2FA, maybe we need to wait
        const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 300).replace(/\n/g, ' '));
        await updateStatus(`Analyse de la page (${challengeAttempts + 1}/3)...`);
        
        await new Promise(r => setTimeout(r, 3000));
        challengeAttempts++;
        continue;
      }

      // If we are here, we ARE in a challenge, so reset the "unrecognized page" counter
      challengeAttempts = 0; 
      console.log("[Scraper] 2FA detected. Identifying type...");

      // Debug: dump full page text to understand what LinkedIn shows
      const pageTextDump = await page.evaluate(() => document.body.innerText.substring(0, 800));
      console.log(`[Scraper] 2FA page text:\n---\n${pageTextDump}\n---`);

      const { challengeType, challengeHint } = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const url = document.location.href;
        const bodyText = document.body.innerText;

        // Push notification detection (LinkedIn app confirmation)
        const isPush = text.includes("notification") || text.includes("appli linkedin") ||
          text.includes("application linkedin") || text.includes("ouvrez votre") ||
          text.includes("open your linkedin") || text.includes("identifiez-vous");

        // Extract input presence
        const hasInput = !!document.querySelector('input[name="pin"], #input__email_verification_pin, #input__phone_verification_pin');

        let type: string;
        if (!hasInput && isPush) {
          type = "app_push";
        } else if (hasInput && (url.includes("phone") || text.includes("sms") || text.includes("téléphone") || text.includes("phone"))) {
          type = "sms_code";
        } else if (hasInput) {
          type = "email_code";
        } else {
          // Default to app push if no input is found on a challenge page
          type = "app_push";
        }

        let hint: string | null = null;
        const emailMatch = bodyText.match(/[a-zA-Z*0-9._%+-]+@+[a-zA-Z*0-9.-]+\.[a-zA-Z*]{2,}/);
        if (emailMatch) {
          hint = emailMatch[0];
          // Force type to email if we found an email hint
          if (hasInput) type = "email_code";
        } else {
          const phoneMatch = bodyText.match(/[•*]{2,}[\s\-]?\d{2,4}(?!\d)/);
          if (phoneMatch) hint = phoneMatch[0].trim();
        }

        if (!hint) {
          const lines = bodyText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 5 && l.length < 80);
          const destLine = lines.find((l: string) =>
            (l.includes('@') || /[•*]{2}/.test(l)) &&
            (l.toLowerCase().includes('envoy') || l.toLowerCase().includes('sent'))
          );
          if (destLine) hint = destLine;
        }

        return { challengeType: type, challengeHint: hint };
      });


      // --- New: Auto-trigger Code Sending ---
      // Some 2FA flows require clicking a "Send code" button first.
      try {
        await page.evaluate(async () => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const triggerBtn = buttons.find(b => {
            const t = (b.textContent || "").toLowerCase();
            return t.includes("envoyer le code") || t.includes("send code") || 
                   t.includes("recevoir un code") || t.includes("get a code") ||
                   t.includes("envoyer une notification") || t.includes("send a notification") ||
                   t.includes("envoyer une demande") || t.includes("send a request") ||
                   (t.includes("continuer") && !t.includes("annuler")) ||
                   (t.includes("continue") && !t.includes("cancel"));
          });

          if (triggerBtn) {
            (triggerBtn as HTMLElement).click();
            return true;
          }
          return false;
        });
        // Small wait to let the page refresh after click
        await new Promise(r => setTimeout(r, 2500));
      } catch (e) {
        console.warn("[Scraper] Failed to auto-trigger 2FA send button", e);
      }
      // --------------------------------------


      console.log(`[Scraper] Challenge type: ${challengeType}, hint: ${challengeHint ?? "none"}`);

      const { data: challenge, error: challengeError } = await supabase
        .from("linkedin_challenges")
        .insert({
          account_id: accountId,
          challenge_type: challengeType,
          challenge_hint: challengeHint,
          challenge_status: "pending"
        })
        .select()
        .single();

      if (challengeError) throw challengeError;
      await supabase.from("linkedin_accounts").update({ status: "challenge_pending" }).eq("id", accountId);

      if (challengeType === "app_push") {
        console.log("[Scraper] Push notification challenge. Polling for app confirmation or manual fallback...");
        let confirmed = false;
        let manualFallback = false;
        const startTime = Date.now();
        const MAX_WAIT = 180000; // 3 minutes

        while (Date.now() - startTime < MAX_WAIT) {
          const currentUrl = page.url();
          console.log(`[Scraper] Polling Push Status — URL: ${currentUrl}`);

          // --- AUTO-GUÉRISON PROXY ---
          if (currentUrl.includes('chrome-error')) {
            console.log("[Scraper] Proxy connection dropped! Recovering by navigating to feed...");
            await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
            continue; // Skip the rest of the loop and check the new URL next iteration
          }

          const isLoggedIn = await page.evaluate(() => {
            const url = window.location.href;
            return url.includes('feed') || 
                   url.includes('identity') ||
                   url.includes('mynetwork') ||
                   url.includes('messaging') ||
                   url.includes('jobs') ||
                   url.includes('post-login') ||
                   !!document.querySelector('.global-nav') || 
                   !!document.querySelector('.scaffold-layout') ||
                   !!document.querySelector('input[placeholder*="Search"]') ||
                   !!document.querySelector('input[placeholder*="recherche"]');
          }).catch(() => false);

          if (isLoggedIn) {
            console.log("[Scraper] Push confirmed via navigation!");
            confirmed = true;
            break;
          }

          const { data: dbChallenge } = await supabase
            .from("linkedin_challenges")
            .select("challenge_status")
            .eq("id", challenge.id)
            .single();

          if (dbChallenge?.challenge_status === "expired") {
            console.log("[Scraper] Manual fallback detected from UI.");
            manualFallback = true;
            break;
          }
          await new Promise(r => setTimeout(r, 2000));
        }

        if (!confirmed || manualFallback) {
          console.warn("[Scraper] Switching to 'no device access' fallback...");
          try {
            await page.evaluate(() => {
              const links = Array.from(document.querySelectorAll('a, button'));
              const el = links.find(l => 
                l.textContent?.toLowerCase().includes("n'ai pas accès") || 
                l.textContent?.toLowerCase().includes("no access") ||
                l.textContent?.toLowerCase().includes("autre moyen") ||
                l.textContent?.toLowerCase().includes("another way")
              );
              if (el) (el as HTMLElement).click();
            });
            await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
          } catch { /* ignore */ }
        }

        if (!confirmed && !manualFallback) {
          await supabase.from("linkedin_challenges").update({ challenge_status: "expired" }).eq("id", challenge.id);
          throw new Error("2FA push notification timeout");
        }
        
        if (confirmed) {
          await supabase.from("linkedin_challenges").update({ challenge_status: "solved" }).eq("id", challenge.id);
        }

      } else {
        // Email or SMS: wait for PIN code entered by user in the UI
        console.log(`[Scraper] Waiting for PIN code for challenge ${challenge.id}...`);
        let code = null;
        const startTime = Date.now();
        while (Date.now() - startTime < 120000) {
          const { data: updatedChallenge } = await supabase
            .from("linkedin_challenges")
            .select("code, challenge_status")
            .eq("id", challenge.id)
            .single();
          if (updatedChallenge?.code) { code = updatedChallenge.code; break; }
          if (updatedChallenge?.challenge_status === "expired") break;
          await new Promise(r => setTimeout(r, 5000));
        }

        if (code) {
          console.log("[Scraper] Code received. Finding input...");
          const pinSelectors = [
            'input[name="pin"]',
            '#input__email_verification_pin',
            '#input__phone_verification_pin',
            '#email-pin',
            'input[autocomplete="one-time-code"]',
            'input[type="text"]',
            'input[type="number"]',
            'input[type="tel"]',
          ];
          let pinSelector: string | null = null;
          for (const sel of pinSelectors) {
            try { await page.waitForSelector(sel, { timeout: 2000 }); pinSelector = sel; break; } catch { /* next */ }
          }
          if (!pinSelector) {
            const pageHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 1500));
            throw new Error(`Aucun champ PIN trouvé. HTML: ${pageHtml}`);
          }
          await page.click(pinSelector);
          await page.type(pinSelector, code, { delay: 100 });
          await page.keyboard.press('Enter'); // Reliable submit

          for (const sel of ['#email-pin-submit-button', '#two-step-submit-button', 'button[type="submit"]']) {
            try { await page.waitForSelector(sel, { timeout: 1000 }); await page.click(sel); break; } catch { /* next */ }
          }
          await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
            
          // Check for incorrect PIN error
          const pinError = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            if (text.includes("code incorrect") || text.includes("invalid code") || text.includes("réessayez")) {
              return "Le code PIN saisi est incorrect ou a expiré.";
            }
            return null;
          });
          if (pinError) throw new Error(pinError);
        } else {
          await supabase.from("linkedin_challenges").update({ challenge_status: "expired" }).eq("id", challenge.id);
          throw new Error("2FA timeout");
        }
      }
    }

    // Verify login success
    const cookies = await page.cookies();
    const liAt = cookies.find((c: any) => c.name === "li_at");

    if (liAt && liAt.value && liAt.value.length > 10) {
      console.log("[Scraper] Login verified. Syncing session...");
      
      const sessionData = {
        cookies: cookies,
        localStorage: await page.evaluate(() => JSON.stringify(localStorage)),
        sessionStorage: await page.evaluate(() => JSON.stringify(sessionStorage)),
        user_agent: await page.evaluate(() => navigator.userAgent)
      };

      // 1. Sync cookie to Company Metadata for global app usage
      const fullCookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
      const { data: company } = await supabase.from("companies").select("metadata").eq("id", account.company_id).single();
      const nextMetadata = { 
        ...(company?.metadata as any || {}), 
        linkedin_session_cookie: `li_at=${liAt.value}`,
        linkedin_full_cookie: fullCookieString,
        linkedin_cookie_updated_at: new Date().toISOString()
      };
      await supabase.from("companies").update({ metadata: nextMetadata }).eq("id", account.company_id);

      // 2. Extract profile info
      const accountInfo = await page.evaluate(() => {
        const nameEl = document.querySelector('.feed-identity-module__actor-link, .nav-settings__member-name, .t-16.t-black.t-bold');
        const locationEl = document.querySelector('.feed-identity-module__location, .t-12.t-black--light.t-normal');
        return {
          name: nameEl ? nameEl.textContent?.trim() : null,
          location: locationEl ? locationEl.textContent?.trim() : null
        };
      });

      let firstName = null;
      let lastName = null;
      if (accountInfo.name) {
        const parts = accountInfo.name.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }

      // 3. Final update to account status
      await supabase.from("linkedin_accounts").update({ 
        status: "connected",
        first_name: firstName,
        last_name: lastName,
        last_detected_ip: detectedIp,
        preferred_city: accountInfo.location || account.preferred_city,
        last_error: null 
      }).eq("id", accountId);

      return { success: true };
    } else {
      throw new Error("Connexion échouée : LinkedIn n'a pas validé la session.");
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
    if (finalProxyUrl) {
      const pc = (await import("proxy-chain")) as any;
      await pc.closeAnonymizedProxy(finalProxyUrl, true).catch(() => {});
    }
  }

}
