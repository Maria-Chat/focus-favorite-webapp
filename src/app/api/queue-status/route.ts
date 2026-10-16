import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET() {
  try {
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
    if (!hasSupabase) {
      return NextResponse.json({
        total: 0,
        completed: 0,
        pending: 0,
        error: 0,
        status: 'idle',
        oldestPendingMinutes: 0,
        updatedAt: new Date().toISOString(),
      }, { headers: CORS });
    }

    const [totalRes, completedRes, pendingRes, errorRes, oldestPendingRes] = await Promise.all([
      supabaseAdmin.from('saved_items').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('saved_items').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabaseAdmin.from('saved_items').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('saved_items').select('*', { count: 'exact', head: true }).eq('status', 'error'),
      supabaseAdmin.from('saved_items')
        .select('created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    ]);

    const total = totalRes.count ?? 0;
    const completed = completedRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    const errorCount = errorRes.count ?? 0;

    let oldestPendingMinutes = 0;
    if (oldestPendingRes?.data?.created_at) {
      const createdTime = new Date(oldestPendingRes.data.created_at).getTime();
      oldestPendingMinutes = Math.max(0, Math.floor((Date.now() - createdTime) / (1000 * 60)));
    }

    // Determine status:
    // 'idle': no pending items
    // 'processing': pending items exist and moving (< 10 mins)
    // 'stalled': pending items exist and oldest has been stuck for > 15 mins (or errorCount > 0)
    let systemStatus: 'idle' | 'processing' | 'stalled' = 'idle';
    if (pending > 0) {
      systemStatus = oldestPendingMinutes > 15 || errorCount > 0 ? 'stalled' : 'processing';
    } else if (errorCount > 0) {
      systemStatus = 'stalled';
    }

    return NextResponse.json({
      total,
      completed,
      pending,
      error: errorCount,
      status: systemStatus,
      oldestPendingMinutes,
      updatedAt: new Date().toISOString(),
    }, { headers: CORS });
  } catch (error: any) {
    console.error('Queue status check error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to check queue status',
      status: 'error',
      updatedAt: new Date().toISOString(),
    }, { status: 500, headers: CORS });
  }
}
