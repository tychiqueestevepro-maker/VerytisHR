const { createSupabaseServiceClient } = require("../src/lib/supabase/server");
const { scrapeLinkedInProfile } = require("../src/lib/hr/scraper/linkedin");
const { asObject, pickString } = require("../src/lib/hr/utils");

async function test() {
  const supabase = createSupabaseServiceClient();
  const companyId = "785a56a6-f895-4928-9748-7cf5435be569";
  const linkedinUrl = "https://www.linkedin.com/in/iammiloai/";

  console.log("--- TEST SCRAPER ---");
  console.log(`URL: ${linkedinUrl}`);
  
  const { data: company } = await supabase
    .from("companies")
    .select("metadata")
    .eq("id", companyId)
    .single();
    
  const cookie = pickString(asObject(company?.metadata).linkedin_session_cookie);
  console.log(`Cookie found: ${!!cookie}`);
  
  if (!cookie) {
    console.error("ERREUR: Pas de cookie LinkedIn trouvé.");
    return;
  }

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
