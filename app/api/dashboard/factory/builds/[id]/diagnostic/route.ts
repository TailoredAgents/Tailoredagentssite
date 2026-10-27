import {getOptionalDashboardContext} from "@/lib/dashboard/data";
import {downloadFactoryDraftDiagnostic} from "@/lib/factory/draft-diagnostic";
import {factoryStorage} from "@/lib/factory/storage";
import {factoryPrivateHeaders} from "@/lib/factory/build-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const context=await getOptionalDashboardContext();
  if(!context)return new Response(null,{status:401,headers:factoryPrivateHeaders});
  try{
    const result=await downloadFactoryDraftDiagnostic(context,(await params).id,factoryStorage());
    return new Response(new Uint8Array(result.bytes),{headers:{...factoryPrivateHeaders,"content-type":"application/zip","content-disposition":`attachment; filename="${result.filename}"`}});
  }catch{return Response.json({error:"This private diagnostic is unavailable."},{status:404,headers:factoryPrivateHeaders});}
}
