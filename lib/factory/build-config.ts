import "server-only";

export type FactoryStorageConfiguration =
  | {backend:"render";origin:string;secret:string}
  | {backend:"r2";accountId:string;accessKeyId:string;secretAccessKey:string;bucket:string};
const serviceSecretPattern=/^[\x20-\x7e]{32,4096}$/;

function publicHttpsOrigin(value:string):string|null {
  try {
    // Reject paths before URL normalization can turn /somewhere/.. into an origin.
    if(!/^https:\/\/[^\s\\/?#]+\/?$/.test(value))return null;
    const url=new URL(value),hostname=url.hostname.toLowerCase();
    if(url.username||url.password||url.pathname!=="/"||url.search||url.hash||
      !hostname.includes(".")||hostname.endsWith(".")||hostname.endsWith(".localhost")||
      hostname.endsWith(".local")||hostname.endsWith(".internal")||
      hostname==="localhost.localdomain"||hostname.startsWith("[")||/^\d+(\.\d+){3}$/.test(hostname))return null;
    return url.origin;
  }catch{return null;}
}

/** Readiness describes required configuration, not a worker heartbeat. */
export function factoryStorageConfiguration():FactoryStorageConfiguration|null {
  // An explicitly selected Render backend must never silently use another store.
  if(process.env.FACTORY_STORAGE_URL!==undefined){
    const origin=publicHttpsOrigin(process.env.FACTORY_STORAGE_URL.trim());
    const secret=(process.env.FACTORY_STORAGE_SECRET||"").trim();
    if(!origin||!serviceSecretPattern.test(secret))return null;
    return {backend:"render",origin,secret};
  }
  const accountId=(process.env.FACTORY_R2_ACCOUNT_ID||"").trim();
  const accessKeyId=(process.env.FACTORY_R2_ACCESS_KEY_ID||"").trim();
  const secretAccessKey=(process.env.FACTORY_R2_SECRET_ACCESS_KEY||"").trim();
  const bucket=(process.env.FACTORY_R2_BUCKET||"").trim();
  if(!/^[a-f0-9]{32}$/i.test(accountId)||!accessKeyId||!secretAccessKey||! /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) return null;
  return {backend:"r2",accountId,accessKeyId,secretAccessKey,bucket};
}
export function factoryBuildConfiguration():{configured:boolean;reason:string|null} {
  if(!(process.env.FACTORY_OPENAI_API_KEY||process.env.OPENAI_API_KEY||"").trim())return {configured:false,reason:"The website builder needs the existing OpenAI connection."};
  if(!factoryStorageConfiguration())return {configured:false,reason:"Private website storage needs to be connected."};
  try {
    const origin=publicHttpsOrigin((process.env.FACTORY_PREVIEW_ORIGIN||"").trim());
    if(!origin||["tailoredagents.com","www.tailoredagents.com","mail.tailoredagents.com"].includes(new URL(origin).hostname))throw new Error();
  }catch{return {configured:false,reason:"Connect a separate preview domain before enabling website builds."};}
  if(!serviceSecretPattern.test((process.env.FACTORY_PREVIEW_SECRET||"").trim()))return {configured:false,reason:"Connect the preview service before enabling website builds."};
  return {configured:true,reason:null};
}
