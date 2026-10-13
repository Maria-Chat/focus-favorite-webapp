// Re-queue all `pending` saved_items by sending events directly to an Inngest event API.
// Usage: node --env-file=.env.local scripts/requeue_pending.mjs [INNGEST_EVENT_URL]
// Default URL targets the Inngest dev server (INNGEST_DEV mode): http://localhost:8288/e/dev
const EVENT_URL = process.argv[2] || 'http://localhost:8288/e/dev';
const base = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/saved_items';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const items = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${base}?select=id,url&status=eq.pending&order=id`, {
    headers: { ...headers, Range: `${from}-${from + 999}` },
  });
  const page = await res.json();
  if (!Array.isArray(page)) throw new Error(JSON.stringify(page));
  items.push(...page);
  if (page.length < 1000) break;
}
console.log(`Found ${items.length} pending items`);

for (let i = 0; i < items.length; i += 100) {
  const batch = items.slice(i, i + 100).map((it) => ({
    name: 'app/saved_item.ingested',
    data: { url: it.url, id: it.id },
  }));
  const res = await fetch(EVENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!res.ok) throw new Error(`Inngest ${res.status}: ${await res.text()}`);
  await new Promise((r) => setTimeout(r, 150));
}
console.log(`Queued ${items.length} events to ${EVENT_URL}`);
