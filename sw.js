/**
 * ReelWave Service Worker — Navigation Shield v3
 * 
 * This SW intercepts every fetch/navigate request made by the page AND its iframes.
 * Any attempt to navigate the top-level frame to an external ad domain is cancelled.
 * 
 * Install & activate immediately (skipWaiting + clients.claim).
 */

'use strict';

const SW_VERSION = 'rw-shield-3';

// ── Allowlist: domains that are ALWAYS permitted to navigate ──────────────────
// These are our own embed providers. Everything else that tries to navigate
// the top frame gets blocked.
const ALLOWED_NAVIGATE_ORIGINS = new Set([
  self.location.origin,          // our own site
  'https://vidsrc.cc',
  'https://vidsrc.to',
  'https://vidsrc.me',
  'https://player.autoembed.cc',
  'https://multiembed.mov',
  'https://embed.su',
  'https://vidlink.pro',
  'https://streamed.su',
  'https://streamed.pk',
  'https://image.tmdb.org',
  'https://api.themoviedb.org',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.jsdelivr.net',
]);

// ── Known ad / redirect domains — explicitly blocked ─────────────────────────
const BLOCKED_DOMAINS = [
  'doubleclick.net','googlesyndication.com','adnxs.com','adroll.com',
  'rubiconproject.com','openx.net','pubmatic.com','exoclick.com',
  'trafficjunky.net','popads.net','popcash.net','propellerads.com',
  'adsterra.com','adcash.com','juicyads.com','yllix.com','evadav.com',
  'richpush.co','coinzilla.io','a-ads.com','revcontent.com','taboola.com',
  'mgid.com','hilltopads.net','clickadu.com','zeropark.com','adform.net',
  'adkernel.com','33across.com','smartadserver.com','criteo.com',
  'appnexus.com','lijit.com','sovrn.com','bidswitch.net','media.net',
  'yieldmo.com','sharethrough.com','undertone.com','conversantmedia.com',
  'amazon-adsystem.com','adskeeper.com','adtelligent.com','adingo.jp',
  'advertising.com','2mdn.net','googletagmanager.com','googletagservices.com',
  'quantserve.com','scorecardresearch.com','outbrain.com','zemanta.com',
  'ads.yahoo.com','ads.twitter.com','adsystem.amazon.com',
  'adservice.google.com','pagead2.googlesyndication.com',
  'tpc.googlesyndication.com','securepubads.g.doubleclick.net',
];

function isDomainBlocked(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch(_) { return false; }
}

function isOriginAllowed(url) {
  try {
    const origin = new URL(url).origin;
    return ALLOWED_NAVIGATE_ORIGINS.has(origin);
  } catch(_) { return false; }
}

// ── Install: skip waiting so SW activates immediately ────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── Activate: claim all clients immediately ───────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

// ── Fetch: intercept every request ───────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = req.url;
  const mode = req.mode;
  const dest = req.destination;

  // Block explicitly known ad domains regardless of request type
  if (isDomainBlocked(url)) {
    e.respondWith(new Response('', { status: 204, statusText: 'Blocked by ReelWave Shield' }));
    return;
  }

  // Block top-level navigations to non-allowlisted origins
  // This is the key protection: when an iframe tries window.top.location = 'https://ad.com',
  // the browser fires a top-level navigate fetch — we intercept and cancel it.
  if (mode === 'navigate' && dest === 'document') {
    if (!isOriginAllowed(url) && !url.startsWith(self.location.origin)) {
      console.warn('[SW] Blocked top-level navigation to:', url);
      // Return a blank page with a message instead of allowing the redirect
      e.respondWith(new Response(
        `<!DOCTYPE html><html><head><title>Blocked</title>
        <style>body{background:#07090d;color:#e8c96d;font-family:sans-serif;display:flex;
        align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}
        h1{font-size:18px;letter-spacing:2px}p{color:#5a6478;font-size:13px}</style></head>
        <body><h1>🛡 REDIRECT BLOCKED</h1>
        <p>ReelWave Shield blocked an ad redirect to: ${new URL(url).hostname}</p>
        <p><a href="/" style="color:#e8c96d">← Back to ReelWave</a></p></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      ));
      return;
    }
  }

  // For all other requests, pass through normally (no performance impact on legit content)
});

// ── Message handler: receive signals from page ────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'PING') {
    e.source?.postMessage('PONG');
  }
});
