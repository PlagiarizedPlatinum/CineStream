/**
 * /api/proxy — ReelWave Sports Proxy v5
 * Used as FALLBACK only when browser can't reach streamed.pk directly.
 * Primary path is now browser → streamed.pk direct (open CORS).
 */
export const config = { runtime: 'edge' };

const MIRRORS = ['https://streamed.pk','https://streamed.su','https://streamed.me'];
const ALLOWED  = ['streamed.pk','streamed.su','streamed.me','embedme.top'];
const HDR = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer':'https://streamed.pk/',
  'Origin':'https://streamed.pk',
  'Accept':'application/json,*/*',
};

function allowed(h){ return ALLOWED.some(a=>h===a||h.endsWith('.'+a)); }
function rewrite(url,base){ try{const u=new URL(url);return base+u.pathname+u.search;}catch(_){return url;} }

export default async function handler(req){
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS'}});
  if(req.method!=='GET') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'Content-Type':'application/json'}});

  const url = new URL(req.url).searchParams.get('url');
  if(!url) return new Response(JSON.stringify({error:'Missing url'}),{status:400,headers:{'Content-Type':'application/json'}});

  let parsed;
  try{ parsed=new URL(url); }catch(_){ return new Response(JSON.stringify({error:'Invalid URL'}),{status:400,headers:{'Content-Type':'application/json'}}); }
  if(!allowed(parsed.hostname)) return new Response(JSON.stringify({error:'Domain not allowed'}),{status:403,headers:{'Content-Type':'application/json'}});

  const urlsToTry = MIRRORS.map(m=>rewrite(url,m));

  for(const tryUrl of urlsToTry){
    try{
      const res = await fetch(tryUrl,{headers:HDR,redirect:'follow'});
      if(!res.ok) continue;
      const body = await res.text();
      const ct = res.headers.get('Content-Type')||'application/json';
      return new Response(body,{status:200,headers:{
        'Content-Type':ct,
        'Cache-Control':'public,s-maxage=30,stale-while-revalidate=60',
        'Access-Control-Allow-Origin':'*',
        'X-RW-Mirror':tryUrl,
      }});
    }catch(_){}
  }

  return new Response(JSON.stringify({error:'All mirrors unreachable from server'}),{
    status:502,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}
  });
}
