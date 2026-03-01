# ReelWave

Netflix-style streaming frontend. Deploy to Vercel in one click.

## Folder Structure

```
reelwave/
├── vercel.json          ← Vercel config
├── api/                 ← Serverless edge functions
│   ├── config.js
│   ├── proxy.js
│   ├── tmdb.js
│   └── frame.js
└── public/              ← Static files
    ├── index.html
    ├── title.html
    ├── sw.js
    └── robots.txt
```

## Deploy

1. Push to GitHub → Import in vercel.com
2. Set env vars: `PW_HASH` (SHA-256 of your password), `TMDB_API_KEY`
3. Deploy

## Generate PW_HASH

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
  .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
```
