const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabase() {
  const { data, count, error } = await supabase
    .from('saved_items')
    .select('*', { count: 'exact', head: true });
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Total items in Supabase: ${count}`);
  }

  const { data: pending, count: pendingCount } = await supabase
    .from('saved_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
    
  console.log(`Pending items: ${pendingCount}`);

  const { data: completed, count: completedCount } = await supabase
    .from('saved_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');
    
  console.log(`Completed items: ${completedCount}`);
}

checkSupabase();
