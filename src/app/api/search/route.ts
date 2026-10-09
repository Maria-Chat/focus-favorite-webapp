import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

import { embed } from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req: NextRequest) {
  try {
    const { query, mode, platform, category, match_threshold = 0.2, match_count = 20, offset = 0 } = await req.json();

    if (mode === 'semantic' && query) {
      const { embedding: rawEmbedding } = await embed({
        model: google.textEmbeddingModel('gemini-embedding-2'),
        value: query,
      });
      const embedding = rawEmbedding.slice(0, 768);

      const { data, error } = await supabaseAdmin.rpc('match_saved_items', {
        query_embedding: embedding,
        match_threshold,
        match_count,
        filter_platform: platform === 'all' ? null : platform,
        filter_category: category === 'all' ? null : category,
      });

      if (error) {
        console.error('Vector Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ results: data, mode: 'semantic' });
    }

    // Otherwise, perform standard Full-Text Search / Metadata filtering
    let dbQuery = supabaseAdmin.from('saved_items')
      .select('id, url, platform, content_type, original_title, original_caption, normalized_category, tags, extracted_locations, created_at, status')
      .order('created_at', { ascending: false });

    if (platform && platform !== 'all') {
      dbQuery = dbQuery.eq('platform', platform);
    }

    if (category && category !== 'all') {
      dbQuery = dbQuery.eq('normalized_category', category);
    }

    if (query && query.trim()) {
      dbQuery = dbQuery.or(`original_title.ilike.%${query}%,original_caption.ilike.%${query}%`);
    }

    const { data, error } = await dbQuery.range(offset, offset + match_count - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: data, mode: 'keyword' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Search Error' }, { status: 500 });
  }
}
