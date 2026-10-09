const API_ENDPOINT = 'http://localhost:3000/api/ingest';

async function sendScrapeMessage(tabId, action = 'SCRAPE_SAVED', maxScrolls = 250, stopOnExisting = false) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action, maxScrolls, stopOnExisting }, (res) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(res);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const cardNew = document.getElementById('cardNew');
  const cardAll = document.getElementById('cardAll');
  const radioNew = document.getElementById('radioNew');
  const radioAll = document.getElementById('radioAll');
  const startSyncBtn = document.getElementById('startSyncBtn');
  const stopBtn = document.getElementById('stopBtn');
  const log = document.getElementById('log');

  // Sync Extension Memory with True Database based on current Platform
  async function syncMemoryWithDB() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;
      
      let platform = '';
      if (tab.url.includes('tiktok.com')) platform = 'tiktok';
      else if (tab.url.includes('facebook.com')) platform = 'facebook';
      else if (tab.url.includes('youtube.com')) platform = 'youtube';
      
      if (!platform) return; // Not on a supported page

      log.innerText = `🔄 Syncing memory for ${platform}...`;
      const res = await fetch(`http://localhost:3000/api/synced-urls?platform=${platform}`);
      if (res.ok) {
        const data = await res.json();
        await new Promise(r => chrome.storage.local.set({ syncedUrls: data.urls || [] }, r));
        log.style.color = '#34d399';
        log.innerText = `✅ Memory synced (${data.urls.length} items)! Ready.`;
      }
    } catch (e) {
      console.warn("Could not sync memory with DB", e);
      log.style.color = '#fbbf24';
      log.innerText = `⚠️ Could not reach database. Using local memory.`;
    }
  }
  
  // Call it immediately
  syncMemoryWithDB();

  // Handle Radio Mode Card Selection & Styling
  function updateModeSelection() {
    if (radioNew.checked) {
      cardNew.classList.add('selected');
      cardAll.classList.remove('selected');
    } else {
      cardAll.classList.add('selected');
      cardNew.classList.remove('selected');
    }
  }

  if (cardNew && cardAll) {
    cardNew.addEventListener('click', () => {
      radioNew.checked = true;
      updateModeSelection();
    });
    cardAll.addEventListener('click', () => {
      radioAll.checked = true;
      updateModeSelection();
    });
  }

  // Listen for live scroll progress updates from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'SCROLL_PROGRESS') {
      log.style.color = '#10b981';
      const syncedText = msg.syncedCount ? ` | ⚡ Uploaded ${msg.syncedCount}` : '';
      const pendingText = msg.pendingCount ? ` (+${msg.pendingCount} waiting)` : '';
      log.innerText = `🚀 Auto-scrolling... Found ${msg.scrapedCount} items${syncedText}${pendingText} (Step ${msg.scrollStep}/${msg.maxScrolls})`;
    }
  });

  const performSync = async (useAutoScroll = true, forceReset = false) => {
    if (forceReset) {
      await new Promise((r) => chrome.storage.local.remove(['syncedUrls'], r));
      log.style.color = '#818cf8';
      log.innerText = '🔄 Cleared sync history memory! Starting fresh auto-scroll...';
    } else {
      log.style.color = '#818cf8';
    }

    if (useAutoScroll) {
      log.innerText = forceReset
        ? '🚀 Starting Full Auto-Scroll (All Content)...'
        : '🚀 Starting Incremental Auto-Scroll (New Items Only)...';
      if (stopBtn) stopBtn.style.display = 'block';
    } else {
      log.innerText = '🔍 Scanning DOM for saved content...';
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      log.style.color = '#f87171';
      log.innerText = '❌ No active tab detected.';
      if (stopBtn) stopBtn.style.display = 'none';
      return;
    }

    const action = useAutoScroll ? 'AUTO_SCROLL_AND_SCRAPE' : 'SCRAPE_SAVED';
    let res = await sendScrapeMessage(tab.id, action, 1000, !forceReset);

    // If content script was not injected on an existing open tab, inject dynamically
    if (!res) {
      log.innerText = '⚡ Injecting collector script into tab...';
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        res = await sendScrapeMessage(tab.id, action, 1000, !forceReset);
      } catch (e) {
        console.error('Script injection failed:', e);
      }
    }

    if (stopBtn) stopBtn.style.display = 'none';

    if (!res) {
      log.style.color = '#f87171';
      log.innerText = '⚠️ Please open YouTube, TikTok, or Facebook Saved page and refresh (F5).';
      return;
    }

    if (res.totalFound === 0) {
      log.style.color = '#fbbf24';
      log.innerText = '⚠️ No saved item cards detected on current page.';
      return;
    }

    // Auto-scroll streams batches itself (via background.js). Only items the
    // server never confirmed come back here as `failedItems` to retry.
    let itemsToSend;
    if (res.streamed) {
      const failed = res.failedItems || [];
      if (failed.length === 0) {
        log.style.color = '#34d399';
        log.innerText = `✅ Auto-scroll Complete! Found ${res.totalFound} item(s), ${res.totalSyncedCount} new uploaded to Web App. Check localhost:3000`;
        return;
      }
      log.style.color = '#fbbf24';
      log.innerText = `⚠️ ${res.totalSyncedCount} uploaded, ${failed.length} failed — retrying...`;
      itemsToSend = failed;
    } else {
      // Manual scan mode: send only new items unless forceReset is explicitly triggered
      itemsToSend = forceReset ? res.items : (res.newItems && res.newItems.length > 0 ? res.newItems : res.items);
    }

    if ((!itemsToSend || itemsToSend.length === 0) && !forceReset) {
      log.style.color = '#fbbf24';
      log.innerText = `ℹ️ Found ${res.totalFound} item(s) on page, all are already synced! Switch mode to "Sync All From Scratch" if you wish to re-sync all.`;
      return;
    }

    log.innerText = `⏳ Sending ${itemsToSend.length} item(s) to Web App...`;

    try {
      const CHUNK_SIZE = 50;
      let totalSynced = 0;

      for (let i = 0; i < itemsToSend.length; i += CHUNK_SIZE) {
        const chunk = itemsToSend.slice(i, i + CHUNK_SIZE);
        
        log.innerText = `⏳ Sending chunk ${Math.floor(i/CHUNK_SIZE) + 1} of ${Math.ceil(itemsToSend.length/CHUNK_SIZE)} (${chunk.length} items)...`;
        
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          throw new Error(`API Server Error: ${response.statusText}`);
        }
        // Mark as synced only AFTER the server confirmed this chunk
        const storage = await chrome.storage.local.get(['syncedUrls']);
        const current = new Set(storage.syncedUrls || []);
        chunk.forEach((item) => current.add(item.url));
        await chrome.storage.local.set({ syncedUrls: Array.from(current) });
        totalSynced += chunk.length;
      }

      log.style.color = '#34d399';
      log.innerText = `✅ Found ${res.totalFound} total item(s) (${totalSynced} synced to Web App)! Check localhost:3000`;
      
    } catch (err) {
      log.style.color = '#f87171';
      log.innerText = `❌ Connection Error: Is localhost:3000 running? Or Payload too large.`;
      console.error(err);
    }
  };

  if (startSyncBtn) {
    startSyncBtn.addEventListener('click', () => {
      const forceReset = radioAll ? radioAll.checked : false;
      performSync(true, forceReset);
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'STOP_SCROLL' });
        log.style.color = '#fbbf24';
        log.innerText = '⏹ Stopped auto-scrolling.';
        stopBtn.style.display = 'none';
      }
    });
  }
});
