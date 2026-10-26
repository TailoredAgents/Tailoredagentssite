import {getFactoryPreviewResolution} from "@/lib/factory/build-data";
import {boundedBody,factoryPrivateHeaders,previewSecretMatches} from "@/lib/factory/build-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  if(!previewSecretMatches(request.headers.get("authorization")?.replace(/^Bearer /," ").trim()||null))return Response.json({error:"Unauthorized"},{status:401,headers:factoryPrivateHeaders});
  try{
    const body=JSON.parse((await boundedBody(request,1024)).toString("utf8"));
    const result=await getFactoryPreviewResolution(typeof body.token==="string"?body.token:"",{verification:body.verification===true});
    return Response.json(result||{error:"Not found"},{status:result?200:404,headers:factoryPrivateHeaders});
  }catch{return Response.json({error:"Unavailable"},{status:503,headers:factoryPrivateHeaders});}
}
