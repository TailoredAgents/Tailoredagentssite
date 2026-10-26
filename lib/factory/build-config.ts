import "server-only";

/** Readiness describes required configuration, not a worker heartbeat. */
export function factoryStorageConfiguration() {
  const accountId=(process.env.FACTORY_R2_ACCOUNT_ID||"").trim();
  const accessKeyId=(process.env.FACTORY_R2_ACCESS_KEY_ID||"").trim();
  const secretAccessKey=(process.env.FACTORY_R2_SECRET_ACCESS_KEY||"").trim();
  const bucket=(process.env.FACTORY_R2_BUCKET||"").trim();
  if(!/^[a-f0-9]{32}$/i.test(accountId)||!accessKeyId||!secretAccessKey||! /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) return null;
  return {accountId,accessKeyId,secretAccessKey,bucket};
}
export function factoryBuildConfiguration():{configured:boolean;reason:string|null} {
  if(!(process.env.FACTORY_OPENAI_API_KEY||process.env.OPENAI_API_KEY||"").trim())return {configured:false,reason:"The website builder needs the existing OpenAI connection."};
  if(!factoryStorageConfiguration())return {configured:false,reason:"Private website storage needs to be connected."};
  try {
    const url=new URL(process.env.FACTORY_PREVIEW_ORIGIN||"");
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/"||["tailoredagents.com","www.tailoredagents.com","mail.tailoredagents.com"].includes(url.hostname))throw new Error();
  }catch{return {configured:false,reason:"Connect a separate preview domain before enabling website builds."};}
  if((process.env.FACTORY_PREVIEW_SECRET||"").trim().length<32)return {configured:false,reason:"Connect the preview service before enabling website builds."};
  return {configured:true,reason:null};
}
