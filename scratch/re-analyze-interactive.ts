import { scrapeLinkedInProfile } from "../src/lib/hr/scraper/linkedin";
import { createClient } from '@supabase/supabase-js';
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const url = 'https://www.linkedin.com/in/vrshah/';
  
  // Get cookie from DB
  const {data: company} = await supabase.from('companies').select('metadata').eq('id', 'ec113a92-34b1-4bc4-876b-64bbaeb40704').single();
  const cookie = company.metadata.linkedin_session_cookie;

  console.log("--- TENTATIVE INTERACTIVE ---");
  console.log("Une fenêtre Chrome va s'ouvrir sur votre écran.");
  console.log("Si vous voyez un CAPTCHA, résolvez-le vite !");
  
  try {
    // Note: I will modify the scraper temporarily to be non-headless
    const profile = await scrapeLinkedInProfile(url, cookie); 
    console.log("RÉSULTAT:", profile ? "SUCCÈS !" : "ÉCHEC.");
  } catch (err) {
    console.error("ERREUR:", err);
  }
}

run();
