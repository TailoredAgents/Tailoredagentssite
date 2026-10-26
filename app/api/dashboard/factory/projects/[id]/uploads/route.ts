import {uploadFactoryImage} from "@/lib/factory/build-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return uploadFactoryImage(request,(await params).id);}
