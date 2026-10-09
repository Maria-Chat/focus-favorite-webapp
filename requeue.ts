import { Inngest } from 'inngest';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
const inngest = new Inngest({ id: 'focus-favorite', eventKey: 'local' });

async function run() {
  let allPending: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const res = await fetch(`${supabaseUrl}/rest/v1/saved_items?status=eq.pending&select=id,url&limit=${limit}&offset=${offset}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (!res.ok) throw new Error(await res.text());
    
    const chunk = await res.json();
    if (chunk.length === 0) break;
    allPending.push(...chunk);
    offset += limit;
  }

  console.log(`Found ${allPending.length} pending items.`);

  const BATCH_SIZE = 100;
  for (let i = 0; i < allPending.length; i += BATCH_SIZE) {
    const batch = allPending.slice(i, i + BATCH_SIZE);
    
    const events = batch.map((item: any) => ({
      name: 'app/saved_item.ingested',
      data: { url: item.url, id: item.id }
    }));

    const inngestRes = await fetch('http://127.0.0.1:8288/e/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events)
    });

    if (!inngestRes.ok) {
      throw new Error(`Inngest error: ${await inngestRes.text()}`);
    }

    console.log(`Sent batch ${i / BATCH_SIZE + 1} (${batch.length} items)`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  console.log("Done requeuing!");
}

run();
