import type { FactoryPlanContent } from "../types";
import { siteManifest,zipSiteFiles,type SiteFiles } from "./artifacts";

export const portableBuildScript=`// Trusted portable build: no dependencies, network requests or generated commands.
import { readFile, readdir, mkdir, copyFile, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'site'),destination=path.join(root,'dist');
async function copy(from,to){await mkdir(to,{recursive:true});for(const item of await readdir(from,{withFileTypes:true})){const input=path.join(from,item.name),output=path.join(to,item.name);const stat=await lstat(input);if(stat.isSymbolicLink())throw new Error('Source symlinks are not allowed.');if(item.isDirectory())await copy(input,output);else if(item.isFile())await copyFile(input,output);else throw new Error('Unsupported source entry.');}}
await readFile(path.join(source,'index.html'));
if(path.dirname(path.resolve(destination))!==path.resolve(root)||path.basename(destination)!=='dist')throw new Error('Invalid build output directory.');
await rm(destination,{recursive:true,force:true});
await copy(source,destination);
console.log('Static website built into dist/. Preview forms remain demonstrations until connected.');
`;

export function createPortableExport(input:{files:SiteFiles;plan:FactoryPlanContent;projectTitle:string;productionTasks:string[];assetProvenance:unknown;blueprint?:unknown}) {
  const manifest=siteManifest(input.files),encoder=new TextEncoder();
  const files:SiteFiles={};for(const [name,bytes]of Object.entries(input.files))files[`site/${name}`]=bytes;
  const pkg={name:"tailored-agents-website-export",version:"1.0.0",private:true,type:"module",scripts:{build:"node build.mjs"},engines:{node:">=22"}};
  files["package.json"]=encoder.encode(JSON.stringify(pkg,null,2)+"\n");
  files["package-lock.json"]=encoder.encode(JSON.stringify({name:pkg.name,version:pkg.version,lockfileVersion:3,requires:true,packages:{"":{name:pkg.name,version:pkg.version,engines:pkg.engines}}},null,2)+"\n");
  files["build.mjs"]=encoder.encode(portableBuildScript);
  files["render.yaml"]=encoder.encode("services:\n  - type: web\n    name: customer-website\n    runtime: static\n    buildCommand: node build.mjs\n    staticPublishPath: ./dist\n    headers:\n      - path: /*\n        name: X-Content-Type-Options\n        value: nosniff\n");
  files["brief.json"]=encoder.encode(JSON.stringify(input.plan,null,2)+"\n");
  files["asset-provenance.json"]=encoder.encode(JSON.stringify(input.assetProvenance,null,2)+"\n");
  files["manifest.json"]=encoder.encode(JSON.stringify(manifest,null,2)+"\n");
  if(input.blueprint)files["blueprint.json"]=encoder.encode(JSON.stringify(input.blueprint,null,2)+"\n");
  files["readme.txt"]=encoder.encode(`${input.projectTitle}\n\nThis archive contains the actual portable website source and local assets.\n\nBuild\n  Install Node.js 22 or newer. No npm install is required.\n  Run: node build.mjs\n  Publish the resulting dist folder with Render Static Sites or another static host.\n  render.yaml provides an independent Render deployment definition.\n\nEdit\n  Edit HTML, assets/site.css and the local images under site/.\n  assets/runtime.js is the small supplied navigation and demonstration-form script.\n  Re-run node build.mjs after changes. No private Factory dependencies or expiring asset URLs are required.\n\nProduction finishing\n${input.productionTasks.map(x=>`- ${x}`).join("\n")}\n- Forms, booking and payment interfaces are demonstrations until connected. They do not submit customer data or confirm real transactions.\n- Verify final business details, contact links, accessibility, image provenance and your domain before launch.\n- Preview pages contain a demo notice and noindex metadata. Remove those deliberately only when the customer website is ready to launch.\n- No secrets are included. Configure production integrations on the new host as needed.\n\nResearch sources and the approved brief are in brief.json. Asset provenance is in asset-provenance.json. Illustrative generated images do not document real staff or completed jobs.\n`);
  return {sourceZip:zipSiteFiles(files),sourceFiles:files,manifest};
}
