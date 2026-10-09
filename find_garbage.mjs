const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const res = await fetch(`${url}/rest/v1/saved_items?select=id,url,original_title&url=not.like.http%25`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  
  const data = await res.json();
  console.log("Found", data.length, "items without 'http' in URL:");
  console.log(data);
}
run();
