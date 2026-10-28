import {parse,type DefaultTreeAdapterTypes} from "parse5";
import type {FactoryPlanContent} from "../types";
import {safeSitePath,siteManifest,zipSiteFiles,type SiteFiles} from "./artifacts";

type IdentityBinding={attribute:"property"|"name";name:"og:url"|"og:image"|"twitter:image";kind:"page"|"asset";path:string};
type IdentityBindings={version:1;pages:Record<string,IdentityBinding[]>};

/** Remove only renderer-owned URL tags, using parser source locations rather
 * than replacing preview URLs in customer text. The sidecar retains local
 * bindings, never the old host, so each independent build is reversible. */
function portableIdentitySource(input:SiteFiles) {
  const files:SiteFiles={...input},bindings:IdentityBindings={version:1,pages:{}};
  for(const [page,bytes]of Object.entries(input)){
    if(!page.endsWith(".html"))continue;
    const html=Buffer.from(bytes).toString("utf8"),tree=parse(html,{sourceCodeLocationInfo:true});
    const document=tree.childNodes.find((node):node is DefaultTreeAdapterTypes.Element=>"tagName"in node&&node.tagName==="html");
    const head=document?.childNodes.find((node):node is DefaultTreeAdapterTypes.Element=>"tagName"in node&&node.tagName==="head");
    if(!head)throw new Error("A portable page needs a document head.");
    const starts=head.childNodes.filter(node=>node.nodeName==="#comment"&&"data"in node&&node.data===" ta:site-identity:start ");
    const ends=head.childNodes.filter(node=>node.nodeName==="#comment"&&"data"in node&&node.data===" ta:site-identity:end ");
    const marked=head.childNodes.filter((node):node is DefaultTreeAdapterTypes.Element=>"tagName"in node&&node.attrs.some(attr=>attr.name==="data-ta-site-url"));
    if(!starts.length&&!ends.length&&!marked.length)continue; // Historical exports have no identity metadata.
    const start=starts[0]?.sourceCodeLocation,end=ends[0]?.sourceCodeLocation;
    if(starts.length!==1||ends.length!==1||!start||!end||start.endOffset>=end.startOffset)throw new Error("Invalid portable identity boundaries.");
    const removals:Array<{start:number;end:number}>=[],pageBindings:IdentityBinding[]=[];
    for(const node of marked){
      const attrs=Object.fromEntries(node.attrs.map(attr=>[attr.name,attr.value])),location=node.sourceCodeLocation;
      const kind=attrs["data-ta-site-url"],name=attrs.property||attrs.name,attribute=attrs.property?"property":"name";
      if(node.tagName!=="meta"||!location||location.startOffset<start.endOffset||location.endOffset>end.startOffset
        ||!((kind==="page"&&name==="og:url"&&attribute==="property")||(kind==="asset"&&((name==="og:image"&&attribute==="property")||(name==="twitter:image"&&attribute==="name"))))
        ||pageBindings.some(binding=>binding.name===name))throw new Error("Invalid portable identity URL metadata.");
      const target=safeSitePath(attrs["data-ta-site-path"]||"");
      if(!input[target]||(kind==="page"?target!==page:target!=="assets/identity/social-card.jpg"))throw new Error("Portable identity metadata references a missing or unexpected local asset.");
      pageBindings.push({attribute,name:name as IdentityBinding["name"],kind:kind as IdentityBinding["kind"],path:target});
      removals.push({start:location.startOffset,end:location.endOffset});
    }
    if(pageBindings.length!==3)throw new Error("Portable identity metadata needs its three local URL bindings.");
    let stripped=html;
    for(const range of removals.sort((a,b)=>b.start-a.start))stripped=stripped.slice(0,range.start)+stripped.slice(range.end);
    files[page]=Buffer.from(stripped);bindings.pages[page]=pageBindings;
  }
  return {files,bindings};
}

export const portableBuildScript=String.raw`// Trusted portable build: no dependencies, network requests or generated commands.
import { readFile, readdir, mkdir, writeFile, lstat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'site'),destination=path.join(root,'dist');
const start='<!-- ta:site-identity:start -->',end='<!-- ta:site-identity:end -->';
function safePath(value){if(typeof value!=='string'||!value||value.length>180||!/^[a-z0-9][a-z0-9._/-]*$/.test(value)||value.includes('//')||value.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.'))||path.posix.normalize(value)!==value||path.posix.isAbsolute(value))throw new Error('Invalid portable site path.');return value;}
function publicBase(value){
  if(value===undefined||value==='')return null;
  if(!/^https?:\/\//.test(value)||value!==value.trim()||/[\\\s%?#<>"']/.test(value))throw new Error('SITE_PUBLIC_URL must be an absolute website URL without credentials, encoded paths, query or fragment.');
  let url;try{url=new URL(value);}catch{throw new Error('Invalid SITE_PUBLIC_URL.');}
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  const host=url.hostname.toLowerCase(),labels=host.split('.');
  if(url.username||url.password||(!local&&(url.protocol!=='https:'||url.port||isIP(host.replace(/^\[|\]$/g,''))||labels.length<2||labels.some(label=>!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))||/\.(?:localhost|local|internal|test|invalid)$/.test(host)||/^\d+$/.test(labels.at(-1))))||(local&&!['http:','https:'].includes(url.protocol)))throw new Error('SITE_PUBLIC_URL requires HTTPS and a public hostname; HTTP is allowed only on localhost for local checks.');
  const rawPath=value.slice(value.indexOf('://')+3).replace(/^[^/]+/,'');
  if(rawPath.includes('//')||rawPath.split('/').some(part=>part==='.'||part==='..')||!/^(?:\/[A-Za-z0-9._~-]+)*\/?$/.test(rawPath))throw new Error('SITE_PUBLIC_URL has an invalid base path.');
  return url.origin+url.pathname.replace(/\/$/,'')+'/';
}
async function ordinary(location,kind){const stat=await lstat(location);if(stat.isSymbolicLink()||(kind==='directory'?!stat.isDirectory():!stat.isFile()))throw new Error('Symlinks and unexpected filesystem entries are not allowed.');return stat;}
const base=publicBase(process.env.SITE_PUBLIC_URL);
await ordinary(source,'directory');await ordinary(path.join(root,'site-identity.json'),'file');
const identity=JSON.parse(await readFile(path.join(root,'site-identity.json'),'utf8'));
if(identity.version!==1||!identity.pages||Array.isArray(identity.pages)||typeof identity.pages!=='object')throw new Error('Invalid site identity bindings.');
const files=new Map();
async function collect(directory,prefix=''){for(const item of await readdir(directory,{withFileTypes:true})){const relative=safePath(prefix+item.name),input=path.join(directory,item.name);const stat=await lstat(input);if(stat.isSymbolicLink())throw new Error('Source symlinks are not allowed.');if(stat.isDirectory())await collect(input,relative+'/');else if(stat.isFile())files.set(relative,await readFile(input));else throw new Error('Unsupported source entry.');}}
await collect(source);
if(!files.has('index.html'))throw new Error('The source website needs index.html.');
for(const [page,bindings]of Object.entries(identity.pages)){
  safePath(page);if(!page.endsWith('.html')||!files.has(page)||!Array.isArray(bindings)||bindings.length!==3)throw new Error('Invalid identity page bindings.');
  let html=files.get(page).toString('utf8');
  const begin=html.indexOf(start),finish=html.indexOf(end),head=html.indexOf('<head>'),headEnd=html.indexOf('</head>');
  if(head<0||begin<head+6||finish<begin+start.length||finish+end.length>headEnd||html.indexOf(start,begin+start.length)!==-1||html.indexOf(end,finish+end.length)!==-1)throw new Error('Invalid generated identity block.');
  const names=new Set(),tags=[];
  for(const binding of bindings){
    const {attribute,name,kind,path:target}=binding;safePath(target);
    if(names.has(name)||!files.has(target)||!((name==='og:url'&&attribute==='property'&&kind==='page'&&target===page)||((name==='og:image'&&attribute==='property'||name==='twitter:image'&&attribute==='name')&&kind==='asset'&&target==='assets/identity/social-card.jpg')))throw new Error('Invalid local identity target.');
    names.add(name);
    if(base)tags.push('<meta '+attribute+'="'+name+'" content="'+new URL(target,base).href+'" data-ta-site-url="'+kind+'" data-ta-site-path="'+target+'">');
  }
  // Only the marked generated block is editable here. Customer copy is untouched.
  const block=html.slice(begin+start.length,finish);
  if(/<meta\s+(?:property="og:(?:url|image)"|name="twitter:image")\s/.test(block))throw new Error('Source URL metadata must use the portable site-identity.json bindings.');
  html=html.slice(0,finish)+tags.join('')+html.slice(finish);files.set(page,Buffer.from(html));
}
if(path.dirname(path.resolve(destination))!==path.resolve(root)||path.basename(destination)!=='dist')throw new Error('Invalid build output directory.');
try{await ordinary(destination,'directory');}catch(error){if(error.code!=='ENOENT')throw error;}
try{await ordinary(path.join(root,'dist-manifest.json'),'file');}catch(error){if(error.code!=='ENOENT')throw error;}
// All inputs and bindings have been checked before replacing the previous build.
await rm(destination,{recursive:true,force:true});
for(const [relative,bytes]of files){const output=path.join(destination,relative);await mkdir(path.dirname(output),{recursive:true});await writeFile(output,bytes);}
await writeFile(path.join(root,'dist-manifest.json'),JSON.stringify({entrypoint:'index.html',publicUrl:base,files:[...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>({path:name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))},null,2)+'\n');
console.log('Static website built into dist/. Preview forms remain demonstrations until connected.');
console.log(base?'Sharing metadata uses '+base:'Set SITE_PUBLIC_URL on your host to enable absolute sharing URLs; icons and local assets already work.');
`;

export function createPortableExport(input:{files:SiteFiles;plan:FactoryPlanContent;projectTitle:string;productionTasks:string[];assetProvenance:unknown;blueprint?:unknown}) {
  const previewManifest=siteManifest(input.files),portable=portableIdentitySource(input.files),manifest=siteManifest(portable.files),encoder=new TextEncoder();
  const files:SiteFiles={};for(const [name,bytes]of Object.entries(portable.files))files[`site/${name}`]=bytes;
  const pkg={name:"tailored-agents-website-export",version:"1.0.0",private:true,type:"module",scripts:{build:"node build.mjs"},engines:{node:">=22"}};
  files["package.json"]=encoder.encode(JSON.stringify(pkg,null,2)+"\n");
  files["package-lock.json"]=encoder.encode(JSON.stringify({name:pkg.name,version:pkg.version,lockfileVersion:3,requires:true,packages:{"":{name:pkg.name,version:pkg.version,engines:pkg.engines}}},null,2)+"\n");
  files["build.mjs"]=encoder.encode(portableBuildScript);
  files["site-identity.json"]=encoder.encode(JSON.stringify(portable.bindings,null,2)+"\n");
  files["render.yaml"]=encoder.encode("services:\n  - type: web\n    name: customer-website\n    runtime: static\n    buildCommand: node build.mjs\n    staticPublishPath: ./dist\n    headers:\n      - path: /*\n        name: X-Content-Type-Options\n        value: nosniff\n");
  files["brief.json"]=encoder.encode(JSON.stringify(input.plan,null,2)+"\n");
  files["asset-provenance.json"]=encoder.encode(JSON.stringify(input.assetProvenance,null,2)+"\n");
  files["manifest.json"]=encoder.encode(JSON.stringify(manifest,null,2)+"\n");
  files["preview-manifest.json"]=encoder.encode(JSON.stringify(previewManifest,null,2)+"\n");
  if(input.blueprint)files["blueprint.json"]=encoder.encode(JSON.stringify(input.blueprint,null,2)+"\n");
  files["readme.txt"]=encoder.encode(`${input.projectTitle}\n\nThis archive contains the actual portable website source and local assets.\n\nBuild\n  Install Node.js 22 or newer. No npm install is required.\n  Run: node build.mjs\n  Publish the resulting dist folder with Render Static Sites or another static host.\n  render.yaml provides an independent Render deployment definition.\n\nWebsite address and sharing\n  Set SITE_PUBLIC_URL in your host's build environment to the final website address, for example https://www.customer.com or https://www.customer.com/demo/.\n  Use HTTPS with a public hostname. Credentials, query strings, fragments and encoded paths are rejected. HTTP localhost is allowed only for local checks.\n  Every build creates page-specific sharing URLs and image URLs for this address. It never needs the Tailored Agents preview host.\n  Without SITE_PUBLIC_URL, the site still builds with local icons and images, but absolute sharing URL tags are omitted. Set or change the address and rebuild to enable them.\n  site-identity.json records only local page and image paths. Keep its matching identity markers in page heads.\n\nEdit\n  Edit HTML, assets/site.css and the local images under site/.\n  assets/runtime.js is the small supplied navigation and demonstration-form script.\n  Re-run node build.mjs after changes. No private Factory dependencies or expiring asset URLs are required.\n  manifest.json hashes the exported site source; preview-manifest.json preserves the checked preview's original hashes. Each build writes dist-manifest.json with the actual output hashes.\n\nProduction finishing\n${input.productionTasks.map(x=>`- ${x}`).join("\n")}\n- Forms, booking and payment interfaces are demonstrations until connected. They do not submit customer data or confirm real transactions.\n- Verify final business details, contact links, accessibility, image provenance and your domain before launch.\n- Preview pages contain a demo notice and noindex metadata. Remove those deliberately only when the customer website is ready to launch.\n- No secrets are included. Configure production integrations on the new host as needed.\n\nResearch sources and the approved brief are in brief.json. Asset provenance is in asset-provenance.json. Illustrative generated images do not document real staff or completed jobs.\n`);
  return {sourceZip:zipSiteFiles(files),sourceFiles:files,manifest};
}
