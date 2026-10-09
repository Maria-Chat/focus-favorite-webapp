const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/saved_items?select=status,platform';
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
  try {
    let completed = 0, pending = 0, errCount = 0;
    let fbCount = 0;
    let totalLength = 0;
    
    let hasMore = true;
    let offset = 0;
    const limit = 1000;

    while (hasMore) {
      const res = await fetch(`${url}&limit=${limit}&offset=${offset}`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      
      if (data.length === 0) {
        hasMore = false;
        break;
      }
      
      totalLength += data.length;
      data.forEach(row => {
        if (row.status === 'completed') completed++;
        if (row.status === 'pending') pending++;
        if (row.status === 'error') errCount++;
        if (row.platform === 'facebook') fbCount++;
      });
      
      offset += limit;
    }
    
    console.log(`[${new Date().toISOString()}] Database Status:`);
    console.log(`- Total Items: ${totalLength}`);
    console.log(`- Facebook Items: ${fbCount}`);
    console.log(`- Completed (AI processed): ${completed}`);
    console.log(`- Pending (In Queue): ${pending}`);
    console.log(`- Error: ${errCount}`);
    
  } catch (err) {
    console.error("Failed to check status:", err.message);
  }
}

check();
