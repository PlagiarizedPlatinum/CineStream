// Vercel serverless function: /api/proxy
// Proxies requests to streamed.pk API server-side, bypassing CORS/referer restrictions.
// Usage: /api/proxy?url=https://streamed.pk/api/stream/alpha/match123

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Restrict to streamed.pk only — never allow arbitrary URL proxying
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const allowedHosts = ['streamed.pk', 'streamed.su'];
  if (!allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Referer': 'https://streamed.su/',
        'Origin': 'https://streamed.su',
        'Accept': 'application/json, */*',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream error: ${upstream.status}` });
    }

    const data = await upstream.json();

    // Cache for 30 seconds for match lists, 10 seconds for streams
    const isStream = url.includes('/stream/');
    res.setHeader('Cache-Control', `public, s-maxage=${isStream ? 10 : 30}, stale-while-revalidate=60`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Proxy fetch failed' });
  }
}