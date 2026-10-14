// Clean up bogus locations produced by fuzzy Google Places matching on "ไม่พบชื่อสถานที่"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

async function run() {
  console.log("Fetching items with type: Unknown...");
  const res = await fetch(`${supabaseUrl}/rest/v1/saved_items?select=id,original_title,extracted_locations&extracted_locations=cs.[{"type":"Unknown"}]`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });
  const items = await res.json();
  console.log(`Fetched ${items.length} items with Unknown locations.`);

  let updatedCount = 0;
  for (const item of items) {
    if (!item.extracted_locations || !Array.isArray(item.extracted_locations)) continue;

    let modified = false;
    const newLocations = item.extracted_locations.map(loc => {
      if (loc.type === 'Unknown' && loc.lat !== null) {
        modified = true;
        return {
          name: 'ไม่พบชื่อสถานที่',
          type: 'Unknown',
          place_id: 'failed_geocoding',
          lat: null,
          lng: null,
          formatted_address: null
        };
      }
      return loc;
    });

    if (modified) {
      const patchRes = await fetch(`${supabaseUrl}/rest/v1/saved_items?id=eq.${item.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ extracted_locations: newLocations })
      });

      if (patchRes.ok) {
        updatedCount++;
        if (updatedCount % 50 === 0 || updatedCount === 355) {
          console.log(`Cleaned ${updatedCount}/355 items...`);
        }
      } else {
        console.error(`Failed to update item ${item.id}:`, await patchRes.text());
      }
    }
  }

  console.log(`\n🎉 Successfully cleaned ${updatedCount} items!`);
}

run();
