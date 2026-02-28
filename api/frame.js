/**
 * /api/frame — ReelWave Embed Wrapper v8 — ABSOLUTE AD NUKE EDITION
 *
 * Every technique implemented:
 *  ✓ window.open / opener / name / top / parent / self all poisoned
 *  ✓ location.href / assign / replace / reload all locked
 *  ✓ document.location aliased and locked
 *  ✓ history.pushState / replaceState locked to same-origin only
 *  ✓ window.navigation API (Chrome 102+) intercepted
 *  ✓ eval() / Function() constructor — keyword-based payload kill
 *  ✓ setTimeout / setInterval string-form blocked
 *  ✓ addEventListener POISONED GLOBALLY — all ad event vectors killed
 *  ✓ HTMLAnchorElement.prototype.click patched at prototype level
 *  ✓ document.createElement('a') click patched on creation
 *  ✓ Global click interceptor catches remaining link click attempts
 *  ✓ Invisible overlay detector
 *  ✓ fetch() blocked to all ad domains
 *  ✓ XMLHttpRequest blocked to all ad domains
 *  ✓ WebSocket KILLED except known video CDN hosts
 *  ✓ navigator.sendBeacon blocked
 *  ✓ WebRTC stripped of ad ice servers
 *  ✓ ServiceWorker registration blocked inside frame
 *  ✓ Worker / SharedWorker creation blocked for ad domains
 *  ✓ BroadcastChannel postMessage filtered
 *  ✓ postMessage deep filter
 *  ✓ MutationObserver TOTAL LOCKDOWN — every added node inspected
 *  ✓ Shadow DOM MutationObserver
 *  ✓ script/img/iframe/video src blocked for ad domains
 *  ✓ document.write / writeln blocked
 *  ✓ CSS nuke stylesheet — 60+ patterns
 *  ✓ Periodic sweep every 4s
 *  ✓ beforeunload / pagehide / blur traps
 *  ✓ Notification / Push permanently denied
 *  ✓ Geolocation / DeviceMotion blocked
 *  ✓ CustomEvent dispatch click abuse patched
 *  ✓ requestAnimationFrame wrapped
 *  ✓ Paranoid response headers: full Permissions-Policy
 *  ✓ NO sandbox attribute — embeds work fully
 */

export const config = { runtime: 'edge' };

/* ─── Known video CDN / stream WS hosts — everything else is killed ─── */
const WS_ALLOWED_HOSTS_JS = JSON.stringify([
  'vidsrc.cc','vidsrc.to','vidsrc.me','vidsrc.xyz','vidsrc.icu','vidsrc.pm',
  'player.autoembed.cc','autoembed.cc','multiembed.mov','embed.su',
  'vidlink.pro','2embed.stream','2embed.cc','rive.su','frembed.pro',
  'videasy.net','player.videasy.net','vidfast.pro','pstream.org',
  'iframe.pstream.org','vidora.su','smashystream.com',
  'streamed.su','streamed.pk','filemoon.sx','streamwish.com',
  'doodstream.com','mixdrop.co','vidmoly.to','vidplay.online',
  'cdn.jwplayer.com','content.jwplatform.com','cdn.plyr.io',
  'bitmovin.com','hlsplayer.net',
]);

/* ─── Ad domain list ─── */
const AD_DOMAINS_JS = JSON.stringify([
  'doubleclick.net','googlesyndication.com','pagead2.googlesyndication.com',
  'googleadservices.com','googletagmanager.com','googletagservices.com',
  'google-analytics.com','adservice.google.com','2mdn.net',
  'adnxs.com','adroll.com','advertising.com','rubiconproject.com',
  'openx.net','pubmatic.com','appnexus.com','criteo.com','media.net',
  'amazon-adsystem.com','casalemedia.com','contextweb.com','pulsepoint.com',
  'bidswitch.net','smartadserver.com','33across.com','adkernel.com','adform.net',
  'yieldmo.com','sharethrough.com','turn.com','mediamath.com','dataxu.com',
  'rlcdn.com','semasio.net','id5-sync.com','liveintent.com','spotx.tv',
  'freewheel.tv','fwmrm.net','imasdk.googleapis.com',
  'brightadnetwork.com','brightadnetwork.net',
  'exoclick.com','exoclick.net','exosrv.com',
  'trafficjunky.net','trafficjunky.com',
  'popads.net','popcash.net','propellerads.com','propeller-ads.com',
  'adsterra.com','adsterra.network','adcash.com','juicyads.com','yllix.com',
  'evadav.com','richpush.co','coinzilla.io','hilltopads.net','clickadu.com',
  'zeropark.com','mgid.com','revcontent.com','taboola.com','outbrain.com',
  'adfly.com','adf.ly','ouo.io','ouo.press',
  'clkrev.com','quantumbrevesta.com','onclkds.com','onclick.com','onclickads.net',
  'popunder.net','trafficstars.com','trafficforce.com','trafficfactory.biz',
  'ironsrc.com','mobvista.com','mintegral.com',
  'getpopunder.com','getpopads.net','popunder-ads.com',
  'monetag.com','push.monetag.com',
  'pushground.com','megapush.com','pushads.net','pushpanda.co',
  'inpagepush.com','instantpush.net','subscribers.com','notix.io',
  'linkvertise.com','loot-link.com','sub2get.com',
  'adsground.com','trafficgate.net',
  'moatads.com','doubleverify.com','bluekai.com','lotame.com',
  'demdex.net','quantserve.com','scorecardresearch.com','comscore.com',
  'adsafeprotected.com','eyeota.com','adloox.com','pixalate.com',
  'springserve.com','yieldlab.net',
  'segment.io','mixpanel.com','amplitude.com','heap.io',
  'fullstory.com','hotjar.com','logrocket.com','clarity.ms',
  'appsflyer.com','adjust.com','branch.io','kochava.com',
  'fingerprintjs.com','fingerprint.com',
  'connect.facebook.net','fbcdn.net','analytics.twitter.com',
  'snap.licdn.com','tr.snapchat.com','analytics.tiktok.com',
  'mc.yandex.ru','metrika.yandex.ru','top.mail.ru',
  'adsrvr.org','the-trade-desk.com','prebid.org',
  'bat.bing.com','1rx.io','mathtag.com','atdmt.com','flashtalking.com',
  'coinhive.com','cryptoloot.pro','minero.cc','webminepool.com',
]);

/* ─── Allowed embed hosts ─── */
const ALLOWED_EMBED_HOSTS = [
  'vidsrc.cc','vidsrc.to','vidsrc.me','vidsrc.xyz','vidsrc.net','vidsrc.pm',
  'vidsrc.icu','vidsrc.in','vidsrc.nl','vidsrc.pro','vidsrc.co','vidsrc.vip','vidsrc.su',
  'player.vidsrc.cc','player.vidsrc.co','player.vidsrc.to',
  'autoembed.cc','player.autoembed.cc','autoembed.to','autoembed.me',
  'multiembed.mov','www.multiembed.mov','superembed.stream',
  'embed.su','www.embed.su',
  'vidlink.pro','www.vidlink.pro',
  '2embed.cc','www.2embed.cc','2embed.to','2embed.org','2embed.stream','www.2embed.stream',
  'streamed.su','streamed.pk','streamed.me',
  'smashystream.com','smashystream.xyz','smashystream.to','player.smashy.stream',
  'moviesapi.club','moviesapi.com',
  'closeload.com','closeload.net',
  'frembed.pro','frembed.xyz','frembed.live',
  'moviezwap.net','warezcdn.net','warezcdn.com',
  'filemoon.sx','filemoon.to','filemoon.net',
  'streamwish.com','streamwish.to','streamwish.net',
  'doodstream.com','doodstream.co','dood.watch',
  'upstream.to','upvid.co',
  'mixdrop.ag','mixdrop.co','mixdrop.to',
  'vidmoly.to','vidmoly.net',
  'vidplay.online','vidplay.site',
  'rive.su','rive.stream','rivestream.org',
  'movembed.cc','embedrise.com','embedme.top',
  'player.videasy.net','videasy.net',
  'vidfast.pro',
  'iframe.pstream.org','pstream.org',
  'vidora.su',
  'vidzee.wtf','filmku.stream','gomo.to',
  'voe.sx','voe.cc',
  'streamtape.com','streamtape.to',
  'evoload.io','chillx.top','bestx.stream',
  'cdn.jwplayer.com','content.jwplatform.com','jwplatform.com',
  'cdn.plyr.io','bitmovin.com',
  'hlsplayer.net','hlsplayer.org',
  'cdnjs.cloudflare.com','cdn.jsdelivr.net',
  'image.tmdb.org','api.themoviedb.org',
];

function isAllowed(hostname) {
  if (!hostname) return false;
  hostname = hostname.toLowerCase();
  return ALLOWED_EMBED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

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

  const KILL_SCRIPT = `(function RWShield8(){
'use strict';
function report(t,d){try{window.parent.postMessage({type:'RW_BLOCKED',blockType:t,detail:String(d||'').slice(0,200)},'*');}catch(_){}}

/* 1. window.open / opener / name */
const _noop=()=>({closed:true,focus:()=>{},blur:()=>{},close:()=>{}});
try{Object.defineProperty(window,'open',{value:_noop,writable:false,configurable:false});}catch(_){window.open=_noop;}
try{Object.defineProperty(window,'opener',{get:()=>null,set:()=>{},configurable:false});}catch(_){}
try{Object.defineProperty(window,'name',{get:()=>'',set:()=>{},configurable:false});}catch(_){}

/* 2. location — lock ALL navigation */
const _selfOrigin=location.origin;
function isSelf(u){try{return new URL(u,location.href).origin===_selfOrigin;}catch(_){return false;}}
const _la=location.assign.bind(location),_lr=location.replace.bind(location);
try{
  Object.defineProperty(location,'href',{get:()=>window.location.href,set(v){if(isSelf(v))_la(v);else{report('loc.href',v);return false;}},configurable:false});
  Object.defineProperty(location,'assign',{value(v){if(isSelf(v))_la(v);else report('loc.assign',v);},writable:false,configurable:false});
  Object.defineProperty(location,'replace',{value(v){if(isSelf(v))_lr(v);else report('loc.replace',v);},writable:false,configurable:false});
  Object.defineProperty(location,'reload',{value:()=>{},writable:false,configurable:false});
}catch(_){}
try{Object.defineProperty(document,'location',{get:()=>location,set(v){if(isSelf(String(v)))_la(String(v));else report('doc.loc',v);},configurable:false});}catch(_){}

/* 3. history — same-origin only */
try{
  const _hp=history.pushState.bind(history),_hre=history.replaceState.bind(history);
  history.pushState=(s,t,u)=>{if(!u||isSelf(String(u)))_hp(s,t,u);else report('h.push',u);};
  history.replaceState=(s,t,u)=>{if(!u||isSelf(String(u)))_hre(s,t,u);else report('h.rep',u);};
}catch(_){}

/* 4. window.navigation API Chrome 102+ */
try{
  if(window.navigation){
    const _nv=window.navigation.navigate?.bind(window.navigation);
    if(_nv)window.navigation.navigate=function(url,...a){if(!isSelf(url)){report('nav.api',url);return Promise.resolve();}return _nv(url,...a);};
    window.addEventListener('navigate',e=>{if(e.destination&&!isSelf(e.destination.url)){e.preventDefault();report('nav.evt',e.destination.url);}},true);
  }
}catch(_){}

/* 5. Fake top / parent */
const _fL=new Proxy({},{get(_,p){if(['href','assign','replace','reload'].includes(p))return()=>{};return '';},set(){return true;}});
const _fT=new Proxy({},{get(_,p){if(p==='location')return _fL;if(p==='open')return _noop;if(['top','parent','frames','self'].includes(p))return _fT;if(p==='closed')return false;try{return window[p];}catch(_){return undefined;}},set(){return true;}});
try{Object.defineProperty(window,'top',{get:()=>_fT,configurable:false});}catch(_){}
try{Object.defineProperty(window,'parent',{get:()=>_fT,configurable:false});}catch(_){}
try{Object.defineProperty(window,'self',{get:()=>window,configurable:false});}catch(_){}

/* 6. eval / Function constructor */
const BAD_KW=['popunder','clickunder','popads','popcash','window.open(','adsterra',
  'propellerads','trafficjunky','exoclick','hilltopads','monetag','getpopunder',
  'location.href=','location.replace(','location.assign(','redirect(','onclick.com',
  'onclkds.com','linkvertise','brightadnetwork','pushground','getpopads'];
const _ev=window.eval;
window.eval=function(c){if(typeof c==='string'&&BAD_KW.some(b=>c.toLowerCase().includes(b))){report('eval',c.slice(0,80));return undefined;}return _ev.call(this,c);};
const _Fn=window.Function;
window.Function=function(...a){const body=a[a.length-1]||'';if(typeof body==='string'&&BAD_KW.some(b=>body.toLowerCase().includes(b))){report('Fn()',body.slice(0,80));return()=>{};}return _Fn.apply(this,a);};
try{window.Function.prototype=_Fn.prototype;}catch(_){}

/* 7. setTimeout / setInterval string form */
const _st=window.setTimeout,_si=window.setInterval;
window.setTimeout=function(fn,d,...a){if(typeof fn==='string'&&BAD_KW.some(b=>fn.includes(b))){report('stout',fn.slice(0,80));return 0;}return _st.call(this,fn,d,...a);};
window.setInterval=function(fn,d,...a){if(typeof fn==='string'&&BAD_KW.some(b=>fn.includes(b))){report('sival',fn.slice(0,80));return 0;}return _si.call(this,fn,d,...a);};

/* 8. POISON addEventListener GLOBALLY
   Wraps every listener on mouse/touch/click/focus events so we can
   snapshot location before and after the handler fires, then reverse
   any external navigation it tries to perform. */
const _aEL=EventTarget.prototype.addEventListener;
const _rEL=EventTarget.prototype.removeEventListener;
const AD_EVTS=new Set(['mousedown','pointerdown','touchstart','touchend','click','focus','blur','visibilitychange']);
const _wm=new WeakMap();
function wrapFn(type,fn){
  if(typeof fn!=='function'||!AD_EVTS.has(type))return fn;
  if(_wm.has(fn))return _wm.get(fn);
  const w=function(e){
    const prev=window.location.href;
    try{fn.call(this,e);}catch(_){}
    try{if(window.location.href!==prev&&!isSelf(window.location.href)){window.location.replace(prev);report('evt-nav',window.location.href);}}catch(_){}
  };
  _wm.set(fn,w);
  return w;
}
EventTarget.prototype.addEventListener=function(type,fn,opts){return _aEL.call(this,type,wrapFn(type,fn),opts);};
EventTarget.prototype.removeEventListener=function(type,fn,opts){return _rEL.call(this,type,_wm.get(fn)||fn,opts);};

/* 9. HTMLAnchorElement prototype click */
const _aClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){
  const href=(this.getAttribute('href')||'').trim();
  if((href.startsWith('http')||href.startsWith('//'))&&!isSelf(href)){report('a.proto.click',href);return;}
  return _aClick.call(this);
};

/* 10. document.createElement('a') patch */
const _ce=document.createElement.bind(document);
document.createElement=function(tag,...rest){
  const el=_ce(tag,...rest);
  if(typeof tag==='string'&&tag.toLowerCase()==='a'){
    const _ck=el.click.bind(el);
    el.click=function(){
      const href=(el.getAttribute('href')||'').trim();
      if((href.startsWith('http')||href.startsWith('//'))&&!isSelf(href)){report('a.create.click',href);return;}
      _ck();
    };
  }
  return el;
};

/* 11. Global click interceptor */
document.addEventListener('click',function(e){
  let el=e.target;
  while(el&&el.tagName!=='BODY'){
    if(el.tagName==='A'){
      const href=(el.getAttribute('href')||'').trim();
      const tgt=(el.getAttribute('target')||'').trim();
      if(((href.startsWith('http')||href.startsWith('//'))&&!isSelf(href))||tgt==='_blank'){
        e.preventDefault();e.stopImmediatePropagation();report('link-click',href);return;
      }
    }
    el=el.parentElement;
  }
},true);

/* 12. Invisible overlay click detector */
document.addEventListener('click',function(e){
  try{
    const els=document.elementsFromPoint(e.clientX,e.clientY);
    for(const el of els){
      if(el===e.target)break;
      const cs=window.getComputedStyle(el);
      const zi=parseInt(cs.zIndex||0,10),pos=cs.position;
      if((pos==='fixed'||pos==='absolute')&&zi>50){
        const op=parseFloat(cs.opacity||'1');
        if(op<0.05){el.remove();report('invis-overlay',el.tagName);}
      }
    }
  }catch(_){}
},true);

/* 13. beforeunload / blur / pagehide traps */
window.addEventListener('beforeunload',function(e){e.preventDefault();e.returnValue='';return '';},true);
window.addEventListener('blur',function(e){e.stopImmediatePropagation();},true);
window.addEventListener('pagehide',function(e){e.stopImmediatePropagation();},true);
try{Object.defineProperty(window,'onbeforeunload',{set(v){if(typeof v==='string')return;},get:()=>null,configurable:false});}catch(_){}

/* 14. Notifications / Push */
try{
  if(typeof Notification!=='undefined'){
    Object.defineProperty(Notification,'requestPermission',{value:()=>Promise.resolve('denied'),writable:false,configurable:false});
    Object.defineProperty(Notification,'permission',{get:()=>'denied',configurable:false});
  }
}catch(_){}
try{
  if(navigator.permissions){
    const _pq=navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query=function(d,...a){
      if(d&&['notifications','push','periodic-background-sync'].includes(d.name))return Promise.resolve({state:'denied',onchange:null});
      return _pq(d,...a);
    };
  }
}catch(_){}

/* 15. postMessage deep filter */
window.addEventListener('message',function(e){
  try{
    const raw=typeof e.data==='string'?e.data:JSON.stringify(e.data||'');
    if(BAD_KW.some(b=>raw.toLowerCase().includes(b))){e.stopImmediatePropagation();report('postMsg',raw.slice(0,100));}
  }catch(_){}
},true);

/* 16. document.write / writeln */
const _dw=document.write.bind(document);
document.write=function(h){if(typeof h==='string'&&BAD_KW.some(b=>h.toLowerCase().includes(b))){report('doc.write',h.slice(0,80));return;}_dw(h);};
document.writeln=document.write;

/* 17. AD DOMAIN helpers */
const AD_DOMAINS=${AD_DOMAINS_JS};
function isAD(url){try{const h=new URL(url).hostname.toLowerCase().replace(/^www\\./,'');return AD_DOMAINS.some(d=>h===d||h.endsWith('.'+d));}catch(_){return false;}}

/* 18. fetch() */
const _ft=window.fetch;
window.fetch=function(input,...args){
  const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
  if(isAD(url)){report('fetch',url);return Promise.resolve(new Response('',{status:200}));}
  return _ft.call(this,input,...args);
};

/* 19. XMLHttpRequest */
const _xo=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,url,...r){
  if(typeof url==='string'&&isAD(url)){report('xhr',url);this._rwBlk=true;return;}
  return _xo.call(this,m,url,...r);
};
const _xs=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send=function(...a){if(this._rwBlk)return;return _xs.apply(this,a);};

/* 20. WebSocket — KILL ALL except known stream CDNs */
const WS_OK=${WS_ALLOWED_HOSTS_JS};
function wsOK(url){try{const h=new URL(url).hostname.toLowerCase().replace(/^www\\./,'');return WS_OK.some(d=>h===d||h.endsWith('.'+d));}catch(_){return false;}}
const _WS=window.WebSocket;
window.WebSocket=function(url,...args){
  if(!wsOK(url)){report('ws-blocked',url);return{send:()=>{},close:()=>{},addEventListener:()=>{},removeEventListener:()=>{},readyState:3,CLOSED:3};}
  return new _WS(url,...args);
};
try{window.WebSocket.prototype=_WS.prototype;Object.assign(window.WebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3});}catch(_){}

/* 21. sendBeacon */
if(navigator.sendBeacon){const _b=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(url,...a){if(isAD(url)){report('beacon',url);return true;}return _b(url,...a);};}

/* 22. WebRTC */
if(window.RTCPeerConnection){
  const _RTC=window.RTCPeerConnection;
  window.RTCPeerConnection=function(cfg,...a){
    if(cfg&&cfg.iceServers)cfg.iceServers=cfg.iceServers.filter(s=>!isAD((Array.isArray(s.urls)?s.urls[0]:s.urls)||s.url||''));
    return new _RTC(cfg,...a);
  };
  window.RTCPeerConnection.prototype=_RTC.prototype;
}

/* 23. ServiceWorker block inside frame */
try{
  if(navigator.serviceWorker){
    Object.defineProperty(navigator,'serviceWorker',{
      get:()=>({register:()=>Promise.reject(new Error('Blocked')),getRegistration:()=>Promise.resolve(undefined),getRegistrations:()=>Promise.resolve([]),ready:new Promise(()=>{})}),
      configurable:false
    });
  }
}catch(_){}

/* 24. Worker / SharedWorker */
if(window.Worker){const _W=window.Worker;window.Worker=function(url,...a){try{if(isAD(new URL(url,location.href).href)){report('worker',url);throw new Error('Blocked');}}catch(e){if(e.message==='Blocked')throw e;}return new _W(url,...a);};try{window.Worker.prototype=_W.prototype;}catch(_){}}
if(window.SharedWorker){const _SW=window.SharedWorker;window.SharedWorker=function(url,...a){if(isAD(url)){report('sw',url);throw new Error('Blocked');}return new _SW(url,...a);};try{window.SharedWorker.prototype=_SW.prototype;}catch(_){}}

/* 25. BroadcastChannel */
if(window.BroadcastChannel){
  const _bcp=BroadcastChannel.prototype.postMessage;
  BroadcastChannel.prototype.postMessage=function(msg){
    try{const r=typeof msg==='string'?msg:JSON.stringify(msg||'');if(BAD_KW.some(b=>r.toLowerCase().includes(b))){report('broadcast',r.slice(0,80));return;}}catch(_){}
    return _bcp.call(this,msg);
  };
}

/* 26. src/href property blockers */
function patchSrc(proto){
  const d=Object.getOwnPropertyDescriptor(proto,'src');
  if(d&&d.set)Object.defineProperty(proto,'src',{get:d.get,set(v){if(typeof v==='string'&&isAD(v)){report('src',v);return;}d.set.call(this,v);},configurable:true});
}
[HTMLScriptElement,HTMLImageElement,HTMLIFrameElement,HTMLVideoElement].forEach(C=>{try{patchSrc(C.prototype);}catch(_){}});

/* 27. CustomEvent dispatch click */
const _de=EventTarget.prototype.dispatchEvent;
EventTarget.prototype.dispatchEvent=function(ev){
  if(ev&&ev.type==='click'){const t=ev.target||this;if(t&&t.tagName==='A'){const h=(t.getAttribute&&t.getAttribute('href')||'').trim();if((h.startsWith('http')||h.startsWith('//'))&&!isSelf(h)){report('dispatch.click',h);return false;}}}
  return _de.call(this,ev);
};

/* 28. requestAnimationFrame */
const _raf=window.requestAnimationFrame;
window.requestAnimationFrame=function(fn){return _raf.call(this,function(...a){try{fn(...a);}catch(_){}});};

/* 29. Geolocation */
try{Object.defineProperty(navigator,'geolocation',{get:()=>({getCurrentPosition:()=>{},watchPosition:()=>0,clearWatch:()=>{}}),configurable:false});}catch(_){}

/* 30. TOTAL MutationObserver lockdown */
const AD_CLS=/adsbygoogle|doubleclick|popunder|clickunder|interstitial|ad-overlay|adsterra|propeller|monetag|push-notif|push-overlay|exoclick|popads|trafficjunky|brightadnetwork|hilltopads|linkvertise|getpopunder|banner-ad|advertisement|sponsored|dfp-ad|gam-ad/i;
const AD_ID=/google_ads|div-gpt-ad|popunder|interstitial|ad-overlay|monetag|push-notif|push-overlay/i;
function isAdEl(n){
  if(!n||n.nodeType!==1)return false;
  const id=n.id||'',cls=typeof n.className==='string'?n.className:'';
  if(AD_ID.test(id)||AD_CLS.test(cls))return true;
  const src=n.src||n.href||n.getAttribute?.('data-src')||'';
  if(src&&isAD(src))return true;
  if((n.tagName||'').toLowerCase()==='ins')return true;
  return false;
}
function nuke(n){if(n&&n.parentNode){n.remove();report('mo-nuke',(n.id||n.className||n.tagName||'').slice(0,40));}}
function chkOverlay(n){
  try{
    const cs=window.getComputedStyle(n),zi=parseInt(cs.zIndex||0,10),pos=cs.position;
    if((pos==='fixed'||pos==='absolute')&&zi>8000){
      const w=parseFloat(cs.width),h=parseFloat(cs.height);
      if(w>window.innerWidth*0.25||h>window.innerHeight*0.25)nuke(n);
    }
  }catch(_){}
}
new MutationObserver(muts=>{
  for(const m of muts){
    if(m.type==='attributes'){const n=m.target;if(isAdEl(n)){nuke(n);continue;}if(m.attributeName==='style'||m.attributeName==='class')chkOverlay(n);}
    for(const n of m.addedNodes){
      if(n.nodeType!==1)continue;
      if(isAdEl(n)){nuke(n);continue;}
      chkOverlay(n);
      try{n.querySelectorAll('script,iframe,ins,div,span').forEach(c=>{if(isAdEl(c))nuke(c);});}catch(_){}
    }
  }
}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','data-src','style','class','id']});

/* 31. Shadow DOM observer */
const _aShadow=Element.prototype.attachShadow;
Element.prototype.attachShadow=function(init){
  const root=_aShadow.call(this,init);
  new MutationObserver(muts=>{for(const m of muts)for(const n of m.addedNodes){if(n.nodeType!==1)continue;if(isAdEl(n)){nuke(n);continue;}const s=n.src||n.href||'';if(s&&isAD(s))nuke(n);}}).observe(root,{childList:true,subtree:true});
  return root;
};

/* 32. Periodic sweep every 4s */
const AD_SEL=[
  '.adsbygoogle','[id*="google_ads"]','[id*="div-gpt-ad"]',
  '[class*="popunder"]','[class*="clickunder"]','[id*="popunder"]',
  '[class*="interstitial"]','[id*="interstitial"]',
  '[class*="ad-overlay"]','[id*="ad-overlay"]',
  '[class*="adsterra"]','[class*="propeller"]','[data-ad]',
  '[class*="monetag"]','[id*="monetag"]',
  '[class*="push-notif"]','[class*="push-overlay"]',
  'iframe[src*="popads"]','iframe[src*="popcash"]',
  'iframe[src*="exoclick"]','iframe[src*="trafficjunky"]',
  'iframe[src*="adsterra"]','iframe[src*="hilltopads"]',
  'iframe[src*="doubleclick"]','iframe[src*="googlesyndication"]',
  'iframe[src*="monetag"]','iframe[src*="propellerads"]',
  'iframe[src*="getpopunder"]','iframe[src*="brightadnetwork"]',
  'a[href*="linkvertise"]','a[href*="getpopunder"]','a[href*="sub2get"]',
  'ins',
].join(',');
function sweep(){
  try{document.querySelectorAll(AD_SEL).forEach(el=>{if(el.id!=='embed')el.remove();});}catch(_){}
  try{document.querySelectorAll('div,span,section,aside,article,iframe').forEach(el=>{
    if(el.id==='embed')return;
    try{const cs=window.getComputedStyle(el),zi=parseInt(cs.zIndex||0,10),pos=cs.position;
    if((pos==='fixed'||pos==='absolute')&&zi>8000){const w=parseFloat(cs.width),h=parseFloat(cs.height);if(w>window.innerWidth*0.25||h>window.innerHeight*0.25)el.remove();}}catch(_){}
  });}catch(_){}
}
[100,300,700,1200,2000,3500,6000].forEach(t=>setTimeout(sweep,t));
setInterval(sweep,4000);

/* 33. CSS nuke stylesheet */
try{
  const s=document.createElement('style');s.id='__rwkill';
  s.textContent='.adsbygoogle,[id*="google_ads"],[id*="div-gpt-ad"],[class*="popunder"],[class*="clickunder"],[id*="popunder"],[class*="interstitial"],[id*="interstitial"],[class*="ad-overlay"],[id*="ad-overlay"],[class*="adsterra"],[class*="propeller"],[data-ad],[class*="monetag"],[id*="monetag"],[class*="push-notif"],[class*="push-overlay"],[id*="push-overlay"],[class*="push-dialog"],[class*="ntf-"],[class*="notification-bar"],[class*="popx"],[class*="popad"],[class*="aff-overlay"],[class*="aff-popup"],iframe[src*="popads"],iframe[src*="popcash"],iframe[src*="exoclick"],iframe[src*="trafficjunky"],iframe[src*="adsterra"],iframe[src*="hilltopads"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="monetag"],iframe[src*="propellerads"],iframe[src*="getpopunder"],iframe[src*="brightadnetwork"],a[href*="linkvertise"],a[href*="getpopunder"],a[href*="sub2get"],a[href*="adf.ly"],a[href*="ouo.io"],ins{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important;width:0!important;height:0!important;}';
  (document.head||document.documentElement).appendChild(s);
}catch(_){}

report('SHIELD_READY','v8');
console.log('[RW-FRAME] Shield v8 ABSOLUTE NUKE active — 33 vectors');
})();`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Player</title>
<script>${KILL_SCRIPT}<\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#000;overflow:hidden}#embed{width:100%;height:100%;border:none;display:block}</style>
</head>
<body>
<iframe
  id="embed"
  src="${htmlUrl}"
  allowfullscreen
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
  referrerpolicy="no-referrer-when-downgrade"
  loading="eager"
  title="Video player"
></iframe>
<script>
(function(){
  'use strict';
  const frame=document.getElementById('embed');
  if(!frame)return;
  frame.addEventListener('load',function(){
    try{const cw=frame.contentWindow;if(cw)cw.eval('(function(){try{window.open=()=>null;Object.defineProperty(window,"open",{value:()=>null,writable:false,configurable:false});}catch(_){}try{Object.defineProperty(window,"opener",{get:()=>null,set:()=>{},configurable:false});}catch(_){}window.addEventListener("blur",e=>e.stopImmediatePropagation(),true);window.addEventListener("beforeunload",e=>{e.preventDefault();e.returnValue="";return "";},true);}catch(_){}})()');
    }catch(_){}
  });
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='RW_BLOCKED'){try{window.parent.postMessage(e.data,'*');}catch(_){}}
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
      'X-Content-Type-Options': 'nosniff',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'Referrer-Policy': 'no-referrer-when-downgrade',
      'Permissions-Policy': [
        'geolocation=()', 'microphone=()', 'camera=()', 'payment=()',
        'usb=()', 'notifications=()', 'push=()', 'interest-cohort=()',
        'browsing-topics=()', 'ambient-light-sensor=()', 'battery=()',
        'display-capture=()', 'document-domain=()',
        'encrypted-media=(self)', 'fullscreen=(self)', 'gamepad=()',
        'gyroscope=(self)', 'magnetometer=()', 'midi=()',
        'picture-in-picture=(self)', 'publickey-credentials-get=()',
        'screen-wake-lock=()', 'serial=()', 'sync-xhr=(self)',
        'xr-spatial-tracking=()', 'accelerometer=(self)', 'autoplay=(self)',
      ].join(', '),
      'Content-Security-Policy': [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob: data:",
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
