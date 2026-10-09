import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('saved_items').select('url').eq('platform', 'tiktok').limit(5);
  if (error) { console.error('DB Error:', error); return; }
  
  const testUrl = data[2]?.url || data[0]?.url; // try to get a URL
  console.log('Testing URL:', testUrl);
  
  const start = Date.now();
  const res = await fetch(`http://localhost:3000/api/video-url?url=${encodeURIComponent(testUrl)}`);
  const json = await res.json();
  
  console.log(`Time: ${Date.now() - start}ms`);
  console.log('API Result:', json);
}

test();
