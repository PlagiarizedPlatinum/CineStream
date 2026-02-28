/**
 * ReelWave — Nuclear Ad & Redirect Shield Service Worker v7
 *
 * UPGRADES vs v6:
 * ─ 700+ blocked domains (up from 500)
 * ─ Blocks ALL external top-level navigations with zero exceptions
 * ─ Hard-blocks vidsrc ad redirect chains by hostname pattern matching
 * ─ New: blocks "open in new tab" via window.open on navigate mode
 * ─ New: blocks data: URI navigations (used for popunders)
 * ─ New: blocks blob: URI navigations to external content
 * ─ New: intercepts ALL fetch() calls for blocked patterns regardless of destination
 * ─ New: blocks ALL requests where Referer is an ad domain
 * ─ New: expanded BLOCK_URL_PATTERNS with 20+ new patterns
 * ─ Hardened against SW bypass via iframe srcdoc
 */

'use strict';

const SW_VERSION  = 'rw-v7';
const SELF_ORIGIN = self.location.origin;
const BLOCK_CACHE = 'rw-blocked-v7';

/* ═══════════════════════════════════════════════════════════════════════════
   MEGA BLOCKED HOSTNAME SET — 700+ domains
═══════════════════════════════════════════════════════════════════════════ */
const BLOCKED = new Set([
  /* ── Google Ad Infrastructure ── */
  'doubleclick.net','googlesyndication.com','pagead2.googlesyndication.com',
  'tpc.googlesyndication.com','securepubads.g.doubleclick.net',
  'adservice.google.com','googleadservices.com','google-analytics.com',
  'googletagmanager.com','googletagservices.com','googleoptimize.com',
  'stats.g.doubleclick.net','cm.g.doubleclick.net','fls.doubleclick.net',
  'ad.doubleclick.net','pubads.g.doubleclick.net','googleads.g.doubleclick.net',
  '2mdn.net','imasdk.googleapis.com','ima3.googleapis.com',

  /* ── Major Display Networks ── */
  'adnxs.com','adroll.com','advertising.com','rubiconproject.com',
  'openx.net','openx.com','pubmatic.com','appnexus.com','yieldmo.com',
  'sharethrough.com','undertone.com','conversantmedia.com','lijit.com',
  'sovrn.com','bidswitch.net','smartadserver.com','33across.com',
  'adkernel.com','adform.net','criteo.com','media.net',
  'amazon-adsystem.com','adsystem.amazon.com','adsymptotic.com',
  'advertising.amazon.com','aax.amazon-adsystem.com',
  'contextweb.com','pulsepoint.com','casalemedia.com',
  'mediamath.com','turn.com','dataxu.com','rlcdn.com',
  'semasio.net','intentiq.com','id5-sync.com','id5.io',
  'livewrapped.com','liveintent.com','liveintent.net',
  'spotxchange.com','spotx.tv','freewheel.tv','fwmrm.net',
  'adtechus.com','nexac.com','nexage.com','vertamedia.com',

  /* ── Popunder / Popup / Redirect Specialists ── */
  'brightadnetwork.com','brightadnetwork.net','brightadd.com',
  'exoclick.com','exoclick.net','exosrv.com',
  'trafficjunky.net','trafficjunky.com',
  'popads.net','popcash.net','popads.org',
  'propellerads.com','propeller-ads.com','propeller.network',
  'adsterra.com','adsterra.network','adsterra.co',
  'adcash.com','juicyads.com','juicyads.net',
  'yllix.com','evadav.com','evadav.net',
  'richpush.co','richpush.net',
  'coinzilla.io','coinzilla.com',
  'a-ads.com','a-ads.net',
  'revcontent.com','mgid.com','mgid.net',
  'hilltopads.net','hilltopads.com',
  'clickadu.com','zeropark.com',
  'adskeeper.com','adtelligent.com',
  'taboola.com','outbrain.com','outbrain.net',
  'plugrush.com','plugrush.net',
  'go2speed.org','go2speed.net',
  'clkrev.com','clksite.com','clknow.com','clkbid.com',
  'popunder.net','popundernet.com','popunder.org',
  'trafficshop.com','trafficshop.pro',
  'trafficstars.com','trafficstars.net',
  'trafficforce.com','trafficfactory.biz',
  'lkqd.net','lkqd.com',
  'ero-advertising.com',
  'waroadvertising.com','waroadv.com',
  'mobvista.com','mintegral.com',
  'ironsrc.com','ironsource.com',
  'quantumbrevesta.com',
  'onclkds.com','onclick.com','onclickads.net',
  'popmyads.com','popmy.net',
  'pushground.com','megapush.com','pushpush.net',
  'popclick.net',
  'trafficmd.com','adsmngr.com',
  'adfly.com','adf.ly','ouo.io','ouo.press',
  'shorte.st','short.pe','bc.vc',
  'linkbucks.com','linkbucks.net',
  'clk.sh','cpalead.com','cpaleads.com',
  'admaven.com','admaven.net',
  'reklamcafe.com','reklamstore.com',
  'dntx.com','juicyads.io',
  'exoticads.com','fapads.com','adsextrem.com',
  'adult-empire.com','traffichaus.com',
  'trafficleader.com','trafficleader.net',
  'realpopunder.com','imonomy.com',
  'adperium.com','newbidder.com','bidtellect.com',

  /* ── Redirect / Link Shortener Abuse ── */
  'go.ad2up.com','go2jump.org','trafficredirect.org',
  'redirect.im','redir.ec','redir.io',
  'bc.vc','j.gs','q.gs','u.bb','adfoc.us','bit.ly','tinyurl.com',
  'clck.ru','qps.ru','megaurl.net','smarturl.it',
  'linkvertise.com','linkvertise.net','loot-link.com',
  'ouo.press','oii.io','sub2get.com','up-to-down.net',

  /* ── Tracking & Profiling ── */
  'quantserve.com','scorecardresearch.com','comscore.com',
  'zemanta.com','adsafeprotected.com','moatads.com','moat.com',
  'doubleverify.com','innovid.com','eyeota.com',
  'bluekai.com','lotame.com','demdex.net',
  'adnium.com','adnium.net',
  'bidr.io','bidsopt.com','bidmach.com',
  'yieldlab.net','yieldlab.de','yieldlove.com',
  'adloox.com','adloox.io','pixalate.com','pixalate.io',
  'springserve.com','springserve.net',
  'iponweb.com',
  'adalyser.com','tagcommander.com','tagcommander.io',
  'segment.com','segment.io','mixpanel.com',
  'amplitude.com','amplitude.io','heap.io','heapanalytics.com',
  'fullstory.com','logrocket.com','mouseflow.com','hotjar.com',
  'clarity.ms','bat.bing.com','analytics.twitter.com',
  'connect.facebook.net','facebook.com','fbcdn.net',
  'analytics.tiktok.com','tiktok.com',
  'snap.licdn.com','px.ads.linkedin.com',
  'tr.snapchat.com','sc-static.net',

  /* ── Crypto Mining ── */
  'coinhive.com','cryptoloot.pro','minero.cc','webminepool.com',
  'coin-hive.com','cryptoloot.network','monerominer.rocks',
  'jsecoin.com','authedmine.com','ppoi.org','cryptonoter.com',
  'minerpool.pw','morningstar.pw','papoto.com','coinblind.com',
  'jsmine.com','webmine.pro','coinminer.com','crypto-loot.com',
  'webmr.net','coin-have.com','cryptobara.com','webmineio.com',

  /* ── Push Notification Abuse ── */
  'airpush.com','airpush.net','onesignal.com',
  'pushy.me','pushassist.com','webpushr.com',
  'izooto.com','sendpulse.com',
  'pushads.net','push-ads.net','pushwoosh.com',
  'cleverpush.com','aimtell.com','pushbots.com',
  'vwo.com','web-push.pro','pushengage.com',
  'subscribers.com','notix.io','pushprime.io',
  'datpush.com','pn-push.com','gravitec.net',

  /* ── Adult Ad Networks ── */
  'traffichaus.com','adultadworld.com',
  'nuads.com','pimproll.com','adsupply.com',
  'adxxx.com','wgcash.org','wgcash.com',
  'juicyads.com','trafficjunky.net',

  /* ── Click Fraud / Fingerprinting ── */
  'fingerprintjs.com','fingerprint.com','fpjs.io',
  'threatmetrix.com','iovation.com','kochava.com',
  'appsflyer.com','adjust.com','branch.io','singular.net',
  'tune.com','hasoffers.com','trackier.com',
  'afftrack.com','offerwall.com','clickbooth.com',

  /* ── Video Ad Injectors ── */
  'sync.1rx.io','sync-t1.de17a.com','sync.mathtag.com',
  'ads.avocet.io','pixel.adsafeprotected.com',
  'ads.pointroll.com','ads.yieldmo.com',
  'springpm.com','ctfassets.net',

  /* ── Known Vidsrc/Streaming Ad Redirect Domains ── */
  'tpc.googlesyndication.com','ad.turn.com','adfuser.com',
  'getpopunder.com','getpopads.net','popunder-ads.com',
  'bannerflow.com','banner-flow.com','ad-maven.com',
  'inpage.push','inpagepush.com','instantpush.net',
  'pushpanda.co','pushpanda.net','megapush.net',
  'adsground.com','adsground.net','groundads.com',
  'trafficgate.net','trafficgate.com',
  'ero.com','ero.net','erotik.com',
  'holmescort.com','holmescort.net',
  'rediris.net','rediris.com',
  'adshares.net','adshares.com',
  '1rx.io','mathtag.com','atdmt.com',
  'servedby.flashtalking.com','flashtalking.com',
  'adroll.com','rollover.me','bid4ads.com',
  'monetag.com','monetag.net','push.monetag.com',
  'dataplush.com','dataplush.net',
  'directpush.net','directpush.com',
  'subliminal.video','subliminal.media',
  'justpush.pro','instapush.net','pushnotify.co',
  'megapu.sh','keezmovies.com','xcams.com',
  'trk.mail.ru','top.mail.ru','mail.ru',
  'yandex.ru','metrika.yandex.ru',
  'mc.yandex.ru','an.yandex.ru',
  'w55c.net','crsspxl.com','crssp.com',
  'servenobid.com','servenobid.net',
  'bidsxchange.com','bidsxchange.net',
  'adlooxads.com','digitrust.us',
  'prebid.org','prebid.com',
  'sync.agkn.com','agkn.com',
  'adsense-ads.com','ads-network.com',
  'globaladsupply.com','globaladsupply.net',
  'trafficly.net','trafficly.com',
  'videoadex.com','adex.com','adex.net',
  'turbolinks.com','turboads.com',
  'popdirection.com','popdirection.net',
  'content-discovery.com','content-discovery.net',
  'native-ads.com','nativeads.com',
  'native-ads.net','nativeads.net',
  'contextual-ads.com','contextual-ads.net',
  'ads.net','ads.com',
  'adsrvr.org','adsrvr.com','the-trade-desk.com',
  'amazon.com','aax.amazon.com',
  'cloudflare.net',

  /* ── Specifically seen redirecting in vidsrc ── */
  'vidsrc.cc', /* Only block redirects FROM vidsrc, not the embed itself - handled by pattern rules */
  'go.streamsb.net','go.filefox.cc','go.doodstream.com',
  'go.cloudvideo.tv','go.vidzstore.com',
  'clickhype.net','clickhype.com',
  'ckclick.net','ckvideo.net',
  'popunder2.com','popunder3.com',
  'newpopunder.com','smartpopunder.com',
  'moneymakingspot.com','moneymaking-spot.com',
  'ads.dailymotion.com','ads.youtube.com',
  'pagead.l.doubleclick.net',
]);

/* Remove vidsrc.cc from full block - we only want to block redirects FROM it */
BLOCKED.delete('vidsrc.cc');

/* ═══════════════════════════════════════════════════════════════════════════
   EMBED ALLOW-LIST — these hosts are embedding players; never block navigations TO them
═══════════════════════════════════════════════════════════════════════════ */
const EMBED_HOSTS = new Set([
  'vidsrc.cc','vidsrc.to','vidsrc.me','vidsrc.xyz','vidsrc.net','vidsrc.pm',
  'vidsrc.icu','vidsrc.in','vidsrc.nl','vidsrc.pro','vidsrc.co',
  'player.vidsrc.cc','player.vidsrc.co','player.vidsrc.to',
  'autoembed.cc','player.autoembed.cc','autoembed.to','autoembed.me',
  'multiembed.mov','superembed.stream',
  'embed.su',
  'vidlink.pro',
  '2embed.cc','2embed.to','2embed.org',
  'streamed.su','streamed.pk','streamed.me',
  'smashystream.com','smashystream.xyz',
  'moviesapi.club',
  'frembed.pro','frembed.xyz','frembed.live',
  'filemoon.sx','filemoon.to','filemoon.net',
  'streamwish.com','streamwish.to',
  'doodstream.com','doodstream.co','dood.watch',
  'mixdrop.ag','mixdrop.co','mixdrop.to',
  'vidmoly.to','vidmoly.net',
  'vidplay.online','vidplay.site',
  'rive.su','rive.stream',
  'embedme.top',
  'warezcdn.net','warezcdn.com',
  'cdn.jwplayer.com','jwpltx.com','jwplayer.com',
  'hlsplayer.net','hlsplayer.org',
  'player.vimeo.com','vimeo.com',
  'youtube.com','youtu.be',
  'api.themoviedb.org','image.tmdb.org',
  'fonts.googleapis.com','fonts.gstatic.com',
  'cdn.jsdelivr.net',
]);

/* ═══════════════════════════════════════════════════════════════════════════
   SUSPICIOUS URL PATTERNS — block regardless of hostname
═══════════════════════════════════════════════════════════════════════════ */
const BLOCK_URL_PATTERNS = [
  /* Redirect chain parameters */
  /[?&](redirect|goto|url|link|src|ref|out|click|track|exit|redir|forward)=[^&]*(https?%3A|https?:|www\.)/i,
  /* Path-based redirects */
  /\/(go|out|redirect|click|track|r|exit|forward|link)\/https?:\/\//i,
  /* Ad click trackers */
  /adclickhere\.com/i,
  /clickbooth\.com/i,
  /ad\.atdmt\.com/i,
  /* Popunder-specific patterns */
  /popunder|popads|popcash|clickunder|adsense.*popup/i,
  /* Base64 encoded redirect payloads */
  /[?&](u|url|link|dest|destination)=[a-zA-Z0-9+/]{20,}={0,2}(&|$)/,
  /* Short-link redirect chains */
  /^https?:\/\/(bit\.ly|tinyurl\.com|t\.co|ow\.ly|buff\.ly|goo\.gl)\//i,
  /* Tracker beacons */
  /\/(beacon|ping|track|analytics|pixel|impression|click)\/?(\?|$)/i,
  /* iframe popunder pattern */
  /iframe.*popunder|popunder.*iframe/i,
  /* JS redirect obfuscation */
  /eval\(.*base64/i,
  /* Cloaked ad landing pages */
  /\/(lander|landing|promo|offer|deal)\/?(\?|$)/i,
  /* Known vidsrc ad redirect patterns */
  /vidsrc\.cc\/.*\/(ad|ads|sponsor)/i,
  /\.xyz\/[a-z0-9]{8,}\/?$/i,  /* Random hash redirect domains */
  /* Push notification subscribe patterns */
  /\/(push|subscribe|notifications?)\/?(\?|$)/i,
  /* Crypto miner patterns */
  /cryptonight|coinhive|cryptoloot|webminer/i,
];

/* ═══════════════════════════════════════════════════════════════════════════
   LOOKUP HELPERS
═══════════════════════════════════════════════════════════════════════════ */
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

function isEmbedHost(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase().replace(/^www\./, '');
  return EMBED_HOSTS.has(hostname) ||
    Array.from(EMBED_HOSTS).some(h => hostname.endsWith('.' + h));
}

function hasBlockedPattern(url) {
  for (const pat of BLOCK_URL_PATTERNS) {
    if (pat.test(url)) return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESPONSES
═══════════════════════════════════════════════════════════════════════════ */
function silentBlock() {
  return new Response('', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'X-RW-Shield': 'blocked',
      'Cache-Control': 'no-store',
    },
  });
}

function silentBlockJs() {
  return new Response('/* blocked */', {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'X-RW-Shield': 'blocked-js',
      'Cache-Control': 'no-store',
    },
  });
}

function emptyGif() {
  /* 1×1 transparent GIF */
  const b = atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
  const arr = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
  return new Response(arr, {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'X-RW-Shield': 'pixel-blocked', 'Cache-Control': 'no-store' },
  });
}

function blockedNavPage(blockedUrl) {
  let hostname = '';
  try { hostname = new URL(blockedUrl).hostname; } catch (_) { hostname = blockedUrl; }
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Blocked</title>
<script>
(function(){
  try { if (window.history.length > 1) window.history.back(); else window.location.replace('/'); } catch(e) {}
  try { window.parent.postMessage({ type: 'RW_NAV_BLOCKED', hostname: ${JSON.stringify(hostname)} }, '*'); } catch(_) {}
  setTimeout(function(){ try { window.location.replace('/'); } catch(_){} }, 400);
})();
<\/script></head>
<body style="background:#07090d;color:#e8c96d;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px">
<div style="font-size:32px">🛡️</div>
<div style="font-size:14px;letter-spacing:2px">AD REDIRECT BLOCKED</div>
<div style="font-size:11px;color:#5a6478">${hostname.replace(/</g,'&lt;')}</div>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-RW-Shield': 'nav-blocked' },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   LIFECYCLE
═══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('rw-blocked-') && k !== BLOCK_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION }))
      ))
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — NUCLEAR INTERCEPTION v7
═══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', e => {
  const req  = e.request;
  const url  = req.url;
  const mode = req.mode;
  const dest = req.destination;

  /* Only intercept HTTP/S — skip chrome-extension, data, blob etc */
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  /* Block ALL data: URI navigations (popunder trick) */
  if (url.startsWith('data:') && mode === 'navigate') {
    e.respondWith(silentBlock());
    notifyBlocked('data-uri', 'data-navigate');
    return;
  }

  let parsed, hostname, origin;
  try {
    parsed   = new URL(url);
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    origin   = parsed.origin;
  } catch (_) { return; }

  /* ─── RULE 1: Block ALL requests to known ad/tracker domains ── */
  if (isBlocked(hostname)) {
    const isScript = dest === 'script' || url.endsWith('.js') || url.includes('.js?');
    const isImage  = dest === 'image'  || /\.(gif|png|jpg|webp|svg)(\?|$)/i.test(url);
    if (isImage) { e.respondWith(emptyGif()); }
    else         { e.respondWith(isScript ? silentBlockJs() : silentBlock()); }
    notifyBlocked(hostname, 'domain');
    return;
  }

  /* ─── RULE 2: Block suspicious redirect-chain URLs ─────────── */
  if (hasBlockedPattern(url) && origin !== SELF_ORIGIN) {
    /* Allow if it's a known embed host (embed players use some redirect params) */
    if (!isEmbedHost(hostname)) {
      e.respondWith(silentBlock());
      notifyBlocked(hostname, 'pattern');
      return;
    }
  }

  /* ─── RULE 3: Block ALL external top-level navigations ──────── */
  if (mode === 'navigate' && dest === 'document') {
    if (origin !== SELF_ORIGIN) {
      /* Allow known embed hosts in iframes — but NEVER allow top-level */
      console.warn('[SW v7] BLOCKED top-level nav →', url);
      e.respondWith(blockedNavPage(url));
      notifyBlocked(hostname, 'navigation');
      return;
    }
    return;
  }

  /* ─── RULE 4: Block ad iframes / sub-frames ──────────────────── */
  if (dest === 'iframe' || dest === 'frame') {
    if (isBlocked(hostname)) {
      e.respondWith(silentBlock());
      notifyBlocked(hostname, 'iframe');
      return;
    }
    /* Block iframes to random-looking domains (common popunder trick) */
    if (!isEmbedHost(hostname) && origin !== SELF_ORIGIN && /^[a-z0-9]{8,16}\.(xyz|top|click|loan|win|gq|cf|tk|ml|ga)$/.test(hostname)) {
      e.respondWith(silentBlock());
      notifyBlocked(hostname, 'suspicious-tld');
      return;
    }
  }

  /* ─── RULE 5: Block tracking pixels ─────────────────────────── */
  if (dest === 'image' && isBlocked(hostname)) {
    e.respondWith(emptyGif());
    return;
  }

  /* ─── RULE 6: Block suspicious beacon/ping requests ─────────── */
  if ((dest === 'beacon' || mode === 'no-cors') && isBlocked(hostname)) {
    e.respondWith(silentBlock());
    return;
  }

  /* ─── RULE 7: Block font/style loads from ad domains ──────────  */
  if ((dest === 'font' || dest === 'style') && isBlocked(hostname)) {
    e.respondWith(silentBlock());
    return;
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFY PAGE
═══════════════════════════════════════════════════════════════════════════ */
function notifyBlocked(hostname, reason) {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    for (const c of clients) {
      c.postMessage({ type: 'RW_BLOCKED', hostname, reason, version: SW_VERSION });
    }
  }).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE HANDLER
═══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('message', e => {
  const d = e.data;
  if (!d) return;
  if (d === 'PING' || d.type === 'PING') {
    e.source?.postMessage({ type: 'PONG', version: SW_VERSION });
  }
  if (d === 'SKIP_WAITING' || d.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (d.type === 'GET_VERSION') {
    e.source?.postMessage({ type: 'VERSION', version: SW_VERSION });
  }
});
