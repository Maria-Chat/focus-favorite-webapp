const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/saved_items';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function countStatus(status) {
  const res = await fetch(`${url}?status=eq.${status}&select=id`, {
    headers: { ...headers, 'Prefer': 'count=exact' }
  });
  const count = res.headers.get('content-range')?.split('/')?.[1];
  return Number(count) || 0;
}

async function run() {
  const completed = await countStatus('completed');
  const pending = await countStatus('pending');
  const error = await countStatus('error');
  console.log('--- SYSTEM STATUS ---');
  console.log(`✅ Completed: ${completed}`);
  console.log(`⏳ Pending: ${pending}`);
  console.log(`❌ Error: ${error}`);
  console.log(`Total: ${completed + pending + error}`);
}
run();
