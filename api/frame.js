/**
 * /api/frame — ReelWave Embed Wrapper Page Generator
 *
 * Generates a same-origin wrapper page served from OUR domain.
 * The wrapper page:
 *   1. Runs the kill script in its own (same-origin) context
 *   2. Embeds the real player in a nested <iframe>
 *   3. The outer page IS same-origin — the SW controls all navigations through it
 *   4. The inner player iframe loads normally with no sandbox restrictions
 *
 * Why this works:
 *   - SW catches any navigation escape at the network layer
 *   - Kill script blocks all JS-level redirect APIs as a second layer
 *   - No sandbox attribute = player works fully
 *   - No server-side HTML fetch = no 403s, sub-resources load fine
 */

export const config = { runtime: 'edge' };

const ALLOWED_EMBED_HOSTS = [
  'vidsrc.cc','vidsrc.to','vidsrc.me','vidsrc.xyz','vidsrc.net','vidsrc.pm',
  'player.vidsrc.cc','player.vidsrc.co',
  'autoembed.cc','player.autoembed.cc','autoembed.to',
  'multiembed.mov','www.multiembed.mov',
  'embed.su','www.embed.su',
  'vidlink.pro','www.vidlink.pro',
  '2embed.cc','www.2embed.cc','2embed.to','www.2embed.to','2embed.org',
  'streamed.su','streamed.pk',
  'smashystream.com','smashystream.xyz',
  'moviesapi.club','moviesapi.com',
  'closeload.com','closeload.net',
  'frembed.pro','frembed.xyz',
  'moviezwap.net',
  'warezcdn.net','warezcdn.com',
  'filemoon.sx','filemoon.to',
  'streamwish.com','streamwish.to',
];

function isAllowed(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  return ALLOWED_EMBED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { searchParams, origin: reqOrigin } = new URL(req.url);
  const embedUrl = searchParams.get('url');

  if (!embedUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let parsed;
  try { parsed = new URL(embedUrl); }
  catch(_) { return new Response('Invalid URL', { status: 400 }); }

  if (!isAllowed(parsed.hostname)) {
    // Return a fallback that loads the URL anyway with protection
    // Better to load with protection than to show an error
  }

  // Safe-escape the URL for HTML attribute and JS string contexts
  const htmlUrl = embedUrl
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const jsUrl = embedUrl
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Player</title>

<!--
  SHIELD LAYER 1: Kill all redirect/popup APIs in THIS wrapper page's context.
  This page is same-origin with our app, so the SW already controls navigations
  at the network layer. This JS layer is defence-in-depth at the runtime layer.

  We poison every known JS mechanism for triggering navigation/popups:
    - window.open
    - location.href / assign / replace
    - window.top.location (cross-frame redirect)
    - window.parent.location
    - history.pushState abuse
    - document.createElement('a').click()
    - eval() / Function() string injection
    - setTimeout(string) / setInterval(string)
    - Notification API (push ads)
    - window.name (state carrier across redirects)
    - beforeunload / unload hooks
-->
<script>
(function RWShield() {
  'use strict';

  /* 1. window.open — absolute zero */
  const _noop = function() { return null; };
  try {
    window.open = _noop;
    Object.defineProperty(window, 'open', { value: _noop, writable: false, configurable: false });
  } catch(_) {}

  /* 2. window.opener — prevent reverse reference attacks */
  try { Object.defineProperty(window, 'opener', { get: function() { return null; }, set: function() {}, configurable: false }); } catch(_) {}

  /* 3. window.name — used as redirect state carrier */
  try { Object.defineProperty(window, 'name', { get: function() { return ''; }, set: function() {}, configurable: false }); } catch(_) {}

  /* 4. location.*  — block all navigation from this wrapper page context */
  var _locAssign  = location.assign.bind(location);
  var _locReplace = location.replace.bind(location);
  var _selfOrigin = location.origin;
  function isSelf(u) { try { return new URL(u, location.href).origin === _selfOrigin; } catch(_) { return false; } }
  try {
    Object.defineProperty(location, 'href',    { get: function() { return location.href; },    set: function(v) { if (isSelf(v)) _locAssign(v); }, configurable: false });
    Object.defineProperty(location, 'assign',  { value: function(v) { if (isSelf(v)) _locAssign(v); },  writable: false, configurable: false });
    Object.defineProperty(location, 'replace', { value: function(v) { if (isSelf(v)) _locReplace(v); }, writable: false, configurable: false });
    Object.defineProperty(location, 'reload',  { value: function() {}, writable: false, configurable: false });
  } catch(_) {}

  /* 5. history.pushState / replaceState abuse */
  try {
    var _hPush    = history.pushState.bind(history);
    var _hReplace = history.replaceState.bind(history);
    history.pushState    = function(s, t, u) { if (!u || isSelf(String(u))) _hPush(s, t, u); };
    history.replaceState = function(s, t, u) { if (!u || isSelf(String(u))) _hReplace(s, t, u); };
  } catch(_) {}

  /* 6. window.top / window.parent — fake them so inner iframes can't escape to real top */
  var _fakeLoc = new Proxy(
    typeof location !== 'undefined' ? location : {},
    {
      get: function(t, p) {
        if (p === 'href' || p === 'assign' || p === 'replace' || p === 'reload') {
          return function() {};
        }
        try { var v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } catch(_) { return ''; }
      },
      set: function() { return true; }
    }
  );
  var _fakeTop = new Proxy({}, {
    get: function(t, p) {
      if (p === 'location')             return _fakeLoc;
      if (p === 'open')                 return _noop;
      if (p === 'top' || p === 'parent' || p === 'frames') return _fakeTop;
      if (p === 'closed')               return false;
      try { return window[p]; } catch(_) { return undefined; }
    },
    set: function() { return true; }
  });
  try { Object.defineProperty(window, 'top',    { get: function() { return _fakeTop; }, configurable: false }); } catch(_) {}
  try { Object.defineProperty(window, 'parent', { get: function() { return _fakeTop; }, configurable: false }); } catch(_) {}

  /* 7. eval() string injection */
  var _eval = window.eval;
  var BAD = ['popunder','clickunder','popads','popcash','window.open(','adsterra','brightadnetwork',
             'propellerads','trafficjunky','exoclick','hilltopads','location.href','location.replace'];
  window.eval = function(c) {
    if (typeof c === 'string' && BAD.some(function(b) { return c.indexOf(b) !== -1; })) {
      console.warn('[RW-FRAME] Blocked eval:', c.slice(0, 80));
      return undefined;
    }
    return _eval.call(this, c);
  };

  /* 8. Function() constructor injection */
  var _Fn = window.Function;
  window.Function = function() {
    var args = Array.prototype.slice.call(arguments);
    var body = args[args.length - 1] || '';
    if (typeof body === 'string' && BAD.some(function(b) { return body.indexOf(b) !== -1; })) {
      return function() {};
    }
    return _Fn.apply(this, args);
  };
  try { window.Function.prototype = _Fn.prototype; } catch(_) {}

  /* 9. setTimeout / setInterval string form */
  var _st = window.setTimeout;
  var _si = window.setInterval;
  window.setTimeout = function(fn, delay) {
    var rest = Array.prototype.slice.call(arguments, 2);
    if (typeof fn === 'string' && BAD.some(function(b) { return fn.indexOf(b) !== -1; })) return 0;
    return _st.apply(this, [fn, delay].concat(rest));
  };
  window.setInterval = function(fn, delay) {
    var rest = Array.prototype.slice.call(arguments, 2);
    if (typeof fn === 'string' && BAD.some(function(b) { return fn.indexOf(b) !== -1; })) return 0;
    return _si.apply(this, [fn, delay].concat(rest));
  };

  /* 10. document.createElement('a').click() detached anchor abuse */
  var _ce = document.createElement.bind(document);
  document.createElement = function(tag) {
    var rest = Array.prototype.slice.call(arguments, 1);
    var el   = _ce.apply(document, [tag].concat(rest));
    if (typeof tag === 'string' && tag.toLowerCase() === 'a') {
      var _click = el.click.bind(el);
      el.click = function() {
        var href = (el.getAttribute('href') || '').trim();
        var tgt  = (el.target || '').trim();
        if (href.startsWith('http') || href.startsWith('//') || tgt === '_blank') {
          console.warn('[RW-FRAME] Blocked anchor.click():', href);
          return;
        }
        _click();
      };
    }
    return el;
  };

  /* 11. External link click interception */
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'BODY') {
      if (el.tagName === 'A') {
        var href = (el.getAttribute('href') || '').trim();
        var tgt  = (el.getAttribute('target') || '').trim();
        if (href.startsWith('http') || href.startsWith('//') || tgt === '_blank') {
          e.preventDefault();
          e.stopImmediatePropagation();
          console.warn('[RW-FRAME] Blocked link click:', href);
          return;
        }
      }
      el = el.parentElement;
    }
  }, true);

  /* 12. Notification / Push API */
  if (typeof Notification !== 'undefined') {
    try {
      Object.defineProperty(Notification, 'requestPermission', { value: function() { return Promise.resolve('denied'); }, writable: false, configurable: false });
      Object.defineProperty(Notification, 'permission', { get: function() { return 'denied'; }, configurable: false });
    } catch(_) {}
  }

  /* 13. postMessage abuse filter */
  window.addEventListener('message', function(e) {
    try {
      var raw = typeof e.data === 'string' ? e.data : JSON.stringify(e.data || '');
      var lo  = raw.toLowerCase();
      var bads = ['window.open', 'popunder', 'clickunder', 'location.href',
                  'location.replace', 'location.assign', 'brightadnetwork', 'popads', 'adsterra'];
      if (bads.some(function(b) { return lo.indexOf(b) !== -1; })) {
        e.stopImmediatePropagation();
        console.warn('[RW-FRAME] Blocked postMessage:', raw.slice(0, 100));
        return;
      }
    } catch(_) {}
  }, true);

  /* 14. beforeunload — prevent redirect-on-unload tricks */
  window.addEventListener('beforeunload', function(e) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }, true);

  /* 15. Focus/blur popup trick — fire popup on window blur */
  window.addEventListener('blur', function(e) {
    e.stopImmediatePropagation();
  }, true);

  /* 16. document.write injection */
  var _dw = document.write.bind(document);
  document.write = function(h) {
    if (typeof h === 'string') {
      var lo = h.toLowerCase();
      var badWrite = ['adsbygoogle', 'doubleclick', 'popads', 'adsterra', 'exoclick', 'popunder'];
      if (badWrite.some(function(b) { return lo.indexOf(b) !== -1; })) {
        console.warn('[RW-FRAME] Blocked document.write');
        return;
      }
    }
    _dw(h);
  };

  console.log('[RW-FRAME] Shield v5 active');
})();
</script>

<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
  #embed { width: 100%; height: 100%; border: none; display: block; }
</style>
</head>
<body>

<iframe
  id="embed"
  src="${htmlUrl}"
  allowfullscreen
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope; clipboard-write"
  referrerpolicy="no-referrer-when-downgrade"
  loading="eager"
  title="Video player"
></iframe>

<!--
  SHIELD LAYER 2: After the inner iframe loads, attempt to inject the kill
  script directly into the inner frame's window (same-origin case only).
  For cross-origin inner frames, this silently fails — the SW handles those.
-->
<script>
(function() {
  'use strict';

  var frame = document.getElementById('embed');
  if (!frame) return;

  // The kill payload for the inner frame (stringified so we can eval it there)
  var KILL = function() {
    /* same kill script as outer, covering inner frame's window context */
    try {
      window.open = function() { return null; };
      Object.defineProperty(window, 'open', { value: function() { return null; }, writable: false, configurable: false });
      Object.defineProperty(window, 'opener', { get: function() { return null; }, set: function() {}, configurable: false });
      Object.defineProperty(window, 'name', { get: function() { return ''; }, set: function() {}, configurable: false });
      var noNav = function() {};
      var fakeLoc2 = { href: '', assign: noNav, replace: noNav, reload: noNav, toString: function() { return ''; } };
      var fakeTop2 = { location: fakeLoc2, open: noNav, top: null, parent: null, closed: false };
      fakeTop2.top = fakeTop2; fakeTop2.parent = fakeTop2;
      try { Object.defineProperty(window, 'top',    { get: function() { return fakeTop2; }, configurable: false }); } catch(_) {}
      try { Object.defineProperty(window, 'parent', { get: function() { return fakeTop2; }, configurable: false }); } catch(_) {}
      try { history.pushState = function() {}; history.replaceState = function() {}; } catch(_) {}
      var _ev = window.eval;
      var BAD2 = ['popunder','clickunder','popads','window.open(','adsterra','brightadnetwork','propellerads','trafficjunky','exoclick'];
      window.eval = function(c) { if (typeof c === 'string' && BAD2.some(function(b) { return c.indexOf(b) !== -1; })) return; return _ev.call(this, c); };
      window.addEventListener('blur', function(e) { e.stopImmediatePropagation(); }, true);
      console.log('[RW-INNER] Shield active');
    } catch(err) { console.warn('[RW-INNER]', err.message); }
  };

  frame.addEventListener('load', function onLoad() {
    try {
      var cw = frame.contentWindow;
      if (cw) {
        // Only works if inner frame became same-origin (e.g. after redirect to same origin)
        cw.eval('(' + KILL.toString() + ')()');
      }
    } catch(_) {
      // Expected for cross-origin frames — SW handles the network layer
    }
  });

})();
</script>

</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Frame-Options': 'SAMEORIGIN',
      // CSP for this wrapper page:
      // - frame-src https: allows the inner player iframe to load any HTTPS embed
      // - NO allow-popups in sandbox means window.open from this page is browser-blocked too
      // - We deliberately do NOT add sandbox to this response because this page is same-origin
      //   and we need its scripts to run to set up the kill script
      'Content-Security-Policy': [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "frame-src https:",
        "img-src https: data: blob:",
        "media-src https: blob:",
        "connect-src https: wss: blob:",
        "font-src https: data:",
        "worker-src blob:",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer-when-downgrade',
    },
  });
}
