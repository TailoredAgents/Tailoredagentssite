import {getOptionalDashboardContext} from "@/lib/dashboard/data";
import {getFactoryScreenshotDownload} from "@/lib/factory/build-data";
import {factoryStorage} from "@/lib/factory/storage";
import {factoryPrivateHeaders} from "@/lib/factory/build-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const context=await getOptionalDashboardContext();if(!context)return new Response(null,{status:401,headers:factoryPrivateHeaders});
  const view=new URL(request.url).searchParams.get("view");if(view!=="desktop"&&view!=="mobile")return new Response(null,{status:400,headers:factoryPrivateHeaders});
  try{
    const {id}=await params,reference=await getFactoryScreenshotDownload(context,id,view);
    const bytes=await factoryStorage().get(reference.storageKey,10_000_000);
    await getFactoryScreenshotDownload(context,id,view);
    return new Response(new Uint8Array(bytes),{headers:{...factoryPrivateHeaders,"content-type":"image/png"}});
  }catch{return new Response(null,{status:404,headers:factoryPrivateHeaders});}
}
