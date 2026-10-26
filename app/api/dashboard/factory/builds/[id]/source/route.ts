import {getOptionalDashboardContext} from "@/lib/dashboard/data";
import {getFactorySourceDownload} from "@/lib/factory/build-data";
import {factoryStorage} from "@/lib/factory/storage";
import {factoryPrivateHeaders} from "@/lib/factory/build-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const context=await getOptionalDashboardContext();if(!context)return new Response(null,{status:401,headers:factoryPrivateHeaders});
  try{
    const {id}=await params,reference=await getFactorySourceDownload(context,id);
    const bytes=await factoryStorage().get(reference.storageKey);
    await getFactorySourceDownload(context,id);
    return new Response(new Uint8Array(bytes),{headers:{...factoryPrivateHeaders,"content-type":"application/zip","content-disposition":`attachment; filename="${reference.filename}"`}});
  }catch{return Response.json({error:"This website download is unavailable."},{status:404,headers:factoryPrivateHeaders});}
}
