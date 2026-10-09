import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Handle CORS Preflight OPTIONS Request
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
      return NextResponse.json({ urls: [] }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');

    let query = supabaseAdmin
      .from('saved_items')
      .select('url')
      .order('created_at', { ascending: false });
    
    if (platform) {
      query = query.eq('platform', platform);
    }

    // Fetch ALL URLs for the specific platform. 
    // We MUST fetch all, because if we only fetch 5 and the user unsaves those 5 on TikTok, 
    // the extension will never find the stop marker and will infinite scroll.
    // 10,000 URLs is < 1MB and very fast to transfer.
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    const urls = data.map(item => item.url);
    return NextResponse.json({ urls }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (err: any) {
    console.error('Error fetching synced URLs:', err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
