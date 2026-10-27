import {getOptionalDashboardContext} from "@/lib/dashboard/data";
import {getFactoryDraft} from "@/lib/factory/draft-service";
import {factoryPrivateHeaders} from "@/lib/factory/build-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const context=await getOptionalDashboardContext();
  if(!context)return new Response(null,{status:401,headers:factoryPrivateHeaders});
  try{return Response.json(await getFactoryDraft(context,(await params).id),{headers:factoryPrivateHeaders});}
  catch{return Response.json({error:"This editable draft is unavailable. Refresh the project and try again."},{status:404,headers:factoryPrivateHeaders});}
}
