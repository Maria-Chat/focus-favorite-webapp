import { NextRequest, NextResponse } from 'next/server';
import { create } from 'youtube-dl-exec';
import path from 'path';

// Force youtube-dl-exec to use our downloaded binary instead of the bundled one
const youtubedl = create(path.join(process.cwd(), 'bin', 'yt-dlp_macos'));

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    let directUrl = '';
    let finalUrl = url;

    // Resolve short TikTok URLs first (tikwm fails on short URLs)
    if (finalUrl.includes('vt.tiktok.com') || finalUrl.includes('vm.tiktok.com')) {
      try {
        const redirectRes = await fetch(finalUrl, { redirect: 'follow' });
        finalUrl = redirectRes.url;
      } catch (e) {
        console.warn('Failed to resolve TikTok redirect', e);
      }
    }

    // Clean the URL by removing query parameters before sending to tikwm
    const cleanUrl = finalUrl.split('?')[0];

    // If it's a TikTok URL, attempt to use the tikwm API to bypass local IP rate limits
    if (cleanUrl.includes('tiktok.com')) {
      try {
        let tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
        let tikwmData = await tikwmRes.json();
        
        // tikwm free tier limits to 1 req/sec. If hit, wait 1.2s and retry once.
        if (tikwmData.code === -1) {
          console.warn('tikwm API rate limit hit, retrying after 1.2s...');
          await new Promise(resolve => setTimeout(resolve, 1200));
          tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
          tikwmData = await tikwmRes.json();
        }

        if (tikwmData && tikwmData.data && tikwmData.data.play) {
          directUrl = tikwmData.data.play;
        } else if (tikwmData.code === -1) {
          console.warn('tikwm API rate limit or error even after retry:', tikwmData.msg);
        }
      } catch (e) {
        console.warn('tikwm API failed, falling back to yt-dlp', e);
      }
    }

    // Fallback to yt-dlp if directUrl is still not found
    if (!directUrl) {
      // Use Promise.race to enforce a strict 8-second timeout so the UI doesn't hang forever if IP is blocked
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Video extraction timed out (IP rate limited)")), 8000)
      );

      const result = await Promise.race([
        youtubedl(cleanUrl, {
          getUrl: true,
          noCheckCertificates: true,
          noWarnings: true,
          socketTimeout: 8,
          addHeader: [
            'referer:youtube.com',
            'user-agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          ]
        }),
        timeoutPromise
      ]);

      directUrl = typeof result === 'string' ? result.trim() : (result as any).url;
    }

    if (!directUrl) {
      throw new Error('Failed to extract direct URL');
    }

    // Usually yt-dlp returns multiple URLs if there are multiple formats. We take the first one.
    const firstUrl = directUrl.split('\n')[0];

    return NextResponse.json({ directUrl: firstUrl });
  } catch (error: any) {
    console.error('Failed to extract video URL:', error);
    return NextResponse.json({ error: error.message || 'Extraction failed' }, { status: 500 });
  }
}
