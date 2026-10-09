import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Maps API key not found' }, { status: 500 });
    }

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id'
      },
      body: JSON.stringify({
        textQuery: query + ' Thailand',
        languageCode: 'th'
      })
    });

    const data = await res.json();

    if (data.error) {
      console.error('Places API Error:', data.error);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    // Format results to match the OSM format that the UI expects
    const formattedResults = (data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || 'Unknown Place',
      display_name: place.formattedAddress || place.displayName?.text,
      lat: place.location?.latitude?.toString(),
      lon: place.location?.longitude?.toString()
    }));

    return NextResponse.json(formattedResults);
  } catch (err: any) {
    console.error('Places search error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
