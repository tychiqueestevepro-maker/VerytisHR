require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: companies } = await supabase.from('companies').select('id, country, city').limit(1);
  const { data: users } = await supabase.from('users').select('id, metadata').limit(1);
  console.log("Companies:", companies);
  console.log("Users:", JSON.stringify(users, null, 2));
}
run();
