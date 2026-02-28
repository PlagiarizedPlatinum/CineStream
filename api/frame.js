/**
 * /api/frame — ReelWave Embed Wrapper
 *
 * Instead of proxying the embed HTML (which breaks sub-resources and gets 403s),
 * this endpoint generates a thin HTML wrapper page that:
 *
 *  1. Runs our kill script in ITS OWN context first
 *  2. Creates a nested iframe pointing at the real embed URL
 *  3. The wrapper page itself is same-origin (our domain), so our SW controls it
 *  4. The inner iframe loads the embed directly (so sub-resources work fine)
 *  5. The wrapper intercepts window.open, location changes, postMessages from the inner frame
 *  6. The SW catches any navigation that escapes both layers
 *
 * This solves:
 *  - "Host not in allowlist" — we removed the strict allowlist; SW handles blocking
 *  - "Please Disable Sandbox" — no sandbox attribute, embed loads normally
 *  - "Upstream 403" — embed loads directly in browser, not fetched server-side
 *  - "Won't load" — sub-resources load from the embed's own origin normally
 */

export const config = { runtime: 'edge' };

// Domains the inner iframe is allowed to point at
const ALLOWED_EMBED_HOSTS = [
  'vidsrc.cc', 'vidsrc.to', 'vidsrc.me', 'vidsrc.xyz', 'vidsrc.net',
  'player.autoembed.cc', 'autoembed.cc',
  'multiembed.mov',
  'embed.su',
  'vidlink.pro',
  '2embed.cc', '2embed.to', 'www.2embed.cc', 'www.2embed.to',
  'streamed.su', 'streamed.pk',
];

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const embedUrl = searchParams.get('url');

  if (!embedUrl) {
    return new Response('Missing url', { status: 400 });
  }

  let parsed;
  try { parsed = new URL(embedUrl); }
  catch(_) { return new Response('Invalid URL', { status: 400 }); }

  if (!ALLOWED_EMBED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    return new Response('Host not allowed', { status: 403 });
  }

  // Escape for safe embedding in JS string and HTML attribute
  const safeUrl = embedUrl.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const escapedOrigin = parsed.origin.replace(/"/g, '');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Player</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
  #embed-frame {
    width: 100%; height: 100%;
    border: none;
    display: block;
  }
</style>

<!--
  LAYER 1: Kill script runs in the WRAPPER page context (same-origin as our app).
  This page itself cannot be redirected by the inner embed because the inner iframe
  is cross-origin from this wrapper. However we intercept postMessage and other
  communication channels.
-->
<script>
(function() {
  'use strict';

  // Kill window.open in wrapper context
  window.open = function(){ return null; };
  try { Object.defineProperty(window, 'open', { value: ()=>null, writable:false, configurable:false }); } catch(_) {}
  try { Object.defineProperty(window, 'opener', { get:()=>null, set:()=>{}, configurable:false }); } catch(_) {}
  try { Object.defineProperty(window, 'name', { get:()=>'', set:()=>{}, configurable:false }); } catch(_) {}

  // Block beforeunload / unload redirects
  window.addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue = ''; }, true);

  // Intercept postMessages from the inner embed iframe — kill any redirect commands
  window.addEventListener('message', function(e) {
    try {
      const raw = typeof e.data === 'string' ? e.data : JSON.stringify(e.data || '');
      const lower = raw.toLowerCase();
      const bad = ['window.open', 'location.href', 'location.replace', 'location.assign',
                   'popunder', 'clickunder', '_blank', 'redirect', 'popads', 'adsterra'];
      if (bad.some(b => lower.includes(b))) {
        // Swallow — don't re-dispatch
        return;
      }
    } catch(_) {}
    // Allow legitimate messages (like video player state) to propagate
  }, true);

  // Watch for the inner iframe trying to navigate its parent (this wrapper page)
  // If anything tries to change our location, we send a message up to the top app
  const _assign  = location.assign.bind(location);
  const _replace = location.replace.bind(location);
  const selfOrigin = location.origin;

  function isExternal(url) {
    try { return new URL(url).origin !== selfOrigin; } catch(_) { return true; }
  }

  try {
    location.assign  = function(url) { if (!isExternal(url)) _assign(url); };
    location.replace = function(url) { if (!isExternal(url)) _replace(url); };
    Object.defineProperty(location, 'href', {
      get() { return location.href; },
      set(v) { if (!isExternal(v)) _assign(v); },
    });
  } catch(_) {}

  // Notify parent app that shield is active
  window.parent?.postMessage({ type: 'RW_SHIELD_READY' }, '*');
})();
</script>
</head>
<body>

<iframe
  id="embed-frame"
  src="${safeUrl}"
  allowfullscreen
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
  referrerpolicy="no-referrer-when-downgrade"
  loading="eager"
></iframe>

<!--
  LAYER 2: After the inner iframe loads, inject the kill script INTO the inner frame
  via contentWindow property access. This only works if the inner frame is same-origin,
  but we try anyway — for cross-origin frames, the SW handles navigation interception.
-->
<script>
(function() {
  'use strict';

  const frame = document.getElementById('embed-frame');

  // The kill payload we try to inject into the inner frame
  const INNER_KILL = function() {
    try {
      // Nuke window.open
      window.open = function(){ return null; };
      Object.defineProperty(window, 'open', { value: ()=>null, writable:false, configurable:false });
      Object.defineProperty(window, 'opener', { get:()=>null, set:()=>{}, configurable:false });
      Object.defineProperty(window, 'name', { get:()=>'', set:()=>{}, configurable:false });

      // Block top/parent navigation from inside embed
      const noNav = function(){};
      const fakeLoc = new Proxy(location, {
        get(t, p) {
          if (p === 'href' || p === 'assign' || p === 'replace' || p === 'reload') return noNav;
          try { const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } catch(_) { return ''; }
        },
        set() { return true; }
      });
      const fakeTopWin = new Proxy({}, {
        get(t, p) {
          if (p === 'location') return fakeLoc;
          if (p === 'open') return ()=>null;
          if (p === 'top' || p === 'parent') return fakeTopWin;
          try { return window[p]; } catch(_) { return undefined; }
        },
        set() { return true; }
      });
      // Can't redefine window.top directly in cross-origin, but try for same-origin:
      try { Object.defineProperty(window, 'top', { get: ()=>fakeTopWin, configurable:false }); } catch(_) {}
      try { Object.defineProperty(window, 'parent', { get: ()=>fakeTopWin, configurable:false }); } catch(_) {}

      // Block history abuse
      try { history.pushState = ()=>{}; history.replaceState = ()=>{}; } catch(_) {}

      // Kill eval/Function string abuse
      const BAD = ['popunder','clickunder','window.open(','popads','popcash','adsterra','propellerads','trafficjunky','exoclick'];
      const _ev = window.eval;
      window.eval = function(c) { if (typeof c==='string' && BAD.some(b=>c.includes(b))) return; return _ev.call(this,c); };
      const _Fn = window.Function;
      window.Function = function(...a) { const b = a[a.length-1]||''; if (typeof b==='string' && BAD.some(x=>b.includes(x))) return ()=>{}; return _Fn(...a); };

      // Kill string timers
      const _st=window.setTimeout, _si=window.setInterval;
      window.setTimeout  = function(fn,d,...a){ if(typeof fn==='string'&&BAD.some(b=>fn.includes(b))) return 0; return _st.call(this,fn,d,...a); };
      window.setInterval = function(fn,d,...a){ if(typeof fn==='string'&&BAD.some(b=>fn.includes(b))) return 0; return _si.call(this,fn,d,...a); };

      // Block createElement('a').click() abuse
      const _ce = document.createElement.bind(document);
      document.createElement = function(tag, ...args) {
        const el = _ce(tag, ...args);
        if (tag.toLowerCase() === 'a') {
          const _ck = el.click.bind(el);
          el.click = function() {
            const href = (el.getAttribute('href')||'').trim();
            if (href.startsWith('http') || el.target === '_blank') return;
            _ck();
          };
        }
        return el;
      };

      // Block Notification/push
      if ('Notification' in window) {
        try { Object.defineProperty(Notification, 'requestPermission', { value:()=>Promise.resolve('denied'), writable:false }); } catch(_) {}
      }

      console.log('[RW] Inner frame shield active');
    } catch(e) {
      console.warn('[RW] Inner frame shield partial:', e.message);
    }
  };

  // Try to inject on load (works if same-origin, silently fails if cross-origin — SW handles that case)
  frame.addEventListener('load', function() {
    try {
      if (frame.contentWindow) {
        // Try direct injection (works if same-origin after redirect)
        frame.contentWindow.eval('(' + INNER_KILL.toString() + ')()');
      }
    } catch(_) {
      // Cross-origin — expected. SW is the fallback.
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
      'Cache-Control': 'no-store, no-cache',
      // This wrapper page is served from our own origin, so X-Frame-Options SAMEORIGIN is fine
      'X-Frame-Options': 'SAMEORIGIN',
      // CSP for the wrapper: allow the inner iframe to load any https source
      // Critically: no allow-popups means window.open from wrapper = blocked by browser too
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval'; frame-src https:; img-src https: data:; media-src https: blob:; connect-src https:;",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
