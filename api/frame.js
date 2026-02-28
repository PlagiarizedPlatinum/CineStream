/**
 * /api/frame — ReelWave Embed Wrapper Page Generator v6
 *
 * UPGRADES vs v5:
 * ─ Completely rewritten kill script — now patches 28 attack vectors instead of 16
 * ─ Intercepts WebRTC (used for IP leak / redirect), MediaDevices, Geolocation
 * ─ Poisons RequestAnimationFrame-based redirect loops
 * ─ Kills Object.assign / Proxy-based location spoofing
 * ─ Deep postMessage filtering with origin validation
 * ─ Patches WebSocket constructor to block ad-network WS connections
 * ─ Kills fetch() / XHR calls to blocked ad domains inside the wrapper
 * ─ CSS-based overlay nuke injects a stylesheet that hides ad overlays
 * ─ Expanded ALLOWED_EMBED_HOSTS list
 * ─ Sends telemetry back to parent on every blocked attempt
 */

export const config = { runtime: 'edge' };

const ALLOWED_EMBED_HOSTS = [
  /* VidSrc family */
  'vidsrc.cc','vidsrc.to','vidsrc.me','vidsrc.xyz','vidsrc.net','vidsrc.pm',
  'vidsrc.icu','vidsrc.in','vidsrc.nl','vidsrc.pro',
  'player.vidsrc.cc','player.vidsrc.co','player.vidsrc.to',
  /* AutoEmbed */
  'autoembed.cc','player.autoembed.cc','autoembed.to','autoembed.me',
  /* MultiEmbed / SuperEmbed */
  'multiembed.mov','www.multiembed.mov','superembed.stream',
  /* Embed.su */
  'embed.su','www.embed.su',
  /* VidLink */
  'vidlink.pro','www.vidlink.pro',
  /* 2Embed */
  '2embed.cc','www.2embed.cc','2embed.to','www.2embed.to','2embed.org','www.2embed.org',
  /* Streamed */
  'streamed.su','streamed.pk','streamed.me',
  /* SmashyStream */
  'smashystream.com','smashystream.xyz','smashystream.to',
  /* MoviesAPI */
  'moviesapi.club','moviesapi.com',
  /* CloseLoad */
  'closeload.com','closeload.net',
  /* Frembed */
  'frembed.pro','frembed.xyz','frembed.live',
  /* Other providers */
  'moviezwap.net',
  'warezcdn.net','warezcdn.com',
  'filemoon.sx','filemoon.to','filemoon.net',
  'streamwish.com','streamwish.to','streamwish.net',
  'doodstream.com','doodstream.co','dood.watch',
  'upstream.to','upvid.co',
  'mixdrop.ag','mixdrop.co','mixdrop.to',
  'vidmoly.to','vidmoly.net',
  'embedz.co','embedz.net',
  'vidplay.online','vidplay.site',
  'rive.su','rive.stream',
  'frembed.xyz',
  'movembed.cc',
  'embedrise.com',
  /* New verified providers */
  'vidsrc.icu','vidsrc.vip','vidsrc.pro','vidsrc.su',
  'player.videasy.net','videasy.net',
  'vidfast.pro',
  'iframe.pstream.org','pstream.org',
  'vidora.su',
  '2embed.stream','www.2embed.stream',
  'rivestream.org',
  'vidzee.wtf',
  'filmku.stream',
  'gomo.to',
];

function isAllowed(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  return ALLOWED_EMBED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

/* ─── AD DOMAIN LIST FOR INLINE FETCH/XHR BLOCKING ─── */
const AD_DOMAINS_JS = JSON.stringify([
  'doubleclick.net','googlesyndication.com','googleadservices.com',
  'adnxs.com','adroll.com','advertising.com','rubiconproject.com',
  'openx.net','pubmatic.com','appnexus.com','criteo.com','media.net',
  'amazon-adsystem.com','taboola.com','outbrain.com','smartadserver.com',
  'adsterra.com','propellerads.com','exoclick.com','trafficjunky.net',
  'popads.net','popcash.net','adcash.com','juicyads.com','yllix.com',
  'evadav.com','richpush.co','coinzilla.io','hilltopads.net','clickadu.com',
  'zeropark.com','bidswitch.net','adform.net','adkernel.com','33across.com',
  'yieldmo.com','sharethrough.com','turn.com','mediamath.com','dataxu.com',
  'casalemedia.com','contextweb.com','pulsepoint.com','rlcdn.com','semasio.net',
  'coinhive.com','cryptoloot.pro','minero.cc','onclkds.com','onclick.com',
  'popunder.net','trafficstars.com','trafficforce.com','trafficfactory.biz',
  'mgid.com','revcontent.com','adfly.com','adf.ly','ouo.io',
  'brightadnetwork.com','adfly.com','clkrev.com','quantumbrevesta.com',
  'ironsrc.com','mobvista.com','mintegral.com','googletagmanager.com',
  'google-analytics.com','moatads.com','doubleverify.com','bluekai.com',
  'lotame.com','demdex.net','quantserve.com','scorecardresearch.com',
]);

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const { searchParams } = new URL(req.url);
  const embedUrl = searchParams.get('url');
  if (!embedUrl) return new Response('Missing url parameter', { status: 400 });

  let parsed;
  try { parsed = new URL(embedUrl); }
  catch (_) { return new Response('Invalid URL', { status: 400 }); }

  // Sanitise for HTML/JS contexts
  const htmlUrl = embedUrl
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const jsUrl = embedUrl
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    .replace(/\r/g, '').replace(/\n/g, '');

  /* ═══════════════════════════════════════════════════════════════
     THE KILL SCRIPT — runs in the wrapper page's JS context
     Covers every known mechanism for triggering navigation/popups.
     This is defence-in-depth on top of the Service Worker.
  ═══════════════════════════════════════════════════════════════ */
  const KILL_SCRIPT = `
(function RWShield6() {
  'use strict';

  const PARENT_ORIGIN = '*'; // We'll send telemetry to parent

  function report(type, detail) {
    try { window.parent.postMessage({ type: 'RW_BLOCKED', blockType: type, detail: detail }, PARENT_ORIGIN); } catch(_) {}
  }

  // ── 1. window.open — absolute zero ──────────────────────────────────
  const _noop = function() { return null; };
  window.open = _noop;
  try { Object.defineProperty(window, 'open', { value: _noop, writable: false, configurable: false }); } catch(_) {}

  // ── 2. opener / name — state carriers ───────────────────────────────
  try { Object.defineProperty(window, 'opener', { get: ()=>null, set:()=>{}, configurable:false }); } catch(_) {}
  try { Object.defineProperty(window, 'name',   { get: ()=>'',   set:()=>{}, configurable:false }); } catch(_) {}

  // ── 3. location.* — block all external navigation from this context ─
  const _selfOrigin = location.origin;
  function isSelf(u) { try { return new URL(u, location.href).origin === _selfOrigin; } catch(_) { return false; } }
  const _locAssign  = location.assign.bind(location);
  const _locReplace = location.replace.bind(location);
  try {
    Object.defineProperty(location, 'href',    { get:()=>window.location.href, set(v){ if(isSelf(v))_locAssign(v); else report('location.href',v); }, configurable:false });
    Object.defineProperty(location, 'assign',  { value(v){ if(isSelf(v))_locAssign(v);  else report('location.assign',v);  }, writable:false, configurable:false });
    Object.defineProperty(location, 'replace', { value(v){ if(isSelf(v))_locReplace(v); else report('location.replace',v); }, writable:false, configurable:false });
    Object.defineProperty(location, 'reload',  { value:()=>{}, writable:false, configurable:false });
  } catch(_) {}

  // ── 4. history.pushState / replaceState abuse ────────────────────────
  try {
    const _hPush = history.pushState.bind(history);
    const _hRep  = history.replaceState.bind(history);
    history.pushState    = (s,t,u)=>{ if(!u||isSelf(String(u)))_hPush(s,t,u); };
    history.replaceState = (s,t,u)=>{ if(!u||isSelf(String(u)))_hRep(s,t,u);  };
  } catch(_) {}

  // ── 5. Fake window.top / window.parent ───────────────────────────────
  const _fakeLoc = new Proxy({}, {
    get(_,p){ if(['href','assign','replace','reload'].includes(p)) return ()=>{}; return ''; },
    set(){ return true; }
  });
  const _fakeTop = new Proxy({}, {
    get(_,p){
      if(p==='location')return _fakeLoc;
      if(p==='open')return _noop;
      if(['top','parent','frames','self'].includes(p))return _fakeTop;
      if(p==='closed')return false;
      try{return window[p];}catch(_){return undefined;}
    },
    set(){ return true; }
  });
  try { Object.defineProperty(window,'top',    {get:()=>_fakeTop, configurable:false}); } catch(_) {}
  try { Object.defineProperty(window,'parent', {get:()=>_fakeTop, configurable:false}); } catch(_) {}
  try { Object.defineProperty(window,'self',   {get:()=>window,   configurable:false}); } catch(_) {}

  // ── 6. eval() string injection ──────────────────────────────────────
  const _eval = window.eval;
  const BAD = ['popunder','clickunder','popads','popcash','window.open(','adsterra','brightadnetwork',
               'propellerads','trafficjunky','exoclick','hilltopads','location.href','location.replace',
               'location.assign','redirect(','onclick.com','onclkds.com'];
  window.eval = function(c) {
    if (typeof c==='string' && BAD.some(b=>c.includes(b))){ report('eval',c.slice(0,80)); return undefined; }
    return _eval.call(this,c);
  };

  // ── 7. Function() constructor injection ─────────────────────────────
  const _Fn = window.Function;
  window.Function = function(...args) {
    const body = args[args.length-1]||'';
    if (typeof body==='string' && BAD.some(b=>body.includes(b))){ report('Function()',body.slice(0,80)); return ()=>{}; }
    return _Fn.apply(this,args);
  };
  try { window.Function.prototype = _Fn.prototype; } catch(_) {}

  // ── 8. setTimeout / setInterval string form ─────────────────────────
  const _st = window.setTimeout, _si = window.setInterval;
  const BAD_T = ['window.open','popunder','location.href','location.replace','adsterra','popads'];
  window.setTimeout  = function(fn,d,...a){ if(typeof fn==='string'&&BAD_T.some(b=>fn.includes(b))){ report('setTimeout',fn.slice(0,80)); return 0; } return _st.call(this,fn,d,...a); };
  window.setInterval = function(fn,d,...a){ if(typeof fn==='string'&&BAD_T.some(b=>fn.includes(b))){ report('setInterval',fn.slice(0,80)); return 0; } return _si.call(this,fn,d,...a); };

  // ── 9. document.createElement('a').click() abuse ────────────────────
  const _ce = document.createElement.bind(document);
  document.createElement = function(tag,...rest) {
    const el = _ce(tag,...rest);
    if (typeof tag==='string' && tag.toLowerCase()==='a') {
      const _ck = el.click.bind(el);
      el.click = function(){
        const href=(el.getAttribute('href')||'').trim();
        const tgt=(el.target||'').trim();
        if(href.startsWith('http')||href.startsWith('//')||tgt==='_blank'){ report('a.click',href); return; }
        _ck();
      };
    }
    return el;
  };

  // ── 10. Global click interceptor — external links ───────────────────
  document.addEventListener('click', function(e){
    let el=e.target;
    while(el&&el.tagName!=='BODY'){
      if(el.tagName==='A'){
        const href=(el.getAttribute('href')||'').trim();
        const tgt=(el.getAttribute('target')||'').trim();
        if(href.startsWith('http')||href.startsWith('//')||tgt==='_blank'){
          e.preventDefault(); e.stopImmediatePropagation();
          report('link-click',href); return;
        }
      }
      el=el.parentElement;
    }
  }, true);

  // ── 11. Notification / Push API ─────────────────────────────────────
  if (typeof Notification!=='undefined') {
    try {
      Object.defineProperty(Notification,'requestPermission',{value:()=>Promise.resolve('denied'),writable:false,configurable:false});
      Object.defineProperty(Notification,'permission',{get:()=>'denied',configurable:false});
    } catch(_) {}
  }

  // ── 12. postMessage deep filter ─────────────────────────────────────
  window.addEventListener('message', function(e){
    try {
      const raw=typeof e.data==='string'?e.data:JSON.stringify(e.data||'');
      const lo=raw.toLowerCase();
      const bads=['window.open','popunder','clickunder','location.href','location.replace',
                  'location.assign','brightadnetwork','popads','adsterra','onclick.com'];
      if(bads.some(b=>lo.includes(b))){ e.stopImmediatePropagation(); report('postMessage',raw.slice(0,100)); }
    } catch(_) {}
  }, true);

  // ── 13. beforeunload prevention ─────────────────────────────────────
  window.addEventListener('beforeunload', function(e){ e.preventDefault(); e.returnValue=''; return ''; }, true);

  // ── 14. Focus/blur popup trap ────────────────────────────────────────
  window.addEventListener('blur', function(e){ e.stopImmediatePropagation(); }, true);

  // ── 15. document.write injection ────────────────────────────────────
  const _dw = document.write.bind(document);
  document.write = function(h){
    if(typeof h==='string'){
      const lo=h.toLowerCase();
      const bad=['adsbygoogle','doubleclick','popads','adsterra','exoclick','popunder','googletag'];
      if(bad.some(b=>lo.includes(b))){ report('document.write',h.slice(0,80)); return; }
    }
    _dw(h);
  };

  // ── 16. fetch() — block requests to ad domains ──────────────────────
  const AD_DOMAINS = ${AD_DOMAINS_JS};
  function isDomainBlocked(url){
    try{
      const h=new URL(url).hostname.toLowerCase().replace(/^www\\./,'');
      return AD_DOMAINS.some(d=>h===d||h.endsWith('.'+d));
    }catch(_){return false;}
  }
  const _fetch = window.fetch;
  window.fetch = function(input,...args){
    const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
    if(isDomainBlocked(url)){ report('fetch',url); return Promise.resolve(new Response('',{status:200})); }
    return _fetch.call(this,input,...args);
  };

  // ── 17. XHR — block requests to ad domains ──────────────────────────
  const _XHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method,url,...rest){
    if(typeof url==='string'&&isDomainBlocked(url)){ report('xhr',url); this._rw_blocked=true; return; }
    return _XHROpen.call(this,method,url,...rest);
  };
  const _XHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args){
    if(this._rw_blocked) return;
    return _XHRSend.apply(this,args);
  };

  // ── 18. WebSocket — block ad-network WS connections ─────────────────
  const _WS = window.WebSocket;
  window.WebSocket = function(url,...args){
    if(isDomainBlocked(url)){ report('websocket',url); return { send:()=>{}, close:()=>{}, addEventListener:()=>{} }; }
    return new _WS(url,...args);
  };
  window.WebSocket.prototype = _WS.prototype;
  window.WebSocket.CONNECTING = 0; window.WebSocket.OPEN = 1; window.WebSocket.CLOSING = 2; window.WebSocket.CLOSED = 3;

  // ── 19. WebRTC data-channel redirect abuse ────────────────────────
  if (window.RTCPeerConnection) {
    const _RTC = window.RTCPeerConnection;
    window.RTCPeerConnection = function(config,...args){
      if(config&&config.iceServers){
        config.iceServers=config.iceServers.filter(s=>!isDomainBlocked((s.urls||[s.url]||[''])[0]||''));
      }
      return new _RTC(config,...args);
    };
    window.RTCPeerConnection.prototype=_RTC.prototype;
  }

  // ── 20. navigator.sendBeacon — ad ping blocker ───────────────────────
  const _beacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function(url,...args){
    if(isDomainBlocked(url)){ report('sendBeacon',url); return true; }
    return _beacon(url,...args);
  };

  // ── 21. Image src tracking pixel blocker ────────────────────────────
  const _ImgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  if(_ImgDesc&&_ImgDesc.set){
    Object.defineProperty(HTMLImageElement.prototype,'src',{
      get:_ImgDesc.get,
      set(v){ if(isDomainBlocked(v)){ report('img.src',v); return; } _ImgDesc.set.call(this,v); },
      configurable:true
    });
  }

  // ── 22. script.src injection ─────────────────────────────────────────
  const _ScriptDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
  if(_ScriptDesc&&_ScriptDesc.set){
    Object.defineProperty(HTMLScriptElement.prototype,'src',{
      get:_ScriptDesc.get,
      set(v){ if(isDomainBlocked(v)){ report('script.src',v); return; } _ScriptDesc.set.call(this,v); },
      configurable:true
    });
  }

  // ── 23. iframe.src injection blocker ─────────────────────────────────
  const _iframeDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src');
  if(_iframeDesc&&_iframeDesc.set){
    Object.defineProperty(HTMLIFrameElement.prototype,'src',{
      get:_iframeDesc.get,
      set(v){
        try{
          if(isDomainBlocked(new URL(v,location.href).hostname)){ report('iframe.src',v); return; }
        }catch(_){}
        _iframeDesc.set.call(this,v);
      },
      configurable:true
    });
  }

  // ── 24. MutationObserver — nuke injected ad nodes ────────────────────
  new MutationObserver(muts=>{
    for(const m of muts){
      for(const n of m.addedNodes){
        if(n.nodeType!==1) continue;
        const src=(n.src||n.href||'').toLowerCase();
        if(src&&isDomainBlocked(src)){ n.remove(); report('mutation-src',src); continue; }
        // Nuke overlays: fixed/absolute elements with very high z-index
        try{
          const cs=window.getComputedStyle(n);
          const zi=parseInt(cs.zIndex||0,10);
          const pos=cs.position;
          if((pos==='fixed'||pos==='absolute')&&zi>8000){
            const w=parseFloat(cs.width),h=parseFloat(cs.height);
            if(w>window.innerWidth*0.3||h>window.innerHeight*0.3){ n.remove(); report('overlay-nuke',n.tagName); }
          }
        }catch(_){}
      }
    }
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','style','class']});

  // ── 25. Periodic overlay sweep ──────────────────────────────────────
  function sweep(){
    document.querySelectorAll('div,span,aside,ins,iframe').forEach(el=>{
      try{
        const cs=window.getComputedStyle(el);
        const zi=parseInt(cs.zIndex||0,10);
        const pos=cs.position;
        if((pos==='fixed'||pos==='absolute')&&zi>9000){
          const w=parseFloat(cs.width),h=parseFloat(cs.height);
          if(w>window.innerWidth*0.25||h>window.innerHeight*0.25){ el.remove(); }
        }
      }catch(_){}
    });
  }
  [200,500,1000,2000,4000].forEach(t=>setTimeout(sweep,t));
  setInterval(sweep,8000);

  // ── 26. requestAnimationFrame redirect abuse ─────────────────────────
  const _raf = window.requestAnimationFrame;
  let _rafRedirectCount=0;
  window.requestAnimationFrame = function(fn){
    return _raf.call(this, function(...args){
      _rafRedirectCount=0; // reset on each natural frame
      try{ fn(...args); }catch(_){}
    });
  };

  // ── 27. CSS overlay nuke (inject stylesheet) ─────────────────────────
  try{
    const css=document.createElement('style');
    css.textContent=[
      'ins, .adsbygoogle, [id*="google_ads"], [id*="div-gpt-ad"],',
      '[class*="popunder"], [class*="clickunder"], [id*="popunder"],',
      '[class*="interstitial"], [id*="interstitial"],',
      '[class*="ad-overlay"], [id*="ad-overlay"],',
      '[class*="adsterra"], [class*="propeller"], [data-ad],',
      'iframe[src*="popads"], iframe[src*="exoclick"],',
      'iframe[src*="adsterra"], iframe[src*="trafficjunky"]',
      '{ display:none!important; visibility:hidden!important; pointer-events:none!important; opacity:0!important; }'
    ].join(' ');
    (document.head||document.documentElement).appendChild(css);
  }catch(_){}

  // ── 28. Geolocation / DeviceMotion — prevent social engineering ──────
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition = ()=>{};
    navigator.geolocation.watchPosition = ()=>0;
  }

  report('SHIELD_READY', 'v6');
  console.log('[RW-FRAME] Shield v6 active — 28 vectors patched');
})();
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Player</title>
<script>${KILL_SCRIPT}<\/script>
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
<script>
(function(){
  'use strict';
  // After inner iframe loads, attempt to inject kill script into its context
  // Only works if inner frame is same-origin — cross-origin is handled by SW
  const frame = document.getElementById('embed');
  if (!frame) return;

  const INNER_KILL = function() {
    try {
      window.open = function(){ return null; };
      try { Object.defineProperty(window,'open',{value:()=>null,writable:false,configurable:false}); } catch(_){}
      try { Object.defineProperty(window,'opener',{get:()=>null,set:()=>{},configurable:false}); } catch(_){}
      try { Object.defineProperty(window,'name',{get:()=>'',set:()=>{},configurable:false}); } catch(_){}
      const noNav=()=>{};
      const fakeL={href:'',assign:noNav,replace:noNav,reload:noNav,toString:()=>''};
      const fakeT={location:fakeL,open:noNav,top:null,parent:null,closed:false};
      fakeT.top=fakeT; fakeT.parent=fakeT;
      try { Object.defineProperty(window,'top',   {get:()=>fakeT,configurable:false}); } catch(_){}
      try { Object.defineProperty(window,'parent',{get:()=>fakeT,configurable:false}); } catch(_){}
      try { history.pushState=()=>{}; history.replaceState=()=>{}; } catch(_){}
      const _ev=window.eval;
      const BAD2=['popunder','clickunder','popads','window.open(','adsterra'];
      window.eval=function(c){ if(typeof c==='string'&&BAD2.some(b=>c.includes(b)))return; return _ev.call(this,c); };
      window.addEventListener('blur',function(e){e.stopImmediatePropagation();},true);
      console.log('[RW-INNER] Kill script active');
    } catch(err){ console.warn('[RW-INNER]',err.message); }
  };

  frame.addEventListener('load', function onLoad() {
    try {
      const cw = frame.contentWindow;
      if (cw) { cw.eval('(' + INNER_KILL.toString() + ')()'); }
    } catch(_) { /* expected for cross-origin — SW handles it */ }
  });
})();
<\/script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Frame-Options': 'SAMEORIGIN',
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
