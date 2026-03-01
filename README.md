# ReelWave

Netflix-style streaming frontend. Deploy to Vercel in one click.

## Folder Structure
```
reelwave/
├── vercel.json          ← Vercel config (outputDirectory: "public")
├── api/                 ← Serverless edge functions
│   ├── config.js        ← PW_HASH env var endpoint
│   ├── proxy.js         ← Sports API CORS proxy (streamed.pk)
│   ├── tmdb.js          ← TMDB API proxy
│   └── frame.js         ← Iframe/embed proxy
└── public/              ← Static files served by Vercel
    ├── index.html       ← Home (movies, TV, sports, watchlist)
    ├── title.html       ← Detail page (/title?id=…&type=…)
    ├── sw.js            ← Service Worker ad blocker
    └── robots.txt
```

## Deploy
1. Push to GitHub → Import at vercel.com
2. Set env vars:
   - `PW_HASH` — SHA-256 of your password
   - `TMDB_API_KEY` — TMDB v3 key (optional)

## Generate PW_HASH
```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
  .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
```
