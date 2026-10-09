const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});
const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];
const googleApiKey = envVars['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'];

if (!googleApiKey) {
  console.error("ERROR: Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local first!");
  process.exit(1);
}

async function geocodeGoogle(name) {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(name + ' Thailand')}&key=${googleApiKey}`);
    const data = await res.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id
      };
    }
  } catch(e) {
    console.log("Error geocoding:", name, e.message);
  }
  
  // Return null if we can't find it
  return {
    lat: null,
    lng: null,
    place_id: "failed_geocoding"
  };
}

async function run() {
  console.log('Fetching all completed items with dummy or missing coordinates...');
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
        // If it's a dummy location (from Nominatim failure)
        if (loc.place_id && loc.place_id.startsWith('dummy_')) {
          needsUpdate = true;
          console.log(`Asking Google Maps for: ${loc.name}`);
          const newCoords = await geocodeGoogle(loc.name);
          updatedLocations.push({ ...loc, ...newCoords });
          await new Promise(r => setTimeout(r, 100)); // Slight delay
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
  console.log(`Done! Updated ${updatedCount} items using Google Maps API.`);
}

run();
