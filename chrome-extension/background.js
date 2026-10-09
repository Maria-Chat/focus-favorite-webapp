// Focus Favorite - Background service worker (Manifest V3)
// Uploads batches to the local Web App on behalf of content scripts.
// Why: a content script fetch runs with the *page* origin (facebook.com), so it
// is subject to CORS + Chrome's Local Network Access prompt for localhost.
// The extension origin (with host_permissions) is not, and keeps working even
// if the popup is closed.

const API_ENDPOINT = 'http://localhost:3000/api/ingest';
const MAX_ATTEMPTS = 3;

async function postWithRetry(items) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      if (res.ok) return await res.json().catch(() => ({}));
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt)); // 1s, 2s backoff
  }
  throw lastErr;
}

async function markSynced(urls) {
  const { syncedUrls = [] } = await chrome.storage.local.get(['syncedUrls']);
  const set = new Set(syncedUrls);
  urls.forEach((u) => set.add(u));
  await chrome.storage.local.set({ syncedUrls: Array.from(set) });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action !== 'INGEST_BATCH') return; // not ours (e.g. SCROLL_PROGRESS)
  const items = Array.isArray(msg.items) ? msg.items : [];
  (async () => {
    if (items.length === 0) return sendResponse({ ok: true, sent: 0 });
    try {
      const data = await postWithRetry(items);
      // Only mark as synced AFTER the server confirmed the write
      await markSynced(items.map((i) => i.url));
      sendResponse({ ok: true, sent: items.length, inserted: data.inserted ?? null });
    } catch (e) {
      sendResponse({ ok: false, sent: 0, error: String(e?.message || e) });
    }
  })();
  return true; // async response
});
