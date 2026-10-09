import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest/client';

// NOTE: synced_history.json is no longer read or written (it was fully
// re-parsed and re-written on every request — 9.5MB+). The existing file is
// kept untouched as a legacy backup. Supabase is the single source of truth.

const DB_CHUNK = 500;          // max rows per Supabase query/insert
const EVENT_BATCH = 100;       // max events per inngest.send
const GET_LIMIT = 100;         // Dev Sandbox only needs the latest items

const hasSupabase = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

const CORS = { 'Access-Control-Allow-Origin': '*' };

// Handle CORS Preflight OPTIONS Request
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// DELETE /api/ingest — Clear Database (legacy backup file is left untouched)
export async function DELETE() {
  if (hasSupabase()) {
    const { error } = await supabaseAdmin
      .from('saved_items')
      .delete()
      .neq('url', 'dummy'); // delete all rows
      
    if (error) {
      console.error('Failed to wipe Supabase:', error.message);
      return NextResponse.json({ error: 'Failed to wipe database' }, { status: 500 });
    }
  }

  return NextResponse.json(
    { message: 'Database cleared successfully' },
    { status: 200, headers: CORS }
  );
}

// GET /api/ingest — Return the latest synced items (bounded) + total count
export async function GET() {
  if (!hasSupabase()) {
    return NextResponse.json({ totalCount: 0, items: [] }, { status: 200, headers: CORS });
  }

  const { data, count, error } = await supabaseAdmin
    .from('saved_items')
    .select(
      'id,url,platform,content_type,original_title,original_caption,normalized_category,tags,status,created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .limit(GET_LIMIT);

  if (error) {
    console.error('Ingest GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  }

  return NextResponse.json(
    { totalCount: count ?? data?.length ?? 0, items: data ?? [] },
    { status: 200, headers: CORS }
  );
}

// POST /api/ingest — Save items to Supabase & dispatch Inngest events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        {
          status: 400,
          headers: CORS,
        }
      );
    }

    // Helper to remove unpaired surrogates that crash PostgreSQL JSON parser
    const sanitizeText = (str: string | undefined | null) => {
      if (!str) return '';
      if (typeof str.toWellFormed === 'function') return str.toWellFormed();
      return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|([^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, '');
    };

    const recordsToInsert = items.map((item, idx) => {
      const titleText = sanitizeText(item.title || item.original_title || 'YouTube Content');
      const captionText = sanitizeText(item.caption || item.original_caption || titleText);
      const titleLower = titleText.toLowerCase();

      const category = titleLower.includes('กิน') || titleLower.includes('ร้าน') || titleLower.includes('cafe') || titleLower.includes('food') || titleLower.includes('ชีส')
        ? 'Food & Cafe'
        : titleLower.includes('เที่ยว') || titleLower.includes('รีวิว')
        ? 'Travel'
        : titleLower.includes('claude') || titleLower.includes('ai') || titleLower.includes('obsidian')
        ? 'Tech & Knowledge'
        : 'General Content';

      return {
        url: item.url,
        platform: item.platform || 'youtube',
        content_type: item.content_type || 'video',
        original_title: titleText,
        original_caption: captionText,
        normalized_category: category,
        tags: [item.platform || 'youtube', category],
        extracted_locations: [],
        status: 'pending',
        created_at: new Date().toISOString(),
      };
    });

    // Deduplicate recordsToInsert by URL to prevent Supabase bulk upsert errors
    const uniqueRecordsMap = new Map();
    recordsToInsert.forEach(rec => {
      uniqueRecordsMap.set(rec.url, rec);
    });
    const deduplicatedRecordsToInsert = Array.from(uniqueRecordsMap.values());

    let insertedCount = 0;
    let skippedCount = 0;

    if (hasSupabase()) {
      // Process in bounded chunks so a 10k-item payload never builds a giant
      // `.in()` URL or a single huge insert in memory.
      for (let c = 0; c < deduplicatedRecordsToInsert.length; c += DB_CHUNK) {
        const chunk = deduplicatedRecordsToInsert.slice(c, c + DB_CHUNK);

        // 1. Fetch existing URLs to avoid redundant processing
        const { data: existingData, error: selErr } = await supabaseAdmin
          .from('saved_items')
          .select('url')
          .in('url', chunk.map((r: any) => r.url));
        if (selErr) console.error('Supabase select error:', selErr.message);

        const existingUrls = new Set(existingData?.map((d: any) => d.url) || []);
        const trulyNewRecords = chunk.filter((r: any) => !existingUrls.has(r.url));
        skippedCount += chunk.length - trulyNewRecords.length;
        if (trulyNewRecords.length === 0) continue;

        const { data: insertedData, error } = await supabaseAdmin
          .from('saved_items')
          .insert(trulyNewRecords)
          .select('id, url');
        if (error) {
          console.error('Supabase Insert Error:', error.message);
          continue;
        }

        // 2. Dispatch Inngest events ONLY for truly new items
        for (let i = 0; i < (insertedData?.length ?? 0); i += EVENT_BATCH) {
          const batch = insertedData!.slice(i, i + EVENT_BATCH);
          await inngest.send(
            batch.map((item: any) => ({
              name: 'app/saved_item.ingested' as const,
              data: { url: item.url, id: item.id }
            }))
          );
        }
        insertedCount += insertedData?.length ?? 0;
      }
      console.log(`⚡ Ingest: ${insertedCount} new (queued to Inngest), ${skippedCount} already existed`);
    }

    // Keep the response small — the extension only needs counts.
    return NextResponse.json(
      {
        message: `Successfully ingested ${recordsToInsert.length} item(s)`,
        count: recordsToInsert.length,
        inserted: insertedCount,
        skipped: skippedCount,
      },
      {
        status: 200,
        headers: CORS,
      }
    );
  } catch (err: any) {
    console.error('Ingest API Exception:', err?.message ?? err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: CORS }
    );
  }
}
