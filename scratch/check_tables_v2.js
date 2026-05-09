
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const tables = ['integrations', 'linkedin_cloud_sessions', 'profiles', 'users', 'missions', 'candidates'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (error) {
      console.log(`Table ${table}: MISSING (${error.message})`);
    } else {
      console.log(`Table ${table}: EXISTS`);
    }
  }
}

check();
