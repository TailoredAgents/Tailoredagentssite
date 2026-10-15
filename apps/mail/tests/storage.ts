import type {R2Bucket} from '@cloudflare/workers-types';
export function testStorage(){
 const objects=new Map<string,Uint8Array>();
 const bytes=(value:any)=>typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);
 const bucket={
  async put(key:string,value:any){objects.set(key,bytes(value));return {};},
  async get(key:string){const b=objects.get(key);return b?{text:async()=>new TextDecoder().decode(b),json:async()=>JSON.parse(new TextDecoder().decode(b)),arrayBuffer:async()=>b.slice().buffer,size:b.length}:null;},
  async head(key:string){return objects.has(key)?{size:objects.get(key)!.length}:null;},
  async delete(key:string|string[]){for(const k of Array.isArray(key)?key:[key])objects.delete(k);},
  async list({prefix}:{prefix:string}){return {objects:[...objects.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false};},
  async createMultipartUpload(key:string){const parts=new Map<number,Uint8Array>();return {async uploadPart(n:number,b:Uint8Array){parts.set(n,b.slice());return {partNumber:n,etag:String(n)};},async complete(){const all=[...parts.values()];const b=new Uint8Array(all.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of all){b.set(p,offset);offset+=p.length;}objects.set(key,b);},async abort(){parts.clear();}};}
 };
 return {bucket:bucket as unknown as R2Bucket,objects};
}
