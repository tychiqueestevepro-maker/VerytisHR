import { createClient } from '@supabase/supabase-js';
import { analyzePipelineSession } from "../src/lib/hr/pipeline";
import * as dotenv from "dotenv";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);
dotenv.config({ path: ".env.local" });

async function run() {
  console.log("--- EMERGENCY RE-ANALYSIS ---");
  console.log("Imported from:", nodeRequire.resolve("../src/lib/hr/pipeline"));
  
  const token = "a1a52aa8-1181-4696-b465-9a960cf38ccc";
  
  try {
    console.log("Triggering analysis...");
    await analyzePipelineSession(token);
    console.log("SUCCESS!");
  } catch (err) {
    console.error("FAILED:", err);
  }
}

run();
