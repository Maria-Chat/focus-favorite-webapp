const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

async function checkSupabase() {
  try {
    const resTotal = await fetch(`${supabaseUrl}/rest/v1/saved_items?select=id`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact,head=true' }
    });
    const totalCount = resTotal.headers.get('content-range').split('/')[1];
    console.log(`Total: ${totalCount}`);

    // Try a test insert with exact payload
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/saved_items`, {
      method: 'POST',
      headers: { 
        'apikey': supabaseKey, 
        'Authorization': `Bearer ${supabaseKey}`, 
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        url: 'https://www.tiktok.com/@test/video/123456789',
        platform: 'tiktok',
        content_type: 'video',
        original_title: 'ทำไม บางครั้งโดนเมินความคิดเห็น',
        original_caption: 'ทำไม บางครั้งโดนเมินความคิดเห็น',
        normalized_category: 'General Content',
        tags: ['tiktok', 'General Content'],
        extracted_locations: [],
        status: 'pending',
        created_at: new Date().toISOString(),
      })
    });
    const insertData = await insertRes.json();
    console.log('Insert Exact Payload Response:', JSON.stringify(insertData, null, 2));

  } catch (err) {
    console.error(err);
  }
}
checkSupabase();
