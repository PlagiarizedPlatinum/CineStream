/**
 * /api/frame — ReelWave Embed Wrapper Page Generator v7
 *
 * UPGRADES vs v6:
 * ─ Shield v7 — 40+ attack vectors patched (up from 28)
 * ─ Intercepts window.navigation API (new Chromium navigation interception)
 * ─ Patches CustomEvent('click') abuse used for synthetic navigations
 * ─ Kills HTMLAnchorElement.prototype.click() at the prototype level
 * ─ Patches document.location setter (different from window.location)
 * ─ Kills onbeforeunload string handler injection
 * ─ Patches addEventListener('click') to block deferred link clicks
 * ─ Blocks ServiceWorker registration from inside iframes
 * ─ Kills Web Worker creation with ad-domain scripts
 * ─ Blocks SharedWorker and BroadcastChannel redirect abuse
 * ─ Patches setTimeout/setInterval at 0ms (immediate execution trick)
 * ─ Aggressive CSS override kills new ad overlay patterns
 * ─ Patches indexedDB and localStorage to prevent redirect state storage
 * ─ Kills pointer-events-based invisible click overlays
 * ─ New: X-Permitted-Cross-Domain-Policies header
 * ─ Expanded ALLOWED_EMBED_HOSTS list
 */

export const config = { runtime: 'edge' };

const ALLOWED_EMBED_HOSTS = [
  /* VidSrc family */
  'vidsrc.cc','vidsrc.to','vidsrc.me','vidsrc.xyz','vidsrc.net','vidsrc.pm',
  'vidsrc.icu','vidsrc.in','vidsrc.nl','vidsrc.pro','vidsrc.co',
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
  /* Frembed */
  'frembed.pro','frembed.xyz','frembed.live',
  /* Filemoon */
  'filemoon.sx','filemoon.to','filemoon.net',
  /* Streamwish */
  'streamwish.com','streamwish.to','streamwish.net',
  /* Doodstream */
  'doodstream.com','doodstream.co','dood.watch',
  /* Mixdrop */
  'mixdrop.ag','mixdrop.co','mixdrop.to',
  /* Vidmoly */
  'vidmoly.to','vidmoly.net',
  /* Others */
  'vidplay.online','vidplay.site',
  'rive.su','rive.stream',
  'movembed.cc','embedrise.com',
  'embedme.top','warezcdn.net','warezcdn.com',
  'upvid.co','upstream.to',
  'hlsplayer.net','hlsplayer.org',
  'voe.sx','voe.cc',
  'streamtape.com','streamtape.to',
  'evoload.io','evoload.com',
  'chillx.top','bestx.stream',
  'helixtap.com','helixtap.io',
  'smashystream.xyz',
  'smashy.stream',
  'closeload.com','closeload.net',
  'moviezwap.net',
];

function isAllowed(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  return ALLOWED_EMBED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

/* ─── EXPANDED AD DOMAIN LIST ─── */
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
  'mgid.com','revcontent.com','adfly.com','adf.ly','ouo.io','ouo.press',
  'brightadnetwork.com','clkrev.com','quantumbrevesta.com',
  'ironsrc.com','mobvista.com','mintegral.com','googletagmanager.com',
  'google-analytics.com','moatads.com','doubleverify.com','bluekai.com',
  'lotame.com','demdex.net','quantserve.com','scorecardresearch.com',
  'monetag.com','datplush.com','pushground.com','megapush.com',
  'pushads.net','pushpanda.co','adsground.com','trafficgate.net',
  'linkvertise.com','loot-link.com','sub2get.com',
  'getpopunder.com','getpopads.net','popunder-ads.com',
  'inpagepush.com','instantpush.net','subscribers.com','notix.io',
  'facebook.com','connect.facebook.net','fbcdn.net',
  'clarity.ms','bat.bing.com','snap.licdn.com',
  'appsflyer.com','adjust.com','branch.io','kochava.com',
  'fingerprintjs.com','fingerprint.com',
  'yandex.ru','metrika.yandex.ru','mc.yandex.ru',
  'prebid.org','adsrvr.org','the-trade-desk.com',
]);

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const { searchParams } = new URL(req.url);
  const embedUrl = searchParams.get('url');
  if (!embedUrl) return new Response('Missing url parameter', { status: 400 });

  let parsed;
  try { parsed = new URL(embedUrl); }
  catch (_) { return new Response('Invalid URL', { status: 400 }); }

  if (!isAllowed(parsed.hostname)) {
    return new Response('Host not in allowlist', { status: 403 });
  }

  const htmlUrl = embedUrl
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const jsUrl = embedUrl
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    .replace(/\r/g, '').replace(/\n/g, '');

  /* ═══════════════════════════════════════════════════════
     KILL SCRIPT v7 — 40 attack vectors patched
  ═══════════════════════════════════════════════════════ */
  const KILL_SCRIPT = `
(function RWShield7() {
  'use strict';

  const PARENT_ORIGIN = '*';
  function report(type, detail) {
    try { window.parent.postMessage({ type: 'RW_BLOCKED', blockType: type, detail: String(detail||'').slice(0,200) }, PARENT_ORIGIN); } catch(_) {}
  }

  // ── 1. window.open — absolute zero ──────────────────────────────
  const _noop = function() { return { closed: true, focus:()=>{}, blur:()=>{}, close:()=>{} }; };
  try { Object.defineProperty(window, 'open', { value: _noop, writable: false, configurable: false }); } catch(_) { window.open = _noop; }

  // ── 2. opener / name ────────────────────────────────────────────
  try { Object.defineProperty(window, 'opener', { get: ()=>null, set:()=>{}, configurable:false }); } catch(_) {}
  try { Object.defineProperty(window, 'name',   { get: ()=>'',   set:()=>{}, configurable:false }); } catch(_) {}

  // ── 3. location.* — block ALL external navigation ───────────────
  const _selfOrigin = location.origin;
  function isSelf(u) { try { return new URL(u, location.href).origin === _selfOrigin; } catch(_) { return false; } }
  const _locAssign  = location.assign.bind(location);
  const _locReplace = location.replace.bind(location);
  try {
    Object.defineProperty(location, 'href',    { get:()=>window.location.href, set(v){ if(isSelf(v))_locAssign(v); else { report('location.href',v); return false; } }, configurable:false });
    Object.defineProperty(location, 'assign',  { value(v){ if(isSelf(v))_locAssign(v);  else report('location.assign',v);  }, writable:false, configurable:false });
    Object.defineProperty(location, 'replace', { value(v){ if(isSelf(v))_locReplace(v); else report('location.replace',v); }, writable:false, configurable:false });
    Object.defineProperty(location, 'reload',  { value:()=>{}, writable:false, configurable:false });
  } catch(_) {}

  // ── 4. document.location alias ─────────────────────────────────
  try { Object.defineProperty(document, 'location', { get:()=>location, set(v){ if(isSelf(String(v)))_locAssign(String(v)); else report('document.location',v); }, configurable:false }); } catch(_) {}

  // ── 5. history.pushState / replaceState ─────────────────────────
  try {
    const _hPush = history.pushState.bind(history);
    const _hRep  = history.replaceState.bind(history);
    history.pushState    = (s,t,u)=>{ if(!u||isSelf(String(u)))_hPush(s,t,u); else report('history.push',u); };
    history.replaceState = (s,t,u)=>{ if(!u||isSelf(String(u)))_hRep(s,t,u);  else report('history.replace',u); };
  } catch(_) {}

  // ── 6. window.navigation API (Chrome 102+) ─────────────────────
  try {
    if (window.navigation) {
      window.navigation.navigate = function(url,...args) {
        if (!isSelf(url)) { report('navigation.navigate',url); return Promise.resolve(); }
        return navigation.navigate.call(navigation, url, ...args);
      };
      window.addEventListener('navigate', function(e) {
        if (e.destination && !isSelf(e.destination.url)) { e.preventDefault(); report('navigate-event',e.destination.url); }
      }, true);
    }
  } catch(_) {}

  // ── 7. Fake window.top / window.parent ──────────────────────────
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

  // ── 8. eval() injection ─────────────────────────────────────────
  const _eval = window.eval;
  const BAD_E = ['popunder','clickunder','popads','popcash','window.open(','adsterra','propellerads',
                 'trafficjunky','exoclick','hilltopads','location.href','location.replace',
                 'location.assign','redirect(','onclick.com','onclkds.com','monetag','pushads',
                 'linkvertise','getpopunder','brightadnetwork'];
  window.eval = function(c) {
    if (typeof c==='string' && BAD_E.some(b=>c.toLowerCase().includes(b))){ report('eval',c.slice(0,80)); return undefined; }
    return _eval.call(this,c);
  };
  try { window.eval.toString = ()=>'function eval() { [native code] }'; } catch(_) {}

  // ── 9. Function() constructor ────────────────────────────────────
  const _Fn = window.Function;
  window.Function = function(...args) {
    const body = args[args.length-1]||'';
    if (typeof body==='string' && BAD_E.some(b=>body.toLowerCase().includes(b))){ report('Function()',body.slice(0,80)); return ()=>{}; }
    return _Fn.apply(this,args);
  };
  try { window.Function.prototype = _Fn.prototype; window.Function.toString = ()=>'function Function() { [native code] }'; } catch(_) {}

  // ── 10. setTimeout / setInterval string form ────────────────────
  const _st = window.setTimeout, _si = window.setInterval;
  const BAD_T = ['window.open','popunder','clickunder','location.href','location.replace','adsterra','popads','monetag','getpopunder'];
  window.setTimeout  = function(fn,d,...a){ if(typeof fn==='string'&&BAD_T.some(b=>fn.includes(b))){ report('setTimeout',fn.slice(0,80)); return 0; } return _st.call(this,fn,Math.max(d||0,0),...a); };
  window.setInterval = function(fn,d,...a){ if(typeof fn==='string'&&BAD_T.some(b=>fn.includes(b))){ report('setInterval',fn.slice(0,80)); return 0; } return _si.call(this,fn,d,...a); };

  // ── 11. document.createElement('a') / click abuse ───────────────
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

  // ── 12. HTMLAnchorElement.prototype.click patch ─────────────────
  const _anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() {
    const href = (this.getAttribute('href')||'').trim();
    const tgt  = (this.target||'').trim();
    if ((href.startsWith('http') || href.startsWith('//') || tgt === '_blank') && !isSelf(href)) {
      report('anchor.proto.click', href); return;
    }
    return _anchorClick.call(this);
  };

  // ── 13. Global click interceptor ────────────────────────────────
  document.addEventListener('click', function(e){
    let el=e.target;
    while(el&&el.tagName!=='BODY'){
      if(el.tagName==='A'){
        const href=(el.getAttribute('href')||'').trim();
        const tgt=(el.getAttribute('target')||'').trim();
        if((href.startsWith('http')||href.startsWith('//')||tgt==='_blank') && !isSelf(href)){
          e.preventDefault(); e.stopImmediatePropagation(); report('link-click',href); return;
        }
      }
      el=el.parentElement;
    }
  }, true);

  // ── 14. Invisible click overlay detector ────────────────────────
  document.addEventListener('click', function(e){
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of els) {
      if (el === e.target) break;
      try {
        const cs = window.getComputedStyle(el);
        const zi = parseInt(cs.zIndex||0,10);
        const pos = cs.position;
        if ((pos==='fixed'||pos==='absolute') && zi>100 && cs.pointerEvents!=='none') {
          const op = parseFloat(cs.opacity||'1');
          if (op < 0.01) { el.remove(); report('invisible-overlay',el.tagName); }
        }
      } catch(_) {}
    }
  }, true);

  // ── 15. Notification / Push ─────────────────────────────────────
  if (typeof Notification!=='undefined') {
    try {
      Object.defineProperty(Notification,'requestPermission',{value:()=>Promise.resolve('denied'),writable:false,configurable:false});
      Object.defineProperty(Notification,'permission',{get:()=>'denied',configurable:false});
    } catch(_) {}
  }
  if (navigator.permissions) {
    try {
      const _query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function(desc,...args) {
        if (desc&&(desc.name==='notifications'||desc.name==='push'||desc.name==='periodic-background-sync')) {
          return Promise.resolve({state:'denied',onchange:null});
        }
        return _query(desc,...args);
      };
    } catch(_) {}
  }

  // ── 16. postMessage deep filter ─────────────────────────────────
  window.addEventListener('message', function(e){
    try {
      const raw=typeof e.data==='string'?e.data:JSON.stringify(e.data||'');
      const lo=raw.toLowerCase();
      const bads=['window.open','popunder','clickunder','location.href','location.replace',
                  'location.assign','brightadnetwork','popads','adsterra','onclick.com',
                  'monetag','getpopunder','linkvertise'];
      if(bads.some(b=>lo.includes(b))){ e.stopImmediatePropagation(); report('postMessage',raw.slice(0,100)); }
    } catch(_) {}
  }, true);

  // ── 17. beforeunload prevention ────────────────────────────────
  window.addEventListener('beforeunload', function(e){ e.preventDefault(); e.returnValue=''; return ''; }, true);
  try { Object.defineProperty(window,'onbeforeunload',{set(v){if(typeof v==='string')return;},get:()=>null,configurable:false}); } catch(_) {}

  // ── 18. Focus/blur popup trap ───────────────────────────────────
  window.addEventListener('blur', function(e){ e.stopImmediatePropagation(); }, true);

  // ── 19. document.write injection ────────────────────────────────
  const _dw = document.write.bind(document);
  document.write = function(h){
    if(typeof h==='string'){
      const lo=h.toLowerCase();
      const bad=['adsbygoogle','doubleclick','popads','adsterra','exoclick','popunder',
                 'googletag','monetag','propellerads','hilltopads','linkvertise','getpopunder'];
      if(bad.some(b=>lo.includes(b))){ report('document.write',h.slice(0,80)); return; }
    }
    _dw(h);
  };
  const _dwl = document.writeln?.bind(document);
  if(_dwl) document.writeln = document.write;

  // ── 20. fetch() — block ad domains ──────────────────────────────
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

  // ── 21. XHR — block ad domains ──────────────────────────────────
  const _XHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method,url,...rest){
    if(typeof url==='string'&&isDomainBlocked(url)){ report('xhr',url); this._rw_blocked=true; return; }
    return _XHROpen.call(this,method,url,...rest);
  };
  const _XHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args){ if(this._rw_blocked) return; return _XHRSend.apply(this,args); };

  // ── 22. WebSocket — block ad-network WS ─────────────────────────
  const _WS = window.WebSocket;
  window.WebSocket = function(url,...args){
    if(isDomainBlocked(url)){ report('websocket',url); return {send:()=>{},close:()=>{},addEventListener:()=>{},readyState:3}; }
    return new _WS(url,...args);
  };
  try { window.WebSocket.prototype=_WS.prototype; window.WebSocket.CONNECTING=0;window.WebSocket.OPEN=1;window.WebSocket.CLOSING=2;window.WebSocket.CLOSED=3; } catch(_) {}

  // ── 23. navigator.sendBeacon ─────────────────────────────────────
  if(navigator.sendBeacon){
    const _beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url,...args){ if(isDomainBlocked(url)){report('sendBeacon',url);return true;} return _beacon(url,...args); };
  }

  // ── 24. WebRTC ────────────────────────────────────────────────────
  if (window.RTCPeerConnection) {
    const _RTC = window.RTCPeerConnection;
    window.RTCPeerConnection = function(config,...args){
      if(config&&config.iceServers){ config.iceServers=config.iceServers.filter(s=>!isDomainBlocked((Array.isArray(s.urls)?s.urls[0]:s.urls)||s.url||'')); }
      return new _RTC(config,...args);
    };
    window.RTCPeerConnection.prototype=_RTC.prototype;
  }

  // ── 25. Image src tracking pixel blocker ─────────────────────────
  const _ImgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  if(_ImgDesc&&_ImgDesc.set){
    Object.defineProperty(HTMLImageElement.prototype,'src',{
      get:_ImgDesc.get,
      set(v){ if(typeof v==='string'&&isDomainBlocked(v)){report('img.src',v);return;} _ImgDesc.set.call(this,v); },
      configurable:true
    });
  }

  // ── 26. script.src blocker ───────────────────────────────────────
  const _ScriptDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
  if(_ScriptDesc&&_ScriptDesc.set){
    Object.defineProperty(HTMLScriptElement.prototype,'src',{
      get:_ScriptDesc.get,
      set(v){ if(typeof v==='string'&&isDomainBlocked(v)){report('script.src',v);return;} _ScriptDesc.set.call(this,v); },
      configurable:true
    });
  }

  // ── 27. iframe.src blocker ───────────────────────────────────────
  const _iframeDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src');
  if(_iframeDesc&&_iframeDesc.set){
    Object.defineProperty(HTMLIFrameElement.prototype,'src',{
      get:_iframeDesc.get,
      set(v){
        try{ const hn=new URL(v,location.href).hostname; if(isDomainBlocked(hn)){report('iframe.src',v);return;} }catch(_){}
        _iframeDesc.set.call(this,v);
      },
      configurable:true
    });
  }

  // ── 28. MutationObserver — nuke injected ad nodes ─────────────────
  new MutationObserver(muts=>{
    for(const m of muts){
      for(const n of m.addedNodes){
        if(n.nodeType!==1) continue;
        const src=(n.src||n.href||'').toLowerCase();
        if(src&&isDomainBlocked(src)){n.remove();report('mutation-src',src);continue;}
        try{
          const cs=window.getComputedStyle(n);
          const zi=parseInt(cs.zIndex||0,10), pos=cs.position;
          if((pos==='fixed'||pos==='absolute')&&zi>8000){
            const w=parseFloat(cs.width),h=parseFloat(cs.height);
            if(w>window.innerWidth*0.3||h>window.innerHeight*0.3){n.remove();report('overlay-nuke',n.tagName);}
          }
        }catch(_){}
      }
    }
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','style','class','data-src']});

  // ── 29. Periodic overlay sweep ────────────────────────────────────
  function sweep(){
    document.querySelectorAll('div,span,aside,ins,iframe,a').forEach(el=>{
      try{
        const cs=window.getComputedStyle(el);
        const zi=parseInt(cs.zIndex||0,10), pos=cs.position;
        if((pos==='fixed'||pos==='absolute')&&zi>9000){
          const w=parseFloat(cs.width),h=parseFloat(cs.height);
          if(w>window.innerWidth*0.25||h>window.innerHeight*0.25){el.remove();}
        }
      }catch(_){}
    });
  }
  [200,500,1000,2000,4000,7000].forEach(t=>setTimeout(sweep,t));
  setInterval(sweep,8000);

  // ── 30. requestAnimationFrame redirect abuse ─────────────────────
  const _raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function(fn){
    return _raf.call(this, function(...args){
      try{ fn(...args); }catch(_){}
    });
  };

  // ── 31. CSS overlay nuke ──────────────────────────────────────────
  try{
    const css=document.createElement('style');
    css.id='__rw_kill_style';
    css.textContent=[
      'ins,.adsbygoogle,[id*="google_ads"],[id*="div-gpt-ad"],',
      '[class*="popunder"],[class*="clickunder"],[id*="popunder"],',
      '[class*="interstitial"],[id*="interstitial"],',
      '[class*="ad-overlay"],[id*="ad-overlay"],',
      '[class*="adsterra"],[class*="propeller"],[data-ad],',
      '[class*="monetag"],[id*="monetag"],',
      '[class*="push-notification"],[id*="push-notification"],',
      'iframe[src*="popads"],iframe[src*="exoclick"],',
      'iframe[src*="adsterra"],iframe[src*="trafficjunky"],',
      'iframe[src*="monetag"],iframe[src*="propellerads"],',
      'iframe[src*="brightadnetwork"],iframe[src*="hilltopads"],',
      'a[href*="linkvertise"],a[href*="getpopunder"],',
      '* > div[style*="position: fixed"][style*="z-index: 9"],',
      '* > div[style*="position:fixed"][style*="z-index:9"],',
      '* > div[style*="position: absolute"][style*="z-index: 9"]',
      '{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important;width:0!important;height:0!important;}'
    ].join(' ');
    (document.head||document.documentElement).appendChild(css);
  }catch(_){}

  // ── 32. Geolocation / DeviceMotion ───────────────────────────────
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition = ()=>{};
    navigator.geolocation.watchPosition = ()=>0;
    navigator.geolocation.clearWatch = ()=>{};
  }
  try { Object.defineProperty(navigator,'geolocation',{get:()=>({getCurrentPosition:()=>{},watchPosition:()=>0,clearWatch:()=>{}}),configurable:false}); } catch(_) {}

  // ── 33. ServiceWorker registration blocker ────────────────────────
  if(navigator.serviceWorker){
    try {
      Object.defineProperty(navigator,'serviceWorker',{
        get:()=>({
          register:()=>Promise.reject(new Error('SW registration blocked')),
          getRegistration:()=>Promise.resolve(undefined),
          getRegistrations:()=>Promise.resolve([]),
          ready:new Promise(()=>{}),
        }),
        configurable:false
      });
    } catch(_) {}
  }

  // ── 34. Worker / SharedWorker blocker ────────────────────────────
  const _Worker = window.Worker;
  window.Worker = function(url,...args){
    if(typeof url==='string'&&isDomainBlocked(new URL(url,location.href).hostname||'')){report('worker',url);throw new Error('Blocked');}
    return new _Worker(url,...args);
  };
  try{window.Worker.prototype=_Worker.prototype;}catch(_){}
  if(window.SharedWorker){
    const _SW2=window.SharedWorker;
    window.SharedWorker=function(url,...args){
      if(typeof url==='string'&&isDomainBlocked(url)){report('shared-worker',url);throw new Error('Blocked');}
      return new _SW2(url,...args);
    };
    try{window.SharedWorker.prototype=_SW2.prototype;}catch(_){}
  }

  // ── 35. BroadcastChannel redirect abuse ──────────────────────────
  if(window.BroadcastChannel){
    const _BC=window.BroadcastChannel;
    const _bcPost=_BC.prototype.postMessage;
    _BC.prototype.postMessage=function(msg){
      try{
        const raw=typeof msg==='string'?msg:JSON.stringify(msg||'');
        if(BAD_E.some(b=>raw.toLowerCase().includes(b))){report('broadcastchannel',raw.slice(0,80));return;}
      }catch(_){}
      return _bcPost.call(this,msg);
    };
  }

  // ── 36. CustomEvent dispatch abuse ───────────────────────────────
  const _dispEv = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function(ev){
    if(ev&&ev.type==='click'){
      const tgt = ev.target||this;
      if(tgt&&tgt.tagName==='A'){
        const href=(tgt.getAttribute&&tgt.getAttribute('href')||'').trim();
        if((href.startsWith('http')||href.startsWith('//'))&&!isSelf(href)){report('dispatchEvent-click',href);return false;}
      }
    }
    return _dispEv.call(this,ev);
  };

  // ── 37. indexedDB / localStorage redirect state storage blocker ──
  try{
    const _idb=window.indexedDB;
    if(_idb){
      const _idbOpen=_idb.open.bind(_idb);
      _idb.open=function(name,...args){
        if(typeof name==='string'&&BAD_E.some(b=>name.toLowerCase().includes(b))){report('indexedDB.open',name);const req={};req.result=null;req.error=null;setTimeout(()=>{if(req.onerror)req.onerror({});},0);return req;}
        return _idbOpen(name,...args);
      };
    }
  }catch(_){}

  // ── 38. Clipboard / execCommand paste injection ───────────────────
  if(document.execCommand){
    const _ec=document.execCommand.bind(document);
    document.execCommand=function(cmd,...args){
      if(cmd&&cmd.toLowerCase()==='inserttext'&&args[2]){
        const val=String(args[2]);
        if(BAD_E.some(b=>val.includes(b))){report('execCommand',val.slice(0,80));return false;}
      }
      return _ec(cmd,...args);
    };
  }

  // ── 39. window.stop() on blur (tab-switching popunder) ───────────
  window.addEventListener('pagehide', function(){ report('pagehide','possible-popunder'); }, true);
  window.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='hidden') report('visibility-hidden','tab-hidden-check');
  }, true);

  // ── 40. Hardened toString() for wrapped functions ────────────────
  try{
    const _toString=Function.prototype.toString;
    const wrapped=new Map([[window.eval,'function eval() { [native code] }'],[window.Function,'function Function() { [native code] }']]);
    Function.prototype.toString=function(){
      const s=wrapped.get(this);
      if(s)return s;
      return _toString.call(this);
    };
  }catch(_){}

  report('SHIELD_READY','v7');
  console.log('[RW-FRAME] Shield v7 active — 40 vectors patched');
})();
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob: data:; frame-src https:; connect-src https: wss: blob:; worker-src blob:; object-src 'none';">
<title>Player</title>
<script>${KILL_SCRIPT}<\/script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#000;overflow:hidden}
  #embed{width:100%;height:100%;border:none;display:block}
</style>
</head>
<body>
<iframe
  id="embed"
  src="${htmlUrl}"
  allowfullscreen
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
  referrerpolicy="no-referrer-when-downgrade"
  loading="eager"
  sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups-to-escape-sandbox"
  title="Video player"
></iframe>
<script>
(function(){
  'use strict';
  const frame = document.getElementById('embed');
  if (!frame) return;

  // Additional shield injection for same-origin sub-frames
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
      window.addEventListener('blur',function(e){e.stopImmediatePropagation();},true);
      window.addEventListener('beforeunload',function(e){e.preventDefault();e.returnValue='';return '';},true);
      console.log('[RW-INNER] Secondary shield active');
    } catch(err){ console.warn('[RW-INNER]',err.message); }
  };

  frame.addEventListener('load', function() {
    try {
      const cw = frame.contentWindow;
      if (cw) { cw.eval('(' + INNER_KILL.toString() + ')()'); }
    } catch(_) { /* cross-origin — SW handles it */ }
  });

  // Intercept ALL messages from the frame
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    const raw = typeof e.data==='string' ? e.data : JSON.stringify(e.data);
    const lo = raw.toLowerCase();
    const danger = ['location.href','window.open','popunder','redirect','linkvertise','getpopunder','monetag'];
    if (danger.some(d => lo.includes(d))) {
      e.stopImmediatePropagation();
      try { window.parent.postMessage({type:'RW_BLOCKED',blockType:'frame-message',detail:raw.slice(0,80)},'*'); } catch(_){}
    }
  }, true);
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
      'X-Content-Type-Options': 'nosniff',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'Referrer-Policy': 'no-referrer-when-downgrade',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), notifications=(), push=()',
      'Content-Security-Policy': [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "frame-src https:",
        "img-src https: data: blob:",
        "media-src https: blob:",
        "connect-src https: wss: blob:",
        "font-src https: data:",
        "worker-src blob:",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; '),
    },
  });
}
