
import { createSupabaseServiceClient } from "./src/lib/supabase/server";

async function debugBrenda() {
  const supabase = createSupabaseServiceClient();
  
  const { data: candidates } = await supabase
    .from("candidates")
    .select("*")
    .ilike("first_name", "%Brenda%");

  console.log("Candidates found:", JSON.stringify(candidates, null, 2));

  if (candidates && candidates.length > 0) {
    for (const candidate of candidates) {
      const { data: verifications } = await supabase
        .from("linkedin_verifications")
        .select("*")
        .eq("candidate_id", candidate.id);
      
      console.log(`Verifications for ${candidate.first_name} ${candidate.last_name}:`, JSON.stringify(verifications, null, 2));
    }
  }
}

debugBrenda();
