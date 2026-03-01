# ReelWave

Netflix-style streaming frontend. Deploy to Vercel in one click.

## Folder Structure

```
reelwave/
├── vercel.json          ← Vercel config (rewrites, headers, outputDirectory)
├── api/                 ← Serverless edge functions
│   ├── config.js        ← Returns PW_HASH env var to the client
│   ├── proxy.js         ← Sports streams CORS proxy (streamed.pk etc.)
│   ├── tmdb.js          ← TMDB API server-side proxy (hides API key)
│   └── frame.js         ← Iframe wrapper for video embeds
└── public/              ← Static files served by Vercel
    ├── index.html       ← Home page (movies, TV, sports, watchlist)
    ├── title.html       ← Individual title detail page (/title?id=…&type=…)
    ├── sw.js            ← Service Worker — Nuclear Ad & Redirect Shield v6
    └── robots.txt       ← Disallow all crawlers
```

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Import the repo in vercel.com
3. Set environment variables:
   - `PW_HASH` — SHA-256 hash of your chosen password
   - `TMDB_API_KEY` — Your TMDB API key (optional, has fallback)
4. Deploy — done!

## Environment Variables

| Variable      | Required | Description                                      |
|---------------|----------|--------------------------------------------------|
| `PW_HASH`     | Yes      | SHA-256 hex of your access password              |
| `TMDB_API_KEY`| No       | TMDB v3 API key (falls back to bundled key)      |

## Generate a PW_HASH

Open your browser console and run:
```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
  .then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')))
```
