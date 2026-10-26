const headers={"cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex, nofollow, noarchive","referrer-policy":"no-referrer","permissions-policy":"camera=(), microphone=(), geolocation=()","content-security-policy":"default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox allow-scripts allow-same-origin"};
const error=status=>new Response(status===404?"Preview unavailable":"Preview temporarily unavailable",{status,headers:{...headers,"content-type":"text/plain; charset=utf-8"}});
const pathPattern=/^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:html|css|js|txt|png|jpg|jpeg|webp|svg|ico|woff2?)$/;
const types=new Set(["text/html","text/css","text/plain","text/javascript","application/javascript","image/png","image/jpeg","image/webp","image/svg+xml","image/x-icon","image/vnd.microsoft.icon","font/woff","font/woff2"]);
async function equalSecret(left,right){
  if(typeof left!=="string"||typeof right!=="string"||right.length<32)return false;
  const encoder=new TextEncoder();
  const a=new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(left))),b=new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(right)));
  let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
/** Separate origin, manifest-only files, and a fresh authorization lookup per request. */
export async function serveFactoryPreview(request,env,fetcher=fetch){
  if(!["GET","HEAD"].includes(request.method))return error(404);
  const url=new URL(request.url);let pathname;
  try{pathname=decodeURIComponent(url.pathname);}catch{return error(404);}
  const match=pathname.match(/^\/p\/([a-f0-9]{48})(\/.*)?$/);if(!match)return error(404);
  let file=(match[2]||"/").slice(1);if(!file||file.endsWith("/"))file+="index.html";
  if(!pathPattern.test(file))return error(404);
  // Keep relative navigation inside the capability URL, including a missing slash.
  if(!match[2])return new Response(null,{status:308,headers:{...headers,location:`/p/${match[1]}/`}});
  try{
    const endpoint=new URL(env.FACTORY_RESOLVER_URL);
    if(endpoint.origin!=="https://www.tailoredagents.com"||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=="/api/integrations/factory/preview"||!env.FACTORY_PREVIEW_SECRET||env.FACTORY_PREVIEW_SECRET.length<32)return error(503);
    const verification=await equalSecret(request.headers.get("x-factory-verify"),env.FACTORY_PREVIEW_SECRET);
    const resolution=await fetcher(endpoint.href,{method:"POST",headers:{authorization:`Bearer ${env.FACTORY_PREVIEW_SECRET}`,"content-type":"application/json"},body:JSON.stringify({token:match[1],verification}),redirect:"error",signal:AbortSignal.timeout(10000)});
    if(!resolution.ok){await resolution.body?.cancel();return error(resolution.status===404?404:503);}
    const text=await resolution.text();if(text.length>150000)return error(503);
    const resolved=JSON.parse(text);
    const expiry=Date.parse(resolved.expiresAt);
    if(!/^factory\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/preview\/$/.test(resolved.storagePrefix)||typeof resolved.ready!=="boolean"||(!resolved.ready&&!verification)||!Number.isFinite(expiry)||expiry<=Date.now())return error(404);
    const entry=resolved.manifest?.files?.find(item=>item.path===file);
    if(!entry||!types.has(entry.contentType.split(";")[0])||!Number.isSafeInteger(entry.size)||entry.size<0||entry.size>10485760||!/^[a-f0-9]{64}$/.test(entry.sha256))return error(404);
    const object=await env.SITES.get(resolved.storagePrefix+file);
    if(!object||object.size!==entry.size)return error(503);
    // Immutable version URLs must serve the exact checked bytes, including when
    // an object is accidentally overwritten with another file of the same size.
    const bytes=await object.arrayBuffer();if(bytes.byteLength!==entry.size)return error(503);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("");
    if(hash!==entry.sha256)return error(503);
    return new Response(request.method==="HEAD"?null:bytes,{headers:{...headers,"content-type":entry.contentType,"content-length":String(entry.size)}});
  }catch{return error(503);}
}
export default {fetch(request,env){return serveFactoryPreview(request,env);}};
