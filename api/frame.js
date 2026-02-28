/**
 * Vercel serverless function: /api/frame
 *
 * This is the CORE of the redirect defence.
 *
 * Instead of pointing the iframe directly at vidsrc.cc / vidsrc.to etc,
 * the client calls /api/frame?url=https://vidsrc.cc/v2/embed/movie/123
 *
 * This function:
 *  1. Fetches the embed page server-side (no CORS issues, custom headers)
 *  2. Injects our KILL SCRIPT into the <head> — runs before any other JS
 *  3. Strips known ad network <script> tags from the HTML
 *  4. Rewrites relative URLs so assets still load
 *  5. Serves back with headers that:
 *     - Allow the iframe to display it (no X-Frame-Options clash)
 *     - Set CSP that blocks popups and navigation from within
 *     - Prevent caching of the modified page
 *
 * The kill script injected into the fetched page overrides window.open,
 * location, and all navigation APIs INSIDE the embed's own context —
 * so even if the embed's JS tries to redirect, it hits our override first.
 */

export const config = { runtime: 'edge' };  // Use Edge Runtime for speed

// ── Allowlist: only these embed domains can be proxied ───────────────────────
const ALLOWED_EMBED_HOSTS = [
  'vidsrc.cc', 'vidsrc.to', 'vidsrc.me',
  'player.autoembed.cc', 'multiembed.mov',
  'embed.su', 'vidlink.pro',
  'www.2embed.cc', '2embed.cc',
  'www.2embed.to', '2embed.to',
];

// ── The kill script injected into every proxied embed page ───────────────────
// This runs FIRST, before the embed's own JavaScript, and poisons all
// redirect/popup APIs at their source.
const KILL_SCRIPT = `
<script data-rw="shield">
(function(){
  // 1. Nuke window.open completely
  window.open = function(){ return { focus:function(){}, blur:function(){}, closed:true }; };
  Object.defineProperty(window, 'open', { value: window.open, writable:false, configurable:false });

  // 2. Null out opener (so ads can't bounce via parent)
  try { Object.defineProperty(window, 'opener', { get:()=>null, set:()=>{}, configurable:false }); } catch(_){}

  // 3. Null window.name (redirect state carrier)
  try { Object.defineProperty(window, 'name', { get:()=>'', set:()=>{}, configurable:false }); } catch(_){}

  // 4. Lock top/parent location — THIS is what stops iframe→top redirects
  //    We replace window.top and window.parent with Proxy objects whose
  //    location property throws silently instead of navigating.
  const safeLocation = new Proxy(window.location, {
    get(t,p){
      if(p === 'href' || p === 'assign' || p === 'replace' || p === 'reload'){
        return function(){ console.warn('[RW-EMBED] Blocked navigation:', p); };
      }
      try { const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } catch(_){ return undefined; }
    },
    set(){ return true; }
  });

  const safeWindow = new Proxy(window, {
    get(t,p){
      if(p === 'top' || p === 'parent' || p === 'frames'){
        return new Proxy({}, {
          get(t2, p2){
            if(p2 === 'location') return safeLocation;
            if(p2 === 'open') return function(){ return null; };
            if(p2 === 'top' || p2 === 'parent') return t2;
            try { return t[p2]; } catch(_){ return undefined; }
          },
          set(){ return true; }
        });
      }
      try { const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } catch(_){ return undefined; }
    },
    set(t,p,v){ try { t[p]=v; } catch(_){} return true; }
  });

  // Override self-reference to safeWindow so embed scripts using 'window' hit our proxy
  try { Object.defineProperty(window, 'self', { get:()=>safeWindow, configurable:false }); } catch(_){}

  // 5. Intercept location directly
  const locHandler = {
    get(t,p){
      if(['href','assign','replace','reload'].includes(String(p))){
        return function(url){ console.warn('[RW-EMBED] Blocked location:', url); };
      }
      try { const v = t[p]; return typeof v==='function'?v.bind(t):v; } catch(_){ return ''; }
    },
    set(t,p,v){ console.warn('[RW-EMBED] Blocked location.'+p+'='+v); return true; }
  };
  try { Object.defineProperty(window, 'location', { get:()=>new Proxy(location, locHandler), configurable:false }); } catch(_){}

  // 6. Block history navigation abuse
  history.pushState    = function(){};
  history.replaceState = function(){};

  // 7. Block document.createElement('a') click abuse
  const _ce = document.createElement.bind(document);
  document.createElement = function(tag, ...args) {
    const el = _ce(tag, ...args);
    if(tag.toLowerCase() === 'a') {
      const _click = el.click.bind(el);
      el.click = function(){
        const href = (el.getAttribute('href')||'').trim();
        if(href.startsWith('http') || el.target === '_blank'){ console.warn('[RW-EMBED] Blocked a.click()'); return; }
        _click();
      };
    }
    return el;
  };

  // 8. Kill eval/Function abuse
  const BAD=['popunder','clickunder','window.open(','location.href','adsterra','propellerads','trafficjunky','popads','popcash','exoclick','hilltopads'];
  const _eval=window.eval;
  window.eval=function(c){ if(typeof c==='string'&&BAD.some(b=>c.includes(b))){ return undefined; } return _eval.call(this,c); };
  const _Fn=window.Function;
  window.Function=function(...a){ const b=a[a.length-1]||''; if(typeof b==='string'&&BAD.some(x=>b.includes(x))) return ()=>{}; return _Fn(...a); };

  // 9. Kill setTimeout/setInterval string abuse
  const _st=window.setTimeout, _si=window.setInterval;
  window.setTimeout=function(fn,d,...a){ if(typeof fn==='string'&&BAD.some(b=>fn.includes(b))) return 0; return _st.call(this,fn,d,...a); };
  window.setInterval=function(fn,d,...a){ if(typeof fn==='string'&&BAD.some(b=>fn.includes(b))) return 0; return _si.call(this,fn,d,...a); };

  // 10. Block focus/blur popup trick
  window.addEventListener('blur', e => e.stopImmediatePropagation(), true);

  // 11. Block Notification API
  if('Notification' in window){
    try { Object.defineProperty(Notification,'requestPermission',{value:()=>Promise.resolve('denied'),writable:false}); } catch(_){}
  }

  // 12. postMessage kill
  window.addEventListener('message', function(e){
    try {
      const raw = typeof e.data==='string'?e.data:JSON.stringify(e.data||'');
      const bad2=['window.open','popunder','clickunder','location.href','location.replace'];
      if(bad2.some(b=>raw.includes(b))) e.stopImmediatePropagation();
    } catch(_){}
  }, true);

  console.log('[RW-SHIELD] Embed protection active');
})();
</script>
`;

// ── Ad script domains to strip from fetched HTML ─────────────────────────────
const AD_SCRIPT_SRCS = [
  'doubleclick','googlesyndication','adnxs','exoclick','trafficjunky',
  'popads','popcash','propellerads','adsterra','adcash','juicyads',
  'yllix','evadav','richpush','coinzilla','a-ads','revcontent','taboola',
  'mgid','hilltopads','clickadu','zeropark','adform','criteo',
  'googletagmanager','googletagservices','quantserve','outbrain',
  'amazon-adsystem','advertising.com','2mdn.net',
];

function stripAdScripts(html) {
  // Remove <script> tags whose src contains ad domains
  html = html.replace(/<script[^>]*src=["'][^"']*(?:doubleclick|googlesyndication|adnxs|exoclick|trafficjunky|popads|popcash|propellerads|adsterra|adcash|juicyads|yllix|evadav|richpush|coinzilla|revcontent|taboola|mgid|hilltopads|clickadu|zeropark|adform|criteo|googletagmanager|googletagservices|quantserve|outbrain|amazon-adsystem|advertising\.com|2mdn\.net)[^"']*["'][^>]*>.*?<\/script>/gis, '<!-- [RW: ad script removed] -->');
  // Remove inline scripts that reference known ad patterns
  html = html.replace(/<script(?![^>]*src=)[^>]*>([\s\S]*?(?:popunder|clickunder|popads|popcash|adsterra|propellerads|trafficjunky|exoclick)[\s\S]*?)<\/script>/gi, '<!-- [RW: ad inline script removed] -->');
  return html;
}

function injectKillScript(html) {
  // Inject as the very FIRST thing inside <head> — before any other scripts run
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${KILL_SCRIPT}`);
  }
  // Fallback: inject before <html> or at very start
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1\n${KILL_SCRIPT}`);
  }
  return KILL_SCRIPT + html;
}

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Validate URL
  let parsed;
  try { parsed = new URL(targetUrl); }
  catch(_) { return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  // Only allow known embed hosts
  if (!ALLOWED_EMBED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    return new Response(JSON.stringify({ error: 'Host not in allowlist' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `${parsed.origin}/`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${upstream.status}` }), { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
    }

    const contentType = upstream.headers.get('content-type') || '';

    // Only process HTML — pass through other content (video, images, etc.) unchanged
    if (!contentType.includes('text/html')) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    let html = await upstream.text();

    // 1. Strip ad scripts from the HTML
    html = stripAdScripts(html);

    // 2. Inject our kill script as the very first thing
    html = injectKillScript(html);

    // 3. Rewrite the base URL so relative links still work
    const baseTag = `<base href="${parsed.origin}/">`;
    if (!/<base[^>]*href/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`);
    }

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        // Allow this page to be iframed by our own site
        'X-Frame-Options': 'SAMEORIGIN',
        // Key CSP for the proxied page:
        // - sandbox equivalent: no popups, no top navigation
        // - allow-popups is NOT listed, so window.open inside the embed = blocked by browser
        'Content-Security-Policy': [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
          // Critically: disallow navigation of the top frame
          "navigate-to 'self'",
          // No popups
          "sandbox allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-downloads",
        ].join('; '),
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Frame proxy failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
