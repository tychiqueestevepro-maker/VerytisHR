
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.from('integrations').select('*').limit(1);
  if (error) {
    console.error('Error fetching integrations:', error);
  } else {
    console.log('Integrations table exists. Data:', data);
  }

  const { data: data2, error: error2 } = await supabase.from('profiles').select('*').limit(1);
  if (error2) {
    console.error('Error fetching profiles:', error2);
  } else {
    console.log('Profiles table exists. Data:', data2);
  }
}

check();
