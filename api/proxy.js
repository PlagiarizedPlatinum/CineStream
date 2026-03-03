/**
 * /api/proxy — ReelWave Multi-Sports Stream Proxy v3
 *
 * Fixes "streamed.pk refused to connect" by automatically rotating
 * through mirror domains when the primary host blocks Vercel edge IPs.
 *
 * Mirror rotation order:
 *   streamed.su  (primary — most permissive with server IPs)
 *   streamed.me  (secondary mirror)
 *   streamed.pk  (original — often blocks cloud IPs)
 *   embedme.top  (fallback)
 */

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = [
  'streamed.pk',
  'streamed.su',
  'streamed.me',
  'embedme.top',
];

// Mirror domains for the sports API — tried in order
const SPORTS_MIRRORS = [
  'https://streamed.su',
  'https://streamed.me',
  'https://streamed.pk',
];

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://streamed.su/',
  'Origin': 'https://streamed.su',
  'Accept': 'application/json, */*',
};

function rewriteToMirror(originalUrl, mirrorBase) {
  const parsed = new URL(originalUrl);
  return mirrorBase + parsed.pathname + parsed.search;
}

async function fetchWithMirrorRotation(originalUrl) {
  const isSportsApi = /\/(api\/matches|api\/stream|api\/images)/.test(originalUrl);

  if (isSportsApi) {
    for (const mirror of SPORTS_MIRRORS) {
      const mirrorUrl = rewriteToMirror(originalUrl, mirror);
      try {
        const res = await fetch(mirrorUrl, {
          headers: REQUEST_HEADERS,
          redirect: 'follow',
        });
        if (res.ok) return { res, usedUrl: mirrorUrl };
      } catch (_) {
        // Try next mirror
      }
    }
    throw new Error('All mirrors failed');
  } else {
    const res = await fetch(originalUrl, {
      headers: REQUEST_HEADERS,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Upstream error: ${res.status}`);
    return { res, usedUrl: originalUrl };
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsed;
  try { parsed = new URL(url); }
  catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isAllowedHost(parsed.hostname)) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { res, usedUrl } = await fetchWithMirrorRotation(url);

    const contentType = res.headers.get('Content-Type') || 'application/json';
    const body = await res.text();

    const isStream = url.includes('/stream/');
    const isImage  = url.includes('/images/');
    const sMaxAge  = isImage ? 3600 : isStream ? 15 : 45;

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}`,
        'Access-Control-Allow-Origin': '*',
        'X-RW-Source': 'sports-proxy',
        'X-RW-Mirror': usedUrl,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'All mirrors failed' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
