/**
 * /api/tmdb — ReelWave TMDB Server-Side Proxy
 *
 * Keeps the TMDB API key off the client bundle.
 * Adds server-side caching via Vercel's CDN (s-maxage).
 * Falls back to the hardcoded key if the env var isn't set.
 *
 * Usage: /api/tmdb?path=/movie/popular&page=2
 *        /api/tmdb?path=/search/multi&query=inception&page=1
 *        /api/tmdb?path=/tv/1399/season/1
 */

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Strict path validation — only allow TMDB API paths
  if (!/^\/[a-zA-Z0-9_\-\/]+$/.test(path)) {
    return new Response(JSON.stringify({ error: 'Invalid path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build TMDB request — pass through all query params except 'path'
  const TMDB_KEY = process.env.TMDB_API_KEY || '8265bd1679663a7ea12ac168da84d2e8';
  const upstream = new URLSearchParams({ api_key: TMDB_KEY, language: 'en-US' });

  // Forward allowed query params to TMDB
  const ALLOWED_PARAMS = ['page','query','with_genres','sort_by','region',
                          'with_original_language','year','primary_release_year',
                          'season_number','episode_number','append_to_response'];
  for (const p of ALLOWED_PARAMS) {
    const v = searchParams.get(p);
    if (v) upstream.set(p, v);
  }

  const tmdbUrl = `https://api.themoviedb.org/3${path}?${upstream}`;

  try {
    const res = await fetch(tmdbUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'ReelWave/6.0' },
      cf: { cacheTtl: 300, cacheEverything: true }, // Cloudflare edge cache
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `TMDB error ${res.status}` }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.text();

    // Determine cache time based on path type
    const isSearch   = path.includes('/search/');
    const isTrending = path.includes('/trending/');
    const isStatic   = path.includes('/genre/') || path.includes('/configuration');
    const sMaxAge    = isStatic ? 86400 : isSearch ? 60 : isTrending ? 120 : 300;

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}`,
        'Access-Control-Allow-Origin': '*',
        'X-RW-Source': 'tmdb-proxy',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Proxy failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
