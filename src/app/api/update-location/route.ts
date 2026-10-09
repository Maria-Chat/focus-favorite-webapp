import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { itemId, placeName, newLat, newLng, newFormattedAddress, newPlaceId, newPlaceName } = await req.json();

    if (!itemId || !placeName || newLat === undefined || newLng === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch current item
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('saved_items')
      .select('extracted_locations')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // 2. Update the specific location inside the array
    let found = false;
    const updatedLocations = (item.extracted_locations || []).map((loc: any) => {
      if (loc.name === placeName) {
        found = true;
        return {
          ...loc,
          name: newPlaceName || (newFormattedAddress ? newFormattedAddress.split(',')[0] : loc.name), // Update name to the real place name
          lat: newLat,
          lng: newLng,
          formatted_address: newFormattedAddress || loc.formatted_address,
          place_id: newPlaceId || loc.place_id
        };
      }
      return loc;
    });

    if (!found) {
      updatedLocations.push({
        name: newPlaceName || (newFormattedAddress ? newFormattedAddress.split(',')[0] : placeName),
        type: 'User Added',
        lat: newLat,
        lng: newLng,
        formatted_address: newFormattedAddress,
        place_id: newPlaceId
      });
    }

    // 3. Save back to database
    const { error: updateError } = await supabaseAdmin
      .from('saved_items')
      .update({ extracted_locations: updatedLocations })
      .eq('id', itemId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, updatedLocations });
  } catch (error: any) {
    console.error('Manual location update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
