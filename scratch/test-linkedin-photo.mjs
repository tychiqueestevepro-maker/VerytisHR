
import * as cheerio from "cheerio";

async function fetchLinkedInPhoto(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      console.log(`Failed to fetch: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const ogImage = $('meta[property="og:image"]').attr("content");
    const twitterImage = $('meta[name="twitter:image"]').attr("content");
    
    return ogImage || twitterImage || null;
  } catch (error) {
    console.error("Error fetching LinkedIn photo:", error);
    return null;
  }
}

const testUrl = "https://www.linkedin.com/in/satyanadella";
fetchLinkedInPhoto(testUrl).then(photo => {
  console.log("Photo URL:", photo);
});
