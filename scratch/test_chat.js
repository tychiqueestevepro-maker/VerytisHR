const { processHrChat } = require("../src/lib/hr/chat");
const { createSupabaseServiceClient } = require("../src/lib/supabase/server");

async function testChat() {
  try {
    // We need a real company ID and mission ID to test
    // Let's try to fetch one from the DB
    const supabase = createSupabaseServiceClient();
    const { data: mission } = await supabase.from("missions").select("id, company_id").limit(1).single();
    
    if (!mission) {
      console.log("No mission found in DB");
      return;
    }

    console.log("Testing chat with Mission ID:", mission.id, "Company ID:", mission.company_id);

    const result = await processHrChat({
      companyId: mission.company_id,
      message: "Bonjour, quels sont les meilleurs candidats ?",
      flowId: "applications",
      contextId: mission.id,
      locale: "fr"
    });

    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Chat Error:", error);
  }
}

testChat();
