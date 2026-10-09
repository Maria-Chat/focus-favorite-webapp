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
  console.log('Fetching pending items to retry triggering Inngest...');
  const res = await fetch(`${supabaseUrl}/rest/v1/saved_items?select=id,original_title,normalized_category,extracted_locations&status=eq.pending`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const items = await res.json();
  
  let targetItems = [];
  const targetCategories = ['Food & Cafe', 'Travel', 'Hotel & Resort', 'Food & Dining', 'Travel & Places'];
  
  for (const item of items) {
    const isTargetCategory = targetCategories.some(c => item.normalized_category?.includes(c) || item.normalized_category === c);
    const hasNoLocations = !item.extracted_locations || item.extracted_locations.length === 0;
    if (isTargetCategory && hasNoLocations) {
      targetItems.push(item);
    }
  }
  
  console.log(`Found ${targetItems.length} items to reprocess.`);
  
  let triggeredCount = 0;
  for (const item of targetItems) {
    console.log(`Re-queueing: ${item.original_title}`);
    
    // Set status back to pending so frontend shows it processing
    await fetch(`${supabaseUrl}/rest/v1/saved_items?id=eq.${item.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'pending' })
    });
    
    // Trigger Inngest
    await fetch('http://127.0.0.1:8290/e/default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'app/item.saved',
        data: { itemId: item.id }
      })
    });
    
    triggeredCount++;
    await new Promise(r => setTimeout(r, 100)); // slight delay
  }
  
  console.log(`Done! Sent ${triggeredCount} items to Inngest for reprocessing.`);
}

run();
