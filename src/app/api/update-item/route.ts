import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { itemId, tags, extracted_locations, normalized_category } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    }

    const updatePayload: any = { tags, extracted_locations };
    if (normalized_category !== undefined) {
      updatePayload.normalized_category = normalized_category;
    }

    const { error } = await supabaseAdmin
      .from('saved_items')
      .update(updatePayload)
      .eq('id', itemId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Update item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
