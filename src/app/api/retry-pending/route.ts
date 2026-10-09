import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest/client';

export async function GET() {
  try {
    let allPending: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('saved_items')
        .select('id, url')
        .eq('status', 'pending')
        .order('id')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allPending.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    if (allPending.length === 0) {
      return NextResponse.json({ message: 'No pending items found.' });
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < allPending.length; i += BATCH_SIZE) {
      const batch = allPending.slice(i, i + BATCH_SIZE);
      await inngest.send(
        batch.map((item: any) => ({
          name: 'app/saved_item.ingested' as const,
          data: { url: item.url, id: item.id }
        }))
      );
      // add a small delay to avoid overwhelming the local queue immediately
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    return NextResponse.json({
      message: `Successfully queued ${allPending.length} pending item(s) to Inngest.`
    });
  } catch (error: any) {
    console.error('Retry pending error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
