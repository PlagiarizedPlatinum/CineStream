# ReelWave — Deploy to Vercel

## Folder Structure
```
reelwave/
├── vercel.json          ← config (outputDirectory: "public")
├── api/                 ← serverless functions
│   ├── config.js
│   ├── proxy.js
│   ├── tmdb.js
│   └── frame.js
└── public/
    ├── index.html
    ├── title.html
    ├── sw.js
    └── robots.txt
```

## Deploy
1. Push to GitHub → import at vercel.com
2. Env vars: `PW_HASH` (SHA-256 of password), `TMDB_API_KEY` (optional)

## Generate PW_HASH
```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
  .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
```
