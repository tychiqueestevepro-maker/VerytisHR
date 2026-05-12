import { analyzePipelineSession } from "./src/lib/hr/pipeline";

async function run() {
  console.log("--- START DEBUG ANALYSIS ---");
  const token = "a1a52aa8-1181-4696-b465-9a960cf38ccc";
  try {
    await analyzePipelineSession(token);
    console.log("--- END DEBUG ANALYSIS (SUCCESS) ---");
  } catch (err) {
    console.error("--- END DEBUG ANALYSIS (FAILED) ---", err);
  }
}

run();
