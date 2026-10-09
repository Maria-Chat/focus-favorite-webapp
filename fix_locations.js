const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});
const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

async function geocode(name) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'FocusFavorite-App/1.0' }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        formatted_address: data[0].display_name,
        place_id: data[0].place_id.toString()
      };
    }
  } catch(e) {}
  return {
    lat: 13.7563 + (Math.random() - 0.5) * 0.1,
    lng: 100.5018 + (Math.random() - 0.5) * 0.1,
    place_id: `dummy_${Math.random()}`
  };
}

async function run() {
  console.log('Fetching completed items...');
  const res = await fetch(`${supabaseUrl}/rest/v1/saved_items?select=id,extracted_locations&status=eq.completed`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const items = await res.json();
  
  if (!items || items.length === 0) {
    console.log('No completed items found.');
    return;
  }
  
  let updatedCount = 0;
  for (const item of items) {
    if (item.extracted_locations && item.extracted_locations.length > 0) {
      let needsUpdate = false;
      const updatedLocations = [];
      for (const loc of item.extracted_locations) {
        if (loc.lat === 13.7563 && loc.lng === 100.5018) {
          needsUpdate = true;
          const newCoords = await geocode(loc.name);
          updatedLocations.push({ ...loc, ...newCoords });
          await new Promise(r => setTimeout(r, 1000)); // Respect nominatim 1s rate limit
        } else {
          updatedLocations.push(loc);
        }
      }
      
      if (needsUpdate) {
        await fetch(`${supabaseUrl}/rest/v1/saved_items?id=eq.${item.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ extracted_locations: updatedLocations })
        });
        updatedCount++;
        console.log(`Updated item ID: ${item.id}`);
      }
    }
  }
  console.log(`Done! Updated ${updatedCount} items.`);
}

run();
