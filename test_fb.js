async function test() {
  const url = 'https://www.facebook.com/reel/1108673294940876';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
  const html = await res.text();
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i) || html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
  
  console.log('Title:', titleMatch ? titleMatch[1] : null);
  console.log('Desc:', descMatch ? descMatch[1] : null);
}
test();
