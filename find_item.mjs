import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('saved_items')
    .select('id, url, platform, original_title, original_caption')
    .eq('original_title', 'YouTube Content')
    .limit(5);
  console.log(JSON.stringify(data, null, 2));
}
run();
