/**
 * /api/proxy — ReelWave Sports Proxy v6
 * Handles JSON API calls AND HLS stream proxying (M3U8 + TS segments).
 */
export const config = { runtime: 'edge' };

const MIRRORS = ['https://streamed.pk','https://streamed.su','https://streamed.me'];
const ALLOWED = ['streamed.pk','streamed.su','streamed.me','embedme.top'];

const HDR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer':    'https://streamed.pk/',
  'Origin':     'https://streamed.pk',
  'Accept':     '*/*',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers':'Content-Length, Content-Range',
};

function allowed(h) {
  return ALLOWED.some(a => h === a || h.endsWith('.' + a));
}

function rewriteMirror(url, base) {
  try { const u = new URL(url); return base + u.pathname + u.search; } catch(_) { return url; }
}

function rewriteM3u8(text, baseUrl) {
  const base = baseUrl.replace(/\/[^/]*$/, '/');
  return text
    // Rewrite sub-playlists (.m3u8 lines)
    .replace(/^(?!#)(.+\.m3u8.*)$/gm, line => {
      try { return `/api/proxy?url=${encodeURIComponent(new URL(line.trim(), base).href)}`; }
      catch(_) { return line; }
    })
    // Rewrite segment lines (.ts)
    .replace(/^(?!#)(.+\.ts.*)$/gm, line => {
      try { return `/api/proxy?url=${encodeURIComponent(new URL(line.trim(), base).href)}`; }
      catch(_) { return line; }
    })
    // Rewrite URI="..." in #EXT-X-KEY, #EXT-X-MAP etc.
    .replace(/URI="([^"]+)"/g, (m, uri) => {
      try { return `URI="/api/proxy?url=${encodeURIComponent(new URL(uri, base).href)}"`; }
      catch(_) { return m; }
    });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const reqUrl = new URL(req.url);
  const url = reqUrl.searchParams.get('url');
  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  let parsed;
  try { parsed = new URL(url); } catch(_) {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  if (!allowed(parsed.hostname)) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const isHLS = /\.(m3u8|ts)(\?|$)/i.test(url);
  // For HLS/TS, use exact URL. For JSON API, try all mirrors.
  const urlsToTry = isHLS ? [url] : MIRRORS.map(m => rewriteMirror(url, m));

  const fetchHdrs = { ...HDR };
  const range = req.headers.get('Range');
  if (range) fetchHdrs['Range'] = range;

  for (const tryUrl of urlsToTry) {
    try {
      const res = await fetch(tryUrl, { headers: fetchHdrs, redirect: 'follow' });
      if (!res.ok) continue;

      const ct = (res.headers.get('Content-Type') || '').toLowerCase();
      const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8(\?|$)/i.test(tryUrl);

      if (isM3u8) {
        const body = await res.text();
        const rewritten = rewriteM3u8(body, tryUrl);
        return new Response(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache, no-store',
            ...CORS,
          },
        });
      }

      // TS segment or JSON — stream body directly
      const isTsSegment = /\.ts(\?|$)/i.test(tryUrl);
      const contentType = isTsSegment ? 'video/mp2t' : (ct || 'application/json');
      const cacheControl = isTsSegment ? 'no-cache' : 'public,s-maxage=30,stale-while-revalidate=60';

      return new Response(res.body, {
        status: res.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          'X-RW-Mirror': tryUrl,
          ...CORS,
        },
      });
    } catch(_) {}
  }

  return new Response(JSON.stringify({ error: 'All mirrors unreachable' }), {
    status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}