const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

async function wipeDatabase() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/saved_items?url=neq.dummy`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    console.log('Status:', res.status);
    console.log('Response:', await res.text());
  } catch (err) {
    console.error(err);
  }
}
wipeDatabase();
