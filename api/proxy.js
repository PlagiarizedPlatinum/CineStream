/**
 * /api/proxy — ReelWave Multi-Sports Stream Proxy v2
 *
 * Proxies requests to sports streaming APIs server-side,
 * bypassing CORS and referer restrictions.
 *
 * Supported hosts:
 *   streamed.pk  — football + all sports
 *   streamed.su  — football mirror
 *   embedme.top  — multi-sport streams
 *
 * Usage: /api/proxy?url=https://streamed.pk/api/matches/football
 *        /api/proxy?url=https://streamed.pk/api/stream/alpha/matchid
 */

export const config = { runtime: 'edge' };

const ALLOWED_HOSTS = [
  'streamed.pk',
  'streamed.su',
  'streamed.me',
  'embedme.top',
];

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

const HEADERS_BY_HOST = {
  default: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://streamed.su/',
    'Origin': 'https://streamed.su',
    'Accept': 'application/json, */*',
  },
};

export default async function handler(req) {
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
    const upstream = await fetch(url, {
      headers: HEADERS_BY_HOST.default,
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = upstream.headers.get('Content-Type') || 'application/json';
    const body = await upstream.text();

    // Cache streams for less time than match lists
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
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Proxy fetch failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
