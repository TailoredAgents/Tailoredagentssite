import {getOptionalDashboardContext} from "@/lib/dashboard/data";
import {getFactoryScreenshotDownload} from "@/lib/factory/build-data";
import {factoryStorage} from "@/lib/factory/storage";
import {factoryPrivateHeaders} from "@/lib/factory/build-http";
import {isFactoryEvidencePage} from "@/lib/factory/build-failure-evidence";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const context=await getOptionalDashboardContext();if(!context)return new Response(null,{status:401,headers:factoryPrivateHeaders});
  const query=new URL(request.url).searchParams,view=query.get("view"),page=query.get("page")??undefined;if(view!=="desktop"&&view!=="mobile"||page!==undefined&&!isFactoryEvidencePage(page))return new Response(null,{status:400,headers:factoryPrivateHeaders});
  try{
    const {id}=await params,reference=await getFactoryScreenshotDownload(context,id,view,page);
    const bytes=await factoryStorage().get(reference.storageKey,10_000_000);
    const current=await getFactoryScreenshotDownload(context,id,view,page);if(current.storageKey!==reference.storageKey)return new Response(null,{status:404,headers:factoryPrivateHeaders});
    return new Response(new Uint8Array(bytes),{headers:{...factoryPrivateHeaders,"content-type":"image/png"}});
  }catch{return new Response(null,{status:404,headers:factoryPrivateHeaders});}
}
