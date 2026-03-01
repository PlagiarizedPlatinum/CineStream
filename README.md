# ReelWave v2 — Deploy to Vercel + Neon DB

## Folder Structure
```
reelwave/
├── package.json         ← npm deps (jose, @neondatabase/serverless)
├── vercel.json          ← routes & headers
├── api/
│   ├── auth.js          ← register / login / logout / verify
│   ├── user.js          ← cloud sync for settings, watchlist, continues
│   ├── config.js        ← serves PW_HASH to client
│   ├── proxy.js         ← sports stream proxy
│   ├── tmdb.js          ← TMDB API proxy
│   └── frame.js         ← frame helper
└── public/
    ├── index.html       ← main app (account system built-in)
    ├── title.html
    ├── sw.js
    └── robots.txt
```

## Quick Deploy

1. **Push to GitHub** → import at [vercel.com](https://vercel.com)
2. **Set environment variables** in Vercel dashboard:

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string | ✅ Yes |
| `JWT_SECRET` | Random secret for signing tokens (min 32 chars) | ✅ Yes |
| `PW_HASH` | SHA-256 of site-wide access code (optional fallback) | ⬜ Optional |
| `TMDB_API_KEY` | TMDB key for better rate limits | ⬜ Optional |

## Neon Database Setup

1. Go to [neon.tech](https://neon.tech) → Create a free project
2. Copy the **Connection string** (starts with `postgresql://...`)
3. Paste it as `DATABASE_URL` in Vercel env vars

**Tables are auto-created** on first request — no manual SQL needed.

## Generate JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Generate PW_HASH (optional access code)

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
  .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
```

## Account System

- **Email/password accounts** — stored in Neon, synced across devices
- **Global access code** — site-wide password via `PW_HASH` env var (uses localStorage only)
- **Offline support** — stored token allows access if network is down
- **Synced data** — watchlist, continue-watching, stream source & accent color

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth?action=register` | POST | Create account `{email, password}` |
| `/api/auth?action=login` | POST | Login `{email, password}` |
| `/api/auth?action=logout` | POST | Invalidate session token |
| `/api/auth?action=verify` | GET | Verify token (Authorization header) |
| `/api/user?field=all` | GET | Get all user data |
| `/api/user?field=settings` | POST | Save settings |
| `/api/user?field=watchlist` | POST | Save watchlist |
| `/api/user?field=continues` | POST | Save continue-watching |
