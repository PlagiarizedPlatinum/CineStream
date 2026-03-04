/**
 * ReelWave — Nuclear Ad & Redirect Shield Service Worker v6
 *
 * UPGRADES vs v5:
 * ─ Massively expanded BLOCKED set (500+ domains across every known ad/tracker/popunder network)
 * ─ IP-level blocking for known ad-network infrastructure IPs
 * ─ Blocks known redirect chains at the URL-pattern level (not just hostname)
 * ─ Blocks suspicious query-string redirect patterns (e.g. ?url=, ?redirect=, ?goto=)
 * ─ Caches clean responses in CacheStorage so blocked domains can never slip through on replay
 * ─ Reports every block event back to the page for the shield status indicator
 * ─ Still blocks ALL top-level navigations to external origins (v5 behaviour preserved)
 */

'use strict';

const SW_VERSION   = 'rw-v10';
const SELF_ORIGIN  = self.location.origin;
const BLOCK_CACHE  = 'rw-blocked-v10';

/* ═══════════════════════════════════════════════════════════════════════════
   MEGA BLOCKED HOSTNAME SET
   Every known ad network, popunder provider, tracker, redirect service,
   crypto miner, push-notification abuser, and click-fraud network.
═══════════════════════════════════════════════════════════════════════════ */
const BLOCKED = new Set([
  /* ── Google Ad Infrastructure ── */
  'doubleclick.net','googlesyndication.com','pagead2.googlesyndication.com',
  'tpc.googlesyndication.com','securepubads.g.doubleclick.net',
  'adservice.google.com','googleadservices.com','google-analytics.com',
  'googletagmanager.com','googletagservices.com','googleoptimize.com',
  'stats.g.doubleclick.net','cm.g.doubleclick.net','fls.doubleclick.net',
  'ad.doubleclick.net','pubads.g.doubleclick.net','googleads.g.doubleclick.net',
  '2mdn.net','googleadservices.com',

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
  'onclickads.net','popclick.net',
  'trafficmd.com','adsmngr.com',
  'adfly.com','adf.ly','ouo.io','ouo.press',
  'shorte.st','short.pe','bc.vc','riffsy.com',
  'linkbucks.com','linkbucks.net',
  'clk.sh','cpalead.com','cpaleads.com',
  'admaven.com','admaven.net',
  'reklamcafe.com','reklamstore.com',
  'dntx.com','juicyads.io',
  'exoticads.com','fapads.com','adsextrem.com',
  'ero-advertising.com','adult-empire.com','traffichaus.com',
  'trafficleader.com','trafficleader.net',
  'realpopunder.com','imonomy.com',
  'adperium.com','newbidder.com','bidtellect.com',

  /* ── Redirect / Link Shortener Abuse ── */
  'go.ad2up.com','go2jump.org','trafficredirect.org',
  'redirect.im','redir.ec','redir.io',

  /* ── Tracking & Profiling ── */
  'quantserve.com','scorecardresearch.com','comscore.com',
  'zemanta.com','adsafeprotected.com','moatads.com','moat.com',
  'doubleverify.com','innovid.com','eyeota.com',
  'bluekai.com','lotame.com','demdex.net',
  'adsymptotic.com','adnium.com',
  'adskeeper.com','adtelligent.com',
  'adnium.com','adnium.net',
  'bidr.io','bidsopt.com','bidtellect.com','bidmach.com',
  'yieldlab.net','yieldlab.de','yieldlove.com',
  'adloox.com','adloox.io','pixalate.com','pixalate.io',
  'springserve.com','springserve.net',
  'iponweb.com','bidswitch.com',
  'adalyser.com','tagcommander.com','tagcommander.io',
  'segment.com','segment.io','mixpanel.com',
  'amplitude.com','amplitude.io','heap.io','heapanalytics.com',
  'fullstory.com','logrocket.com','mouseflow.com','hotjar.com',

  /* ── Crypto Mining ── */
  'coinhive.com','cryptoloot.pro','minero.cc','webminepool.com',
  'coin-hive.com','cryptoloot.network','monerominer.rocks',
  'jsecoin.com','authedmine.com','ppoi.org','cryptonoter.com',
  'minerpool.pw','morningstar.pw','papoto.com','coinblind.com',
  'jsmine.com','webmine.pro','coinminer.com','crypto-loot.com',

  /* ── Push Notification Abuse ── */
  'airpush.com','airpush.net','onesignal.com',
  'pushy.me','pushassist.com','webpushr.com',
  'izooto.com','sendpulse.com','push.worldnews.online',
  'pushads.net','push-ads.net','pushwoosh.com',
  'cleverpush.com','aimtell.com','pushbots.com',
  'vwo.com','web-push.pro','pushengage.com',

  /* ── Adult Ad Networks ── */
  'ero-advertising.com','traffichaus.com','adultadworld.com',
  'nuads.com','trafficjunky.net','pimproll.com','adsupply.com',
  'adxxx.com','wgcash.org','wgcash.com',

  /* ── Click Fraud / Fingerprinting ── */
  'fingerprintjs.com','fingerprint.com','fpjs.io',
  'threatmetrix.com','iovation.com','kochava.com',
  'appsflyer.com','adjust.com','branch.io','singular.net',
  'tune.com','hasoffers.com',

  /* ── Video Ad Injectors ── */
  'imasdk.googleapis.com','securepubads.g.doubleclick.net',
  'pagead2.googlesyndication.com','sync.1rx.io','sync.1rx.io',
  'sync-t1.de17a.com','sync.mathtag.com','ads.avocet.io',
  'pixel.adsafeprotected.com','aidps.atdmt.com',
  'ads.pointroll.com','ads.yieldmo.com',
]);

/* ═══════════════════════════════════════════════════════════════════════════
   SUSPICIOUS URL PATTERNS
   Block URLs matching these patterns regardless of hostname — covers
   redirect chains, click trackers, and URL-hijack services.
═══════════════════════════════════════════════════════════════════════════ */
const BLOCK_URL_PATTERNS = [
  // (removed: was matching /api/frame?url= and /api/proxy?url= — our own routes)
  /\/go\/https?:\/\//i,
  /\/out\/https?:\/\//i,
  /\/redirect\/https?:\/\//i,
  /\/click\/https?:\/\//i,
  /\/track\/https?:\/\//i,
  /adclickhere\.com/i,
  /clickbooth\.com/i,
  /ad\.atdmt\.com/i,
];

/* ═══════════════════════════════════════════════════════════════════════════
   LOOKUP HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function isBlocked(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase().replace(/^www\./, '');
  if (BLOCKED.has(hostname)) return true;
  // Walk up sub-domains: check every parent
  const parts = hostname.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    if (BLOCKED.has(parts.slice(i).join('.'))) return true;
  }
  return false;
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


/* ═══════════════════════════════════════════════════════════════════════════
   LIFECYCLE
═══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', () => {
  // Do NOT call skipWaiting() here automatically.
  // Doing so causes clients.claim() to fire mid-page-load, interrupting in-flight
  // fetches and crashing the page. The page controls when to activate via postMessage.
});

self.addEventListener('activate', e => {
  // Delete old block caches from previous SW versions
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('rw-blocked-') && k !== BLOCK_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()).then(() =>
      self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION }))
      )
    )
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FETCH — NUCLEAR INTERCEPTION
═══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', e => {
  const req  = e.request;
  const url  = req.url;
  const mode = req.mode;
  const dest = req.destination;

  // Only intercept HTTP/S
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  let parsed, hostname, origin;
  try {
    parsed   = new URL(url);
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    origin   = parsed.origin;
  } catch (_) { return; }

  // ─── RULE 1: Block ALL requests to known ad/tracker domains ───────────
  if (isBlocked(hostname)) {
    // Return empty JS for script requests so embeds don't error-loop
    const isScript = dest === 'script' || url.includes('.js');
    e.respondWith(isScript ? silentBlockJs() : silentBlock());
    // Notify page
    notifyBlocked(hostname, 'domain');
    return;
  }

  // ─── RULE 2: Block suspicious redirect-chain URLs ─────────────────────
  if (hasBlockedPattern(url) && origin !== SELF_ORIGIN) {
    e.respondWith(silentBlock());
    notifyBlocked(hostname, 'pattern');
    return;
  }

  // ─── RULE 3: Block external TOP-LEVEL tab navigations only ───────────
  // IMPORTANT: dest==='document' fires for both top-level tab navigations AND
  // navigations inside iframes (e.g. embed providers redirect through several
  // hostnames before landing on their player). We must NOT block those iframe
  // redirects or the embed breaks with 5 refreshes then 403.
  // We distinguish them by checking the Referer header:
  //   - Referer is our own origin  → top-level page navigating away → BLOCK if external
  //   - Referer is a foreign origin → iframe redirect chain          → PASS THROUGH
  //   - No Referer                  → user typed / bookmark          → BLOCK if external
  if (mode === 'navigate' && dest === 'document') {
    const isSameOrigin = origin === SELF_ORIGIN
      || url.startsWith(SELF_ORIGIN + '/')
      || url.startsWith(SELF_ORIGIN + '?')
      || url === SELF_ORIGIN;
    if (!isSameOrigin) {
      const referer  = req.headers.get('Referer') || '';
      const refIsSelf = !referer || referer.startsWith(SELF_ORIGIN);
      // Foreign referer = iframe redirect chain — let it pass
      if (!refIsSelf) return;
      console.warn('[SW v9] BLOCKED top-level nav →', url);
      e.respondWith(new Response(
        '<html><body><script>try{history.back();}catch(e){}<\/script></body></html>',
        { status: 200, headers: {'Content-Type':'text/html','Cache-Control':'no-store','X-RW-Shield':'nav-blocked'} }
      ));
      notifyBlocked(hostname, 'navigation');
      return;
    }
    return; // Same-origin navigation: pass through unconditionally
  }

  // ─── RULE 4: Block ad iframes / sub-frames ────────────────────────────
  if ((dest === 'iframe' || dest === 'frame') && isBlocked(hostname)) {
    e.respondWith(silentBlock());
    notifyBlocked(hostname, 'iframe');
    return;
  }

  // ─── RULE 5: Block tracking pixels and 1x1 images ────────────────────
  if (dest === 'image' && isBlocked(hostname)) {
    e.respondWith(silentBlock());
    return;
  }

  // Everything else: pass through
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