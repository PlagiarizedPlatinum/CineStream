/**
 * /api/proxy — ReelWave Sports Proxy v6
 * Handles JSON API calls AND HLS stream proxying (M3U8 + TS segments).
 * Used as FALLBACK only when browser can't reach streamed.pk directly.
 */
export const config = { runtime: 'edge' };

const MIRRORS  = ['https://streamed.pk','https://streamed.su','https://streamed.me'];
const ALLOWED  = ['streamed.pk','streamed.su','streamed.me','embedme.top'];
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

function rewrite(url, base) {
  try { const u = new URL(url); return base + u.pathname + u.search; } catch(_) { return url; }
}

// Rewrite M3U8 playlist so segment URLs go through our proxy too
function rewriteM3u8(text, originalBase) {
  return text.replace(/^((?!#).+\.ts.*)$/gm, (line) => {
    try {
      const absUrl = new URL(line.trim(), originalBase).href;
      return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
    } catch(_) { return line; }
  }).replace(/URI="([^"]+)"/g, (m, uri) => {
    try {
      const absUrl = new URL(uri, originalBase).href;
      return `URI="/api/proxy?url=${encodeURIComponent(absUrl)}"`;
    } catch(_) { return m; }
  }).replace(/^((?!#).+\.m3u8.*)$/gm, (line) => {
    try {
      const absUrl = new URL(line.trim(), originalBase).href;
      return `/api/proxy?url=${encodeURIComponent(absUrl)}`;
    } catch(_) { return line; }
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS } });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const url = new URL(req.url).searchParams.get('url');
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

  const isHLS = url.includes('.m3u8') || url.includes('.ts');
  const urlsToTry = isHLS ? [url] : MIRRORS.map(m => rewrite(url, m));

  const reqHdrs = { ...HDR };
  const range = req.headers.get('Range');
  if (range) reqHdrs['Range'] = range;

  for (const tryUrl of urlsToTry) {
    try {
      const res = await fetch(tryUrl, { headers: reqHdrs, redirect: 'follow' });
      if (!res.ok) continue;

      const ct = res.headers.get('Content-Type') || '';
      const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || tryUrl.includes('.m3u8');

      if (isM3u8) {
        const body = await res.text();
        const base = new URL(tryUrl).href.replace(/\/[^/]+$/, '/');
        const rewritten = rewriteM3u8(body, base);
        return new Response(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache',
            ...CORS,
          },
        });
      }

      const contentType = ct || (tryUrl.endsWith('.ts') ? 'video/mp2t' : 'application/json');
      return new Response(res.body, {
        status: res.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': isHLS ? 'no-cache' : 'public,s-maxage=30,stale-while-revalidate=60',
          'X-RW-Mirror': tryUrl,
          ...CORS,
        },
      });
    } catch(_) {}
  }

  return new Response(JSON.stringify({ error: 'All mirrors unreachable from server' }), {
    status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}