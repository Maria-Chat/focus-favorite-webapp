import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes('map')) {
      return NextResponse.json({ error: 'Invalid Google Maps URL' }, { status: 400 });
    }

    // Follow redirects to get the final URL
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const finalUrl = res.url;
    const html = await res.text();

    // Extract Lat/Lng from the final URL: e.g. /@13.7563,100.5018,15z or !3d13.7563!4d100.5018
    let lat = null;
    let lng = null;

    const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    } else {
      const dMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (dMatch) {
        lat = parseFloat(dMatch[1]);
        lng = parseFloat(dMatch[2]);
      }
    }

    if (!lat || !lng) {
      // Try to find it in the HTML meta tags
      const metaMatch = html.match(/meta content="https:\/\/maps\.google\.com\/maps\/api\/staticmap\?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
      if (metaMatch) {
        lat = parseFloat(metaMatch[1]);
        lng = parseFloat(metaMatch[2]);
      }
    }

    // Extract Name from the title tag
    let name = 'พิกัดจากลิงก์ Google Maps';
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (titleMatch) {
      name = titleMatch[1].replace(' - Google Maps', '').trim();
    }

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Could not extract coordinates from the link' }, { status: 400 });
    }

    return NextResponse.json({
      name,
      lat,
      lng,
      formatted_address: name,
      place_id: `gmaps_link_${Date.now()}`
    });
  } catch (err: any) {
    console.error('Parse maps link error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
