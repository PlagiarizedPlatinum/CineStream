/**
 * ReelWave Service Worker — Navigation Shield v4
 *
 * Core responsibility: intercept ALL top-level navigation requests.
 * When an iframe calls window.top.location = 'https://ad.com', the browser
 * fires a top-level navigate fetch event — we catch it here and block it.
 *
 * We also block all requests to known ad network domains.
 *
 * What we do NOT block: sub-resource loads from embed providers (scripts, images,
 * video segments) — those pass through so the player actually works.
 */

'use strict';

const SW_VERSION = 'rw-shield-4';

// ── Our own origin (set at install time) ────────────────────────────────────
const SELF_ORIGIN = self.location.origin;

// ── Domains that are allowed to be navigated TO (top-level page changes) ────
// Anything not in this set that tries to become the top-level document = blocked.
// We keep this intentionally TIGHT — only our own origin should ever be
// a top-level navigation target during normal app use.
const ALLOWED_TOP_ORIGINS = new Set([
  SELF_ORIGIN,
]);

// ── Hard-blocked domains — ALL request types from these are dropped ──────────
const BLOCKED_HOSTNAMES = new Set([
  'doubleclick.net',
  'googlesyndication.com',
  'pagead2.googlesyndication.com',
  'tpc.googlesyndication.com',
  'securepubads.g.doubleclick.net',
  'adnxs.com',
  'adroll.com',
  'rubiconproject.com',
  'openx.net',
  'pubmatic.com',
  'exoclick.com',
  'trafficjunky.net',
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'adsterra.com',
  'adcash.com',
  'juicyads.com',
  'yllix.com',
  'evadav.com',
  'richpush.co',
  'coinzilla.io',
  'a-ads.com',
  'revcontent.com',
  'taboola.com',
  'mgid.com',
  'hilltopads.net',
  'clickadu.com',
  'zeropark.com',
  'adform.net',
  'adkernel.com',
  '33across.com',
  'smartadserver.com',
  'criteo.com',
  'appnexus.com',
  'lijit.com',
  'sovrn.com',
  'bidswitch.net',
  'media.net',
  'yieldmo.com',
  'sharethrough.com',
  'undertone.com',
  'conversantmedia.com',
  'amazon-adsystem.com',
  'adskeeper.com',
  'adtelligent.com',
  'advertising.com',
  '2mdn.net',
  'googletagmanager.com',
  'googletagservices.com',
  'quantserve.com',
  'scorecardresearch.com',
  'outbrain.com',
  'zemanta.com',
  'adservice.google.com',
]);

// Check if a hostname matches blocked list (including subdomains)
function isBlocked(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  // Check parent domains: sub.exoclick.com → exoclick.com
  const parts = hostname.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (BLOCKED_HOSTNAMES.has(parent)) return true;
  }
  return false;
}

// Blank 204 response for blocked sub-resources
const BLOCKED_RESPONSE = new Response('', {
  status: 204,
  statusText: 'Blocked by ReelWave Shield',
  headers: { 'X-RW-Blocked': '1' },
});

// Blocked redirect page for top-level navigation attempts
function blockedPage(hostname) {
  return new Response(
    `<!DOCTYPE html><html><head>
    <title>Blocked</title>
    <style>
      body { background: #07090d; color: #e8c96d; font-family: sans-serif;
             display: flex; align-items: center; justify-content: center;
             min-height: 100vh; flex-direction: column; gap: 12px; margin: 0; }
      h1 { font-size: 16px; letter-spacing: 2px; margin: 0; }
      p  { color: #5a6478; font-size: 12px; margin: 0; }
      a  { color: #e8c96d; }
    </style>
    </head><body>
    <h1>🛡 AD REDIRECT BLOCKED</h1>
    <p>Attempted redirect to: <strong style="color:#c4522a">${hostname}</strong></p>
    <p><a href="javascript:history.back()">← Go back</a></p>
    <script>
      // Auto-close if we're in an iframe context — shouldn't happen but just in case
      if (window.parent !== window) {
        try { window.parent.postMessage({ type: 'RW_BLOCKED', hostname: '${hostname}' }, '*'); } catch(_) {}
      }
      // Try to go back after a tiny delay
      setTimeout(() => { try { history.back(); } catch(_) {} }, 100);
    <\/script>
    </body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-RW-Blocked': '1',
        'Cache-Control': 'no-store',
      },
    }
  );
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
  console.log('[SW] ReelWave Shield', SW_VERSION, 'installing');
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  console.log('[SW] ReelWave Shield', SW_VERSION, 'activated');
  e.waitUntil(self.clients.claim());
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req  = e.request;
  const url  = req.url;
  const mode = req.mode;      // 'navigate' | 'cors' | 'no-cors' | 'same-origin'
  const dest = req.destination; // 'document' | 'script' | 'image' | etc.

  // Skip non-http(s) — chrome-extension://, data:, blob:, etc.
  if (!url.startsWith('http')) return;

  let hostname = '';
  try { hostname = new URL(url).hostname.toLowerCase(); } catch(_) { return; }

  // ── Block all requests to known ad domains ──────────────────────────────────
  if (isBlocked(hostname)) {
    e.respondWith(Promise.resolve(BLOCKED_RESPONSE.clone()));
    return;
  }

  // ── Intercept top-level document navigations ────────────────────────────────
  // mode === 'navigate' AND dest === 'document' means someone is trying to
  // make this URL the new top-level page. If it's not our own origin, block it.
  if (mode === 'navigate' && dest === 'document') {
    let reqOrigin = '';
    try { reqOrigin = new URL(url).origin; } catch(_) {}

    // Allow our own origin and normal browser navigation (direct URL bar entry)
    if (ALLOWED_TOP_ORIGINS.has(reqOrigin)) {
      // Pass through — this is normal navigation within our app
      return;
    }

    // Check if this navigation was initiated by a client (iframe redirect attack)
    // We check the Referer: if it's from our own origin, it's an iframe trying to escape
    const referer = req.headers.get('referer') || '';
    let refOrigin = '';
    try { refOrigin = referer ? new URL(referer).origin : ''; } catch(_) {}

    if (refOrigin === SELF_ORIGIN) {
      // Navigation FROM our site TO an external domain — this is an ad redirect
      console.warn('[SW] Blocked iframe redirect to:', url);
      e.respondWith(blockedPage(hostname));
      return;
    }

    // Also block if the URL itself hits a known ad domain
    if (isBlocked(hostname)) {
      e.respondWith(blockedPage(hostname));
      return;
    }

    // Otherwise pass through (direct navigation, back/forward, etc.)
    return;
  }

  // All other requests pass through unchanged — we don't want to impact
  // video loading, API calls, or any legitimate content
});

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', e => {
  const data = e.data;
  if (data === 'PING' || data?.type === 'PING') {
    e.source?.postMessage({ type: 'PONG', version: SW_VERSION });
    return;
  }
  if (data === 'SKIP_WAITING' || data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
