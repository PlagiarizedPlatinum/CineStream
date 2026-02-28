/**
 * ReelWave — Navigation & Ad Shield Service Worker v5
 *
 * THE CRITICAL FIX vs v4:
 * v4 only blocked navigations where referer === our origin.
 * That missed iframe->top redirects because the browser sends the EMBED's
 * origin as the referer, not ours.
 *
 * v5 blocks ALL top-level document navigations to any origin that is not
 * our own. This is safe because this is a single-page app — the only
 * legitimate top-level navigations are within reelwave.vercel.app itself.
 * Every other navigation attempt is an ad redirect and gets killed.
 */

'use strict';

const SW_VERSION = 'rw-v5';
const SELF_ORIGIN = self.location.origin;

/* ─────────────────────────────────────────────────────────────────────────────
   BLOCKED HOSTNAMES — every request to these returns an empty response
   Covers every major ad network, popunder, tracker, redirect service
───────────────────────────────────────────────────────────────────────────── */
const BLOCKED = new Set([
  // Display ad networks
  'doubleclick.net','googlesyndication.com','pagead2.googlesyndication.com',
  'tpc.googlesyndication.com','securepubads.g.doubleclick.net',
  'adservice.google.com','googleadservices.com','google-analytics.com',
  'adnxs.com','adroll.com','advertising.com','2mdn.net',
  'rubiconproject.com','openx.net','openx.com','pubmatic.com',
  'appnexus.com','yieldmo.com','sharethrough.com','undertone.com',
  'conversantmedia.com','lijit.com','sovrn.com','bidswitch.net',
  'smartadserver.com','33across.com','adkernel.com','adform.net',
  'criteo.com','media.net','amazon-adsystem.com','adsystem.amazon.com',
  // Popunder/popup/redirect specialists
  'brightadnetwork.com','brightadnetwork.net','brightadd.com',
  'exoclick.com','exoclick.net',
  'trafficjunky.net','trafficjunky.com',
  'popads.net','popcash.net',
  'propellerads.com','propeller-ads.com','propeller.network',
  'adsterra.com','adsterra.network',
  'adcash.com','juicyads.com','juicyads.net',
  'yllix.com','evadav.com','evadav.net',
  'richpush.co','richpush.net',
  'coinzilla.io','coinzilla.com',
  'a-ads.com','a-ads.net',
  'revcontent.com','mgid.com',
  'hilltopads.net','hilltopads.com',
  'clickadu.com','zeropark.com',
  'adskeeper.com','adtelligent.com',
  'taboola.com','outbrain.com',
  'plugrush.com','plugrush.net',
  'go2speed.org','go2speed.net',
  'clkrev.com','clksite.com','clknow.com','clkbid.com',
  'cointraffic.io','bitmedia.io','coinimp.com',
  'popunder.net','popundernet.com',
  'trafficshop.com','trafficshop.pro',
  'trafficstars.com','trafficstars.net',
  'trafficforce.com','trafficfactory.biz',
  'lkqd.net','lkqd.com',
  'ero-advertising.com',
  'waroadvertising.com','waroadv.com',
  'mobvista.com','mintegral.com',
  'ironsrc.com','ironsource.com',
  // Tracking / analytics used for ad profiling
  'quantserve.com','scorecardresearch.com','comscore.com',
  'googletagmanager.com','googletagservices.com',
  'zemanta.com','adsafeprotected.com','moatads.com','moat.com',
  'doubleverify.com','innovid.com','eyeota.com',
  'bluekai.com','lotame.com','demdex.net',
  'casalemedia.com','contextweb.com','pulsepoint.com',
  'mediamath.com','turn.com','dataxu.com',
  'rlcdn.com','semasio.net','intentiq.com',
  // Cryptomining
  'coinhive.com','cryptoloot.pro','minero.cc','webminepool.com',
]);

function isBlocked(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase().replace(/^www\./, '');
  if (BLOCKED.has(hostname)) return true;
  const parts = hostname.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    if (BLOCKED.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESPONSES
───────────────────────────────────────────────────────────────────────────── */
function silentBlock() {
  return new Response('', {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'X-RW': 'blocked', 'Cache-Control': 'no-store' },
  });
}

function blockedNavPage(blockedUrl) {
  let hostname = '';
  try { hostname = new URL(blockedUrl).hostname; } catch(_) { hostname = blockedUrl; }
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Blocked</title>' +
    '<script>try{if(history.length>1){history.back()}else{location.replace("/")}}catch(e){location.replace("/")}' +
    '<\/script></head>' +
    '<body style="background:#07090d;color:#e8c96d;font-family:sans-serif;display:flex;' +
    'align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px">' +
    '<div style="font-size:32px">&#x1F6E1;</div>' +
    '<div style="font-size:14px;letter-spacing:2px">AD REDIRECT BLOCKED</div>' +
    '<div style="font-size:11px;color:#5a6478">' + hostname + '</div>' +
    '</body></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-RW': 'nav-blocked' },
    }
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LIFECYCLE
───────────────────────────────────────────────────────────────────────────── */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION }))
      )
    )
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   FETCH — CORE INTERCEPTION
───────────────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', e => {
  const req  = e.request;
  const url  = req.url;
  const mode = req.mode;
  const dest = req.destination;

  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  let parsed, hostname, origin;
  try {
    parsed   = new URL(url);
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    origin   = parsed.origin;
  } catch(_) { return; }

  // RULE 1: Block all requests to known ad/tracker domains
  if (isBlocked(hostname)) {
    e.respondWith(silentBlock());
    return;
  }

  // RULE 2: Block ALL top-level navigations to non-self origins.
  //
  // This is a SPA. The browser tab should NEVER navigate away from our origin.
  // If ANY script (inside iframe or not) tries to navigate the top frame to an
  // external URL, it gets caught here and replaced with a "going back" page.
  //
  // We do NOT rely on referer — that was v4's fatal flaw.
  // We block unconditionally on: mode=navigate, dest=document, origin!=self.
  if (mode === 'navigate' && dest === 'document') {
    if (origin !== SELF_ORIGIN) {
      console.warn('[SW v5] BLOCKED top-level nav to:', url);
      e.respondWith(blockedNavPage(url));
      return;
    }
    return; // Allow navigation within our own origin
  }

  // RULE 3: Block iframe/frame sub-resource loads to ad domains
  if ((dest === 'iframe' || dest === 'frame') && isBlocked(hostname)) {
    e.respondWith(silentBlock());
    return;
  }

  // Everything else: pass through (video, APIs, scripts from embed providers)
});

self.addEventListener('message', e => {
  const d = e.data;
  if (!d) return;
  if (d === 'PING' || d.type === 'PING') {
    e.source && e.source.postMessage({ type: 'PONG', version: SW_VERSION });
  }
  if (d === 'SKIP_WAITING' || d.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
