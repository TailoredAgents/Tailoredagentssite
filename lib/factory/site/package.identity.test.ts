import {afterAll,describe,expect,it} from "vitest";
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {mkdtemp,mkdir,readFile,rename,rm,symlink,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import {parse,type DefaultTreeAdapterTypes} from "parse5";
import sharp from "sharp";
import {createPortableExport} from "./package";
import {fixtureBlueprint,fixtureHeroSvg,fixtureSitePlan} from "./fixtures";
import {siteManifest,type SiteFiles} from "./artifacts";
import {prepareSiteIdentity} from "./identity";
import {renderPortableSite} from "./render";
import {portableBundle} from "./validate";

const command=promisify(execFile),temporary:string[]=[];
const preview="https://previews.example.com/p/example-v1/",card="assets/identity/social-card.jpg";
const text=(value:Uint8Array)=>Buffer.from(value).toString("utf8");
const sha=(value:Uint8Array)=>createHash("sha256").update(value).digest("hex");
function inputFiles():SiteFiles {
  const page=(page:string)=>Buffer.from(`<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>Example &amp; Company</title><!-- ta:site-identity:start --><link rel="icon" href="${page==="index.html"?"":"../"}assets/identity/favicon-32.png"><meta property="og:title" content="Example &amp; Company"><meta property="og:url" content="${preview}${page}" data-ta-site-url="page" data-ta-site-path="${page}"><meta property="og:image" content="${preview}${card}" data-ta-site-url="asset" data-ta-site-path="${card}"><meta name="twitter:image" content="${preview}${card}" data-ta-site-url="asset" data-ta-site-path="${card}"><!-- ta:site-identity:end --></head><body><p>Website concept · Forms are demonstrations</p><p>The literal word og:url and an escaped &lt;meta data-ta-site-url=&quot;page&quot;&gt; are customer copy.</p></body></html>`);
  return {"index.html":page("index.html"),"services/index.html":page("services/index.html"),[card]:Buffer.from("local test social card"),"assets/identity/favicon-32.png":Buffer.from("local test icon"),"robots.txt":Buffer.from("User-agent: *\nDisallow: /\n")};
}
const exportFiles=(files=inputFiles())=>createPortableExport({files,plan:fixtureSitePlan,projectTitle:"Example & Company",productionTasks:["Connect the demonstration form"],assetProvenance:{kind:"generated-illustration",source:"local"}});
async function directory(){const root=await mkdtemp(path.join(tmpdir(),"ta-portable-identity-"));temporary.push(root);return root;}
async function unpack(){
  const root=await directory(),archive=exportFiles();
  for(const [relative,bytes]of Object.entries(archive.sourceFiles)){const target=path.join(root,relative);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
  return {root,archive};
}
function build(root:string,url?:string){const env={...process.env};delete env.SITE_PUBLIC_URL;if(url!==undefined)env.SITE_PUBLIC_URL=url;return command(process.execPath,["build.mjs"],{cwd:root,env});}
function tags(html:string){
  const found:Record<string,string>={};
  const visit=(node:DefaultTreeAdapterTypes.Node)=>{if("tagName"in node&&node.tagName==="meta"){const attrs=Object.fromEntries(node.attrs.map(attr=>[attr.name,attr.value]));if(attrs.property||attrs.name)found[attrs.property||attrs.name]=attrs.content;}if("childNodes"in node)for(const child of node.childNodes)visit(child);};
  visit(parse(html));return found;
}
afterAll(async()=>{for(const directory of temporary){if(path.dirname(directory)!==tmpdir()||!path.basename(directory).startsWith("ta-portable-identity-"))throw new Error("Unexpected test cleanup path.");await rm(directory,{recursive:true,force:true});}});

describe("Portable identity metadata and independent deployment",()=>{
  it("strips preview URL metadata from exported source while preserving local assets, safety policy and both hash manifests",()=>{
    const input=inputFiles(),archive=exportFiles(input),html=text(archive.sourceFiles["site/index.html"]);
    expect(html).not.toContain(preview);expect(html).not.toContain('data-ta-site-url="');
    expect(html).toContain('rel="icon" href="assets/identity/favicon-32.png"');expect(html).toContain('content="noindex,nofollow"');expect(html).toContain("Content-Security-Policy");expect(html).toContain("Forms are demonstrations");expect(html).toContain("escaped &lt;meta");
    expect(tags(html)).not.toHaveProperty("og:url");expect(tags(html)["og:title"]).toBe("Example & Company");
    expect(text(archive.sourceFiles["site-identity.json"])).not.toContain(preview);
    expect(JSON.parse(text(archive.sourceFiles["preview-manifest.json"]))).toEqual(siteManifest(input));
    const exported=JSON.parse(text(archive.sourceFiles["manifest.json"]));
    expect(exported.files.find((file:{path:string})=>file.path==="index.html").sha256).toBe(sha(archive.sourceFiles["site/index.html"]));
    expect(archive.manifest).toEqual(exported);expect(archive.sourceFiles[`site/${card}`]).toEqual(input[card]);
    expect(text(archive.sourceFiles["asset-provenance.json"])).toContain("generated-illustration");
  });
  it("extracts the actual archive and builds page-specific sharing URLs at a customer root and subdirectory without Factory dependencies",async()=>{
    const root=await directory(),archive=exportFiles(),zip=path.join(root,"source.zip"),extracted=path.join(root,"export");await writeFile(zip,archive.sourceZip);
    await command("python",["-c","import pathlib,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; root=pathlib.Path(sys.argv[2]).resolve(); assert all((root / x.filename).resolve().is_relative_to(root) for x in z.infolist()); z.extractall(root)",zip,extracted]);
    for(const address of ["https://www.example.com","https://www.example.com/customer-demo/"]){
      const output=await build(extracted,address);expect(output.stdout).toContain("Static website built into dist/");
      const base=address.replace(/\/$/,"")+"/";
      for(const page of ["index.html","services/index.html"]){
        const html=await readFile(path.join(extracted,"dist",page),"utf8"),meta=tags(html);
        expect(meta["og:url"]).toBe(base+page);expect(meta["og:image"]).toBe(base+card);expect(meta["twitter:image"]).toBe(base+card);
        expect(html).not.toContain(preview);expect(html).toContain('content="noindex,nofollow"');expect(html).toContain("Forms are demonstrations");
      }
      const manifest=JSON.parse(await readFile(path.join(extracted,"dist-manifest.json"),"utf8"));
      expect(manifest.publicUrl).toBe(base);
      for(const file of manifest.files)expect(file.sha256).toBe(sha(await readFile(path.join(extracted,"dist",file.path))));
    }
    expect(JSON.parse(await readFile(path.join(extracted,"package.json"),"utf8")).dependencies).toBeUndefined();
    expect(await readFile(path.join(extracted,"dist",card))).toEqual(inputFiles()[card]);
  },30000);
  it("exports the actual generated identity and renders every page independently with the customer's public address",async()=>{
    const blueprint=fixtureBlueprint("professional","minimal",true),images={"assets/images/hero.png":await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer()};
    const identity=await prepareSiteIdentity(blueprint,images),site=renderPortableSite(portableBundle(blueprint),{...images,...identity},{publicBaseUrl:preview});
    const archive=createPortableExport({files:site.files,plan:fixtureSitePlan,projectTitle:blueprint.brandName,productionTasks:blueprint.productionTasks,assetProvenance:{kind:"synthetic-test"}}),root=await directory();
    for(const [relative,bytes]of Object.entries(archive.sourceFiles)){const target=path.join(root,relative);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
    await build(root,"https://www.customer.example/demo/");
    for(const page of blueprint.pages){
      const html=await readFile(path.join(root,"dist",page.path),"utf8"),meta=tags(html);
      expect(meta["og:url"]).toBe("https://www.customer.example/demo/"+page.path);expect(meta["og:image"]).toBe("https://www.customer.example/demo/"+card);
      expect(meta["og:title"]).toBe(`${page.title} | ${blueprint.brandName}`);expect(meta["og:description"]).toBe(page.description);expect(html).not.toContain(preview);
    }
    for(const [asset,bytes]of Object.entries(identity))expect(await readFile(path.join(root,"dist",asset))).toEqual(Buffer.from(bytes));
  },30000);
  it("is reversible with no setting, a changed address, and local HTTP without mutating the source",async()=>{
    const {root,archive}=await unpack();
    for(const address of [undefined,"https://first.example.com/demo","https://second.example.com",undefined,"http://localhost:4271/site",undefined]){
      await build(root,address);
      const html=await readFile(path.join(root,"dist/index.html"),"utf8"),meta=tags(html);
      if(address)expect(meta["og:url"]).toBe(address+"/index.html");else{expect(meta).not.toHaveProperty("og:url");expect(meta).not.toHaveProperty("og:image");expect(meta).not.toHaveProperty("twitter:image");}
      expect(await readFile(path.join(root,"site/index.html"))).toEqual(Buffer.from(archive.sourceFiles["site/index.html"]));
      expect(html).toContain('rel="icon"');expect(html).not.toContain(preview);
    }
  },30000);
  it("does not treat ordinary identity copy as an editable URL tag",async()=>{
    const {root}=await unpack(),source=path.join(root,"site/index.html");
    const html=(await readFile(source,"utf8")).replace('content="Example &amp; Company"','content="The words data-ta-site-url describe our service"');
    await writeFile(source,html);await build(root,"https://www.example.com");
    expect(tags(await readFile(path.join(root,"dist/index.html"),"utf8"))["og:title"]).toBe("The words data-ta-site-url describe our service");
  });
  it("rejects invalid origins, escaping or encoded base paths before replacing the previous output",async()=>{
    const {root}=await unpack();await build(root,"https://good.example.com");const previous=await readFile(path.join(root,"dist/index.html"));
    for(const url of ["http://example.com","https:example.com","javascript:alert(1)","//example.com","https://user:pass@example.com","https://example.com?secret=1","https://example.com/#thing","https://example.com/%2e%2e/private","https://example.com/../private","https://example.com/demo//site","https://example.com/a\\b","https://127.0.0.2","https://10.0.0.1","https://[::2]","https://internal","https://example.local","https://example.com:8443","https://example.com/demo\"bad"," https://example.com"]){
      await expect(build(root,url)).rejects.toThrow();expect(await readFile(path.join(root,"dist/index.html"))).toEqual(previous);
    }
  },30000);
  it("rejects tampered bindings and paths instead of writing injected metadata or escaping the site",async()=>{
    const {root,archive}=await unpack();await build(root,"https://good.example.com");const previous=await readFile(path.join(root,"dist/index.html"));
    for(const target of ["../secret.html","/absolute.html","assets/%2e%2e/secret.jpg","assets/identity/missing.jpg",'assets/identity/social-card.jpg" onload="bad']){
      const bindings=JSON.parse(text(archive.sourceFiles["site-identity.json"]));bindings.pages["index.html"][1].path=target;
      await writeFile(path.join(root,"site-identity.json"),JSON.stringify(bindings));await expect(build(root,"https://example.com")).rejects.toThrow();
      expect(await readFile(path.join(root,"dist/index.html"))).toEqual(previous);
    }
    const bindings=JSON.parse(text(archive.sourceFiles["site-identity.json"]));bindings.pages["index.html"][0].name='og:url" onload="bad';await writeFile(path.join(root,"site-identity.json"),JSON.stringify(bindings));await expect(build(root,"https://example.com")).rejects.toThrow();
  },30000);
  it("refuses source directory links, nested asset links and output links without changing their external targets",async()=>{
    for(const kind of ["source","asset","output"]){
      const {root}=await unpack(),outside=await directory();await writeFile(path.join(outside,"keep.txt"),"untouched");
      const target=kind==="source"?path.join(root,"site"):kind==="asset"?path.join(root,"site/assets/identity"):path.join(root,"dist");
      if(kind!=="output")await rename(target,target+"-original");
      await symlink(outside,target,process.platform==="win32"?"junction":"dir");
      await expect(build(root,"https://example.com")).rejects.toThrow(/symlinks/i);expect(await readFile(path.join(outside,"keep.txt"),"utf8")).toBe("untouched");
    }
  },30000);
  it("fails malformed renderer markers and URL targets, and preserves historical exports without identity blocks",async()=>{
    for(const update of [(html:string)=>html.replace("<!-- ta:site-identity:end -->",""),(html:string)=>html.replace('data-ta-site-path="index.html"','data-ta-site-path="services/index.html"'),(html:string)=>html.replace('data-ta-site-url="page"','data-ta-site-url="unknown"')]){
      const files=inputFiles();files["index.html"]=Buffer.from(update(text(files["index.html"])));expect(()=>exportFiles(files)).toThrow();
    }
    const files:SiteFiles={"index.html":Buffer.from("<!doctype html><html><head><title>Historical preview</title></head><body>Original content</body></html>")};
    const archive=exportFiles(files);expect(archive.sourceFiles["site/index.html"]).toEqual(files["index.html"]);expect(JSON.parse(text(archive.sourceFiles["site-identity.json"])).pages).toEqual({});
  });
});
