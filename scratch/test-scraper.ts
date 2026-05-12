import { createRequire } from "node:module";
import { createSupabaseServiceClient } from "../src/lib/supabase/server";
import { scrapeLinkedInProfile } from "../src/lib/hr/scraper/linkedin";
import { asObject, pickString } from "../src/lib/hr/utils";

async function test() {
  const supabase = createSupabaseServiceClient();
  const companyId = "785a56a6-f895-4928-9748-7cf5435be569"; // From your screenshot URL
  const linkedinUrl = "https://www.linkedin.com/in/iammiloai/";

  console.log("--- TEST SCRAPER ---");
  console.log(`URL: ${linkedinUrl}`);
  
  // 1. Get Cookie
  const { data: company } = await supabase
    .from("companies")
    .select("metadata")
    .eq("id", companyId)
    .single();
    
  const cookie = pickString(asObject(company?.metadata).linkedin_session_cookie);
  console.log(`Cookie found: ${!!cookie}`);
  
  if (!cookie) {
    console.error("ERREUR: Pas de cookie LinkedIn trouvé pour cette entreprise.");
    return;
  }

  // 2. Try Scrape
  try {
    const profile = await scrapeLinkedInProfile(linkedinUrl, cookie);
    if (profile) {
      console.log("SUCCÈS: Profil récupéré !");
      console.log(`Nom: ${profile.name}`);
      console.log(`Expériences: ${profile.experiences.length}`);
    } else {
      console.error("ÉCHEC: Le scraper a renvoyé null.");
    }
  } catch (err) {
    console.error("ERREUR FATALE:", err);
  }
}

test();
