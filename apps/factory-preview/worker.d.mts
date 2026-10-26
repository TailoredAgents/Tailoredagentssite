export type FactoryPreviewEnv={FACTORY_RESOLVER_URL:string;FACTORY_PREVIEW_SECRET:string;SITES:{get(key:string):Promise<{size:number;arrayBuffer():Promise<ArrayBuffer>}|null>}};
export function serveFactoryPreview(request:Request,env:FactoryPreviewEnv,fetcher?:typeof fetch):Promise<Response>;
declare const worker:{fetch(request:Request,env:FactoryPreviewEnv,context?:unknown):Promise<Response>};
export default worker;
