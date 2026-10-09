const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});
const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

async function run() {
  console.log('Fetching pending items that are stuck in Inngest queue...');
  const res = await fetch(`${supabaseUrl}/rest/v1/saved_items?select=id,original_title,normalized_category,extracted_locations&status=eq.pending`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const items = await res.json();
  
  if (!items || items.length === 0) {
    console.log('No pending items found.');
    return;
  }
  
  let targetItems = [];
  const targetCategories = ['Food & Cafe', 'Travel', 'Hotel & Resort', 'Food & Dining', 'Travel & Places'];
  
  for (const item of items) {
    const isTargetCategory = targetCategories.some(c => item.normalized_category?.includes(c) || item.normalized_category === c);
    const hasNoLocations = !item.extracted_locations || item.extracted_locations.length === 0;
    if (isTargetCategory && hasNoLocations) {
      targetItems.push(item);
    }
  }
  
  console.log(`Found ${targetItems.length} items to update manually.`);
  
  let updatedCount = 0;
  for (const item of targetItems) {
    const fallbackLocation = [{
      name: 'ไม่พบชื่อสถานที่',
      type: 'Unknown',
      place_id: 'failed_geocoding',
      lat: null,
      lng: null
    }];
    
    await fetch(`${supabaseUrl}/rest/v1/saved_items?id=eq.${item.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        extracted_locations: fallbackLocation,
        status: 'completed'
      })
    });
    
    updatedCount++;
    console.log(`Updated item: ${item.original_title}`);
    await new Promise(r => setTimeout(r, 50)); 
  }
  
  console.log(`Done! Forced fallback location for ${updatedCount} items.`);
}

run();
