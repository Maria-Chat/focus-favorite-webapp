// Focus Favorite Chrome Extension - Enhanced DOM Content Extractor (Manifest V3)
console.log('⚡ Focus Favorite Collector Active on:', window.location.hostname);

let isAutoScrolling = false;

// Helper to sanitize & produce clean canonical YouTube URL
function getCleanYouTubeUrl(rawHref) {
  if (!rawHref) return null;
  if (rawHref.includes('/shorts/')) {
    const videoId = rawHref.split('/shorts/')[1]?.split('?')[0]?.split('&')[0]?.split('#')[0];
    return videoId ? `https://www.youtube.com/shorts/${videoId}` : null;
  }
  if (rawHref.includes('/watch')) {
    const match = rawHref.match(/(?:watch\?v=|v\/)([\w-]{11})/);
    return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
  }
  return null;
}

// Helper to extract REAL video title and filter out duration badges ("5:02") and video count badges ("30 videos")
function getYouTubeTitle(card) {
  const candidateEls = [
    card.querySelector('a#video-title-link'),
    card.querySelector('#video-title'),
    card.querySelector('yt-formatted-string#video-title'),
    card.querySelector('a#thumbnail[title]'),
    card.querySelector('a[title]')
  ];

  for (const el of candidateEls) {
    if (el) {
      const attrTitle = el.getAttribute('title') || el.getAttribute('aria-label');
      const textTitle = (el.innerText || '').trim();

      const isBadge = /^\d+:\d+(:\d+)?$/.test(textTitle) || /^\d+\s*videos$/i.test(textTitle) || textTitle === 'New';

      if (attrTitle && attrTitle.trim().length > 0 && !/^\d+:\d+/.test(attrTitle) && !/^\d+\s*videos$/i.test(attrTitle)) {
        return attrTitle.trim();
      }
      if (textTitle.length > 0 && !isBadge) {
        return textTitle;
      }
    }
  }

  // Fallback: Find first text line in card that is NOT a duration badge or count badge
  const allLines = card.innerText
    ? card.innerText.split('\n').map((l) => l.trim()).filter((l) => l.length > 2)
    : [];

  for (const line of allLines) {
    const isBadge = /^\d+:\d+(:\d+)?$/.test(line) || /^\d+\s*videos$/i.test(line) || line === 'New' || line.includes('views');
    if (!isBadge) {
      return line;
    }
  }

  return 'YouTube Saved Content';
}

// incremental=true (auto-scroll only): skip DOM nodes already processed in a
// previous pass, so each scroll step only scans NEW cards instead of the whole
// page again (the old O(n^2) behaviour that made 5,000+ item pages crawl).
function extractSavedContent(incremental = false) {
  const hostname = window.location.hostname;
  const href = window.location.href;
  const items = [];
  const seenUrls = new Set();

  if (hostname.includes('youtube.com')) {
    // 1. YouTube Playlist & Saved Shorts Pages (youtube.com/playlist?list=...)
    if (href.includes('/playlist?list=')) {
      const primaryContainer =
        document.querySelector('ytd-browse[page-subtype="playlist"] #primary') ||
        document.querySelector('ytd-browse #primary') ||
        document.querySelector('#primary');

      if (primaryContainer) {
        const cards = primaryContainer.querySelectorAll(
          'ytd-playlist-video-renderer, ytd-rich-item-renderer, ytd-rich-grid-media, ytd-grid-video-renderer'
        );

        cards.forEach((card) => {
          if (incremental && card.dataset.favExtracted) return;
          const linkEl = card.querySelector('a[href*="/watch"], a[href*="/shorts"], a#video-title-link, a#thumbnail');
          const imgEl = card.querySelector('img');

          if (linkEl && linkEl.href) {
            const cleanUrl = getCleanYouTubeUrl(linkEl.href);

            if (cleanUrl && !seenUrls.has(cleanUrl)) {
              seenUrls.add(cleanUrl);
              const titleText = getYouTubeTitle(card);
              card.dataset.favExtracted = 'true';

              items.push({
                url: cleanUrl,
                platform: 'youtube',
                content_type: cleanUrl.includes('/shorts/') ? 'video' : 'video',
                title: titleText.slice(0, 120),
                caption: titleText,
                thumbnail_url: imgEl ? imgEl.src : undefined
              });
            }
          }
        });
      }
    }
    // 2. YouTube Playlists Overview Page (youtube.com/feed/playlists)
    else if (href.includes('/feed/playlists')) {
      const primaryContainer = document.querySelector('ytd-browse #primary') || document.body;
      const playlistCards = primaryContainer.querySelectorAll('ytd-grid-playlist-renderer, ytd-rich-item-renderer');
      playlistCards.forEach((card) => {
        const titleEl = card.querySelector('#video-title, #title');
        const linkEl = card.querySelector('a[href*="/playlist?list="]') || card.querySelector('a');
        const imgEl = card.querySelector('img');

        if (titleEl && linkEl && linkEl.href && !seenUrls.has(linkEl.href)) {
          seenUrls.add(linkEl.href);
          const titleText = titleEl.innerText.trim();
          items.push({
            url: linkEl.href,
            platform: 'youtube',
            content_type: 'post',
            title: `Playlist: ${titleText}`,
            caption: `Saved YouTube Playlist: ${titleText}`,
            thumbnail_url: imgEl ? imgEl.src : undefined
          });
        }
      });
    }
  } else if (hostname.includes('tiktok.com')) {
    // Robust extraction: get all links containing '/video/' to bypass dynamic class names
    // TikTok Favorites page usually lives at /@username and requires clicking the favorites tab.
    const videoLinks = document.querySelectorAll(
      incremental ? 'a[href*="/video/"]:not([data-fav-extracted])' : 'a[href*="/video/"]'
    );
    const tiktokMap = new Map();

    videoLinks.forEach((linkEl) => {
      const url = linkEl.href;
      if (!url) return;
      
      const cleanUrl = url.split('?')[0];

      if (!tiktokMap.has(cleanUrl)) {
        tiktokMap.set(cleanUrl, { url: cleanUrl, img: null, title: null });
      }

      const itemData = tiktokMap.get(cleanUrl);

      // Extract image (TikTok uses various dynamic classes, img is safest)
      const img = linkEl.querySelector('img');
      if (img && img.src && !itemData.img) {
        itemData.img = img.src;
      }

      // Try extracting title from img alt first (most reliable for TikTok grid)
      if (img && img.alt && img.alt.trim() && !itemData.title) {
        itemData.title = img.alt.trim();
      }

      // Extract title/text from attributes
      const titleAttr = linkEl.getAttribute('title') || linkEl.getAttribute('aria-label');
      if (titleAttr && !itemData.title) {
        itemData.title = titleAttr.trim();
      } else {
         const text = linkEl.innerText.trim();
         // If text is not just a view count (e.g. 154.9K, 5.6M)
         if (text && !/^\d+(\.\d+)?[kmbKMB]?$/i.test(text) && !itemData.title) {
           itemData.title = text;
         }
      }
      
      // Fallback: look at parent container for text if title is still missing
      if (!itemData.title) {
         // TikTok Favorites often use these containers
         const cardContainer = linkEl.closest(
           'div[class*="ItemContainer"], div[class*="DivItemContainer"], [data-e2e="user-post-item"], [data-e2e="favorites-item"]'
         );
         if (cardContainer) {
             const descEl = cardContainer.querySelector(
               'div[class*="DivDes"], [data-e2e="user-post-item-desc"], [title], .video-desc'
             );
             if (descEl && descEl.innerText.trim()) {
                 itemData.title = descEl.innerText.trim();
             }
         }
      }
    });

    for (const [url, data] of tiktokMap.entries()) {
      if (!seenUrls.has(url)) {
         seenUrls.add(url);
         const textContent = data.title || 'TikTok Saved Video';
         items.push({
            url: url,
            platform: 'tiktok',
            content_type: 'video',
            title: textContent.slice(0, 120),
            caption: textContent,
            thumbnail_url: data.img
         });
      }
    }
    videoLinks.forEach((a) => { a.dataset.favExtracted = 'true'; });
  } else if (hostname.includes('facebook.com')) {
    // Scrape Facebook Saved Items ONLY inside main content area
    const mainContainer = document.querySelector('div[role="main"]') || document.body;
    const allLinks = Array.from(mainContainer.querySelectorAll('a[href]'));
    
    // Deduplicate at the card level AND video ID level
    const processedCards = new Set();
    const processedFbIds = new Set();

    function getFbId(url) {
      let m = url.match(/\/reel\/(\d+)/);
      if (m) return m[1];
      m = url.match(/[\?&]v=(\d+)/);
      if (m) return m[1];
      m = url.match(/\/videos\/(\d+)/);
      if (m) return m[1];
      return url;
    }

    allLinks.forEach((link) => {
      const href = link.href;
      // Already handled in an earlier pass (compare href: FB may recycle nodes)
      if (incremental && link.dataset.favSeen === href) return;

      const isContentLink =
        href.includes('/reel/') ||
        href.includes('/watch/') ||
        href.includes('/posts/') ||
        href.includes('/videos/') ||
        href.includes('fb.watch');

      if (!isContentLink) {
        link.dataset.favSeen = href; // cheap skip next time
        return;
      }

      if (isContentLink) {
        const fbId = getFbId(href);
        if (processedFbIds.has(fbId)) return;

        // Facebook DOM is obfuscated. Walk up the DOM tree up to 8 levels
        // to find the master card container that holds the entire text.
        let cardParent = link;
        let foundBoundary = false;
        for (let i = 0; i < 8; i++) {
          if (cardParent.parentElement) cardParent = cardParent.parentElement;
          if (
            cardParent.innerText &&
            (cardParent.innerText.includes('Add to collection') ||
             cardParent.innerText.includes('Saved from') ||
             cardParent.innerText.includes('See more'))
          ) {
            foundBoundary = true;
            break;
          }
        }

        // If we already processed this physical card on the screen, skip it!
        if (processedCards.has(cardParent)) return;
        
        let bestHref = href;
        if (bestHref.includes('/watch/')) {
          const reelLink = cardParent.querySelector('a[href*="/reel/"]');
          if (reelLink) {
            bestHref = reelLink.href;
          }
        }

        const rawText = cardParent ? cardParent.innerText.trim() : link.innerText.trim();
        const imgEl = cardParent ? cardParent.querySelector('img[src*="fbcdn"], img[src*="scontent"], img') : null;

        // Fallback: If Facebook didn't provide a /reel/ link in the DOM, but the text says it's a Reel,
        // we force it to become a /reel/ link using the Video ID.
        if (bestHref.includes('/watch/') && (rawText.includes('Reel') || rawText.includes('reel'))) {
          const fbIdMatch = bestHref.match(/[\?&]v=(\d+)/);
          if (fbIdMatch) {
            bestHref = `https://www.facebook.com/reel/${fbIdMatch[1]}`;
          }
        }

        if (rawText && rawText.length > 5 && !seenUrls.has(bestHref)) {
          processedCards.add(cardParent);
          processedFbIds.add(fbId);
          seenUrls.add(bestHref);
          
          // The title is usually the first meaningful line in the card
          const cleanLines = rawText
            .split('\n')
            .map((line) => line.trim())
            .filter(
              (line) =>
                line.length > 2 &&
                !line.includes('Add to collection') &&
                !line.includes('Saved from') &&
                !/^\d+:\d+$/.test(line) // exclude duration like 00:53
            );

          const title = cleanLines[0] || 'Facebook Saved Content';

          items.push({
            url: bestHref,
            platform: 'facebook',
            content_type: bestHref.includes('/reel/') || bestHref.includes('/watch/') || bestHref.includes('/videos/') ? 'video' : 'post',
            title: title.slice(0, 120),
            caption: cleanLines.join(' | '),
            thumbnail_url: imgEl && imgEl.getAttribute('src') ? imgEl.src : undefined
          });

          // Mark as done. Only mark the whole card when we found its real
          // boundary — otherwise cardParent may be a container of many cards.
          link.dataset.favSeen = href;
          if (foundBoundary) {
            cardParent.dataset.favExtracted = 'true';
            cardParent.querySelectorAll('a[href]').forEach((a) => { a.dataset.favSeen = a.href; });
          }
        } else if (seenUrls.has(bestHref)) {
          link.dataset.favSeen = href; // duplicate link to an item we already have
        }
      }
    });
  }

  return items;
}

// Lighten already-extracted cards that are scrolled out of view, to stop Chrome
// RAM + disk-cache growth (~3GB cache trap). NON-destructive on purpose:
// we never remove nodes, because Facebook/YouTube are React/Polymer apps and
// deleting nodes they own can crash the page mid-scroll.
function cleanupProcessedCard(cardElement) {
  if (!cardElement || cardElement.dataset.favCleaned) return;
  // Keep anything still on/near screen intact
  if (cardElement.getBoundingClientRect().bottom > -200) return;
  cardElement.dataset.favCleaned = 'true';

  try {
    cardElement.querySelectorAll('img').forEach((img) => {
      img.removeAttribute('srcset');
      img.removeAttribute('src');
    });
    cardElement.querySelectorAll('video').forEach((v) => {
      try { v.pause(); } catch (e) {}
      v.removeAttribute('src');
      v.querySelectorAll('source').forEach((s) => s.removeAttribute('src'));
      try { v.load(); } catch (e) {} // releases the media buffer
    });
  } catch (e) {}
}

function cleanupScrolledCards() {
  document
    .querySelectorAll('[data-fav-extracted="true"]:not([data-fav-cleaned])')
    .forEach(cleanupProcessedCard);
}

// Upload a batch via the background service worker (extension origin → no
// CORS / Local-Network-Access issues, survives the popup being closed).
// Returns true ONLY when the server confirmed the write.
async function streamBatchToBackend(batchItems) {
  if (!batchItems || batchItems.length === 0) return true;
  try {
    const res = await chrome.runtime.sendMessage({ action: 'INGEST_BATCH', items: batchItems });
    if (res && res.ok) return true;
    console.warn('⚡ Batch upload failed, will retry:', res && res.error);
  } catch (err) {
    console.warn('⚡ Batch upload failed, will retry:', err);
  }
  return false;
}

const STREAM_BATCH_SIZE = 100;
const HEAP_PAUSE_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5GB

// Streaming Auto-Scroll Engine: uploads every 100 new items during the scroll,
// so a tab crash at item 5,000 loses nothing that was already uploaded.
async function autoScrollAndExtract(maxScrolls = 250, scrollDelay = 1200, stopOnExisting = false) {
  isAutoScrolling = true;
  let previousHeight = 0;
  let noChangeCount = 0;
  let totalSyncedCount = 0;

  const result = await new Promise(r => chrome.storage.local.get(['syncedUrls'], r));
  const syncedUrls = new Set(result.syncedUrls || []);

  const seenThisRun = new Set(); // urls only — not full items (keeps RAM flat)
  let pending = [];              // new items not yet confirmed by the server

  // Reset incremental markers from any previous run on this page
  document.querySelectorAll('[data-fav-seen]').forEach((el) => el.removeAttribute('data-fav-seen'));
  document.querySelectorAll('[data-fav-extracted]').forEach((el) => el.removeAttribute('data-fav-extracted'));

  const flush = async (all = false) => {
    while (pending.length >= STREAM_BATCH_SIZE || (all && pending.length > 0)) {
      const batch = pending.slice(0, STREAM_BATCH_SIZE);
      const ok = await streamBatchToBackend(batch);
      if (!ok) return false; // keep items in `pending`, retry on next flush
      pending = pending.slice(batch.length);
      totalSyncedCount += batch.length;
      batch.forEach((item) => syncedUrls.add(item.url));
    }
    return true;
  };

  for (let i = 0; i < maxScrolls; i++) {
    if (!isAutoScrolling) break;

    window.scrollBy(0, 2500);
    window.scrollTo(0, document.body.scrollHeight);
    const mainContainer = document.querySelector('div[role="main"]');
    if (mainContainer) {
      mainContainer.scrollBy(0, 2500);
      mainContainer.scrollTop = mainContainer.scrollHeight;
    }

    await new Promise((r) => setTimeout(r, scrollDelay));

    const newItems = extractSavedContent(true);

    let foundExistingInThisStep = false;
    for (const item of newItems) {
      if (seenThisRun.has(item.url)) continue;
      seenThisRun.add(item.url);
      if (syncedUrls.has(item.url)) {
        if (stopOnExisting) foundExistingInThisStep = true;
      } else {
        pending.push(item);
      }
    }

    if (pending.length >= STREAM_BATCH_SIZE) {
      await flush();
      cleanupScrolledCards();
    }

    // Memory guard: give the tab time to GC if the JS heap gets large
    const heap = performance.memory && performance.memory.usedJSHeapSize;
    if (heap && heap > HEAP_PAUSE_BYTES) {
      cleanupScrolledCards();
      await new Promise((r) => setTimeout(r, 5000));
    }

    try {
      chrome.runtime.sendMessage({
        action: 'SCROLL_PROGRESS',
        scrapedCount: seenThisRun.size,
        syncedCount: totalSyncedCount,
        pendingCount: pending.length,
        scrollStep: i + 1,
        maxScrolls: maxScrolls
      });
    } catch (e) {}

    if (stopOnExisting && foundExistingInThisStep) {
      console.log('⚡ Found already synced item! Stopping auto-scroll early (Sync New Only mode).');
      break;
    }

    const currentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      mainContainer ? mainContainer.scrollHeight : 0
    );

    if (currentHeight === previousHeight) {
      noChangeCount++;
      if (noChangeCount >= 10) {
        console.log('⚡ Auto-scroll reached absolute bottom of loaded content.');
        break;
      }
    } else {
      noChangeCount = 0;
    }

    previousHeight = currentHeight;
  }

  // Final flush (background already retries 3x per batch); one more pass here
  if (!(await flush(true))) {
    await new Promise((r) => setTimeout(r, 3000));
    await flush(true);
  }
  cleanupScrolledCards();

  isAutoScrolling = false;
  return {
    totalFound: seenThisRun.size,
    totalSyncedCount,
    failedItems: pending, // anything the server never confirmed
  };
}

// Listen for popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'STOP_SCROLL') {
    isAutoScrolling = false;
    sendResponse({ status: 'stopped' });
    return true;
  }

  if (request.action === 'SCRAPE_SAVED') {
    const extractedData = extractSavedContent();

    chrome.storage.local.get(['syncedUrls'], (result) => {
      const syncedUrls = new Set(result.syncedUrls || []);
      const newItems = extractedData.filter((item) => !syncedUrls.has(item.url));

      sendResponse({
        totalFound: extractedData.length,
        newItemsCount: newItems.length,
        items: extractedData,
        newItems: newItems
      });
    });
  } else if (request.action === 'AUTO_SCROLL_AND_SCRAPE') {
    autoScrollAndExtract(request.maxScrolls || 250, 1200, request.stopOnExisting || false).then((res) => {
      // Small response: counts + only the items that still need sending
      sendResponse({
        streamed: true,
        totalFound: res.totalFound,
        totalSyncedCount: res.totalSyncedCount,
        failedItems: res.failedItems,
      });
    });
    return true; // Keep channel open for async response
  }
  return true;
});

