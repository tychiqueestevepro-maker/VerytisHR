import { getMissionListData } from "../src/lib/hr/application-workspace";

async function run() {
  const data = await getMissionListData();
  console.log(JSON.stringify(data.missions.map(m => ({ id: m.id, title: m.title, workflowType: m.workflowType })), null, 2));
}

run().catch(console.error);
