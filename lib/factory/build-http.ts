import "server-only";
import {timingSafeEqual,createHash} from "node:crypto";
import {ZodError} from "zod";
import {getOptionalDashboardContext} from "@/lib/dashboard/data";
import {FactoryAccessError,FactoryInputError} from "./types";
import {factoryStorage} from "./storage";
import {registerFactoryUpload,completeFactoryUpload,deleteFactoryUpload} from "./build-service";
import {authorizeFactory} from "./data";
import {getDatabasePool} from "@/lib/dashboard/db";
import {normalizeFactoryImage} from "./build-images";
export {normalizeFactoryImage} from "./build-images";

export const factoryPrivateHeaders={"cache-control":"private, no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex, nofollow, noarchive"};
export function previewSecretMatches(supplied:string|null){const expected=Buffer.from((process.env.FACTORY_PREVIEW_SECRET||"").trim()),got=Buffer.from(supplied||"");return expected.length>=32&&got.length===expected.length&&timingSafeEqual(expected,got);}
export async function boundedBody(request:Request,maximum:number){
  if(Number(request.headers.get("content-length")||0)>maximum)throw new FactoryInputError("This upload is too large.");
  if(!request.body)throw new FactoryInputError("No upload was supplied.");
  const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>maximum){await reader.cancel();throw new FactoryInputError("This upload is too large.");}parts.push(p.value);}}finally{reader.releaseLock();}
  return Buffer.concat(parts);
}
export async function uploadFactoryImage(request:Request,projectId:string){
  const context=await getOptionalDashboardContext();if(!context)return Response.json({error:"Sign in to add an image."},{status:401,headers:factoryPrivateHeaders});
  if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Reload this page before uploading."},{status:403,headers:factoryPrivateHeaders});
  let uploadId:string|undefined;
  try{
    await authorizeFactory(getDatabasePool(),context,"edit");
    const contentType=request.headers.get("content-type")||"";if(!contentType.startsWith("multipart/form-data;"))throw new FactoryInputError("Choose an image to upload.");
    const body=await boundedBody(request,5*1024*1024+65536);
    const form=await new Request(request.url,{method:"POST",headers:{"content-type":contentType},body}).formData();
    const file=form.get("file");if(!(file instanceof File)||file.size>5*1024*1024||file.size===0)throw new FactoryInputError("Choose a PNG, JPEG, or WebP image up to 5 MB.");
    const bytes=await normalizeFactoryImage(new Uint8Array(await file.arrayBuffer()));
    const filename=(Array.from(file.name).map(c=>c==="/"||c==="\\"||c.charCodeAt(0)<32?"_":c).join("").slice(0,170)||"reference-image")+".png";
    const storage=factoryStorage();
    const upload=await registerFactoryUpload(context,{projectId,filename,contentType:"image/png",byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});uploadId=upload.id;
    await storage.put(upload.storageKey,bytes,"image/png");
    await completeFactoryUpload(context,upload.id);
    return Response.json({ok:true},{headers:factoryPrivateHeaders});
  }catch(error){
    if(uploadId)await deleteFactoryUpload(context,{uploadId}).catch(()=>{});
    return Response.json({error:error instanceof FactoryInputError?error.message:error instanceof ZodError?"Choose a valid planning workspace and image.":"The image could not be saved. Check the storage connection and try again."},{status:error instanceof FactoryAccessError?403:error instanceof FactoryInputError||error instanceof ZodError?400:503,headers:factoryPrivateHeaders});
  }
}
