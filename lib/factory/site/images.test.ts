import {beforeAll,describe,expect,it} from "vitest";
import sharp from "sharp";
import {mkdtemp,readFile,writeFile} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {tmpdir} from "node:os";
import path from "node:path";
import {preparePortableImages,portableHeroImages,portableImagePaths,portableImageLimits} from "./images";
import {fixtureBlueprint,fixtureHeroSvg,fixtureSitePlan} from "./fixtures";
import {portableBundle} from "./validate";
import {renderPortableSite} from "./render";
import {assertPortableSiteSafety} from "./safety";
import {createPortableExport} from "./package";
import type {SiteFiles} from "./artifacts";

let original:Buffer,assets:SiteFiles;
beforeAll(async()=>{original=await sharp(Buffer.from(fixtureHeroSvg)).png().withMetadata().toBuffer();assets=await preparePortableImages(original);});
const text=(bytes:Uint8Array)=>Buffer.from(bytes).toString("utf8");
// Exercise the safety/export boundary independently of the renderer's design.
function responsiveSite(){
  const {files}=renderPortableSite(portableBundle(fixtureBlueprint()),{[portableImagePaths.legacy]:original});
  const html=text(files["index.html"]).replace(/<img\b[^>]*src="assets\/images\/hero\.png"[^>]*>/g,img=>`<picture><source type="image/webp" media="(max-width: 760px)" srcset="${portableImagePaths.mobile}">${img.replace(portableImagePaths.legacy,portableImagePaths.desktop)}</picture>`);
  delete files[portableImagePaths.legacy];
  return {...files,...assets,"index.html":Buffer.from(html)};
}
describe("Portable image delivery",()=>{
  it("makes deterministic decodable mobile/desktop WebP derivatives without publishing metadata or originals",async()=>{
    expect(await preparePortableImages(original)).toEqual(assets);
    expect(Object.keys(assets)).toEqual([portableImagePaths.mobile,portableImagePaths.desktop]);
    const set=portableHeroImages({...assets,[portableImagePaths.legacy]:original});
    expect(set.files[portableImagePaths.legacy]).toBeUndefined();
    expect(set.variants.map(v=>v.width)).toEqual([720,1536]);
    for(const variant of set.variants){
      const image=sharp(assets[variant.path]),meta=await image.metadata();
      expect(meta.format).toBe("webp");expect(meta.width).toBe(variant.width);expect(meta.height).toBe(variant.height);
      expect(meta.exif).toBeUndefined();expect(meta.icc).toBeUndefined();expect((await image.raw().toBuffer()).length).toBeGreaterThan(0);
    }
    expect(assets[portableImagePaths.mobile].byteLength).toBeLessThanOrEqual(portableImageLimits.mobileBytes);
    expect(assets[portableImagePaths.desktop].byteLength).toBeLessThanOrEqual(portableImageLimits.desktopBytes);
  });
  it("keeps difficult photographic detail within byte budgets using bounded quality/dimension attempts",async()=>{
    const width=1800,height=1200,pixels=Buffer.alloc(width*height*3);let seed=94321;
    for(let i=0;i<pixels.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels[i]=seed>>>24;}
    const noisy=await sharp(pixels,{raw:{width,height,channels:3}}).png().toBuffer(),result=await preparePortableImages(noisy);
    const set=portableHeroImages(result);
    expect(set.variants[0].bytes).toBeLessThanOrEqual(250_000);expect(set.variants[1].bytes).toBeLessThanOrEqual(400_000);
    expect(set.fallback.width).toBeLessThanOrEqual(1600);expect(set.fallback.width).toBeGreaterThanOrEqual(960);
    for(const image of Object.values(result))expect(image.byteLength).toBeLessThan(noisy.byteLength);
  },30000);
  it("preserves alpha, portrait composition and small sources without enlargement",async()=>{
    const png=await sharp({create:{width:300,height:600,channels:4,background:{r:35,g:60,b:90,alpha:.3}}}).png().toBuffer();
    const result=await preparePortableImages(png);
    for(const variant of portableHeroImages(result).variants){
      expect([variant.width,variant.height]).toEqual([300,600]);
      expect((await sharp(result[variant.path]).metadata()).hasAlpha).toBe(true);
    }
  });
  it("fails closed for invalid sources, incomplete variants, corrupt headers and oversize image buffers",async()=>{
    await expect(preparePortableImages(Buffer.from("not a png"))).rejects.toThrow("normalized PNG");
    await expect(preparePortableImages(Buffer.alloc(8_000_001))).rejects.toThrow("size limit");
    await expect(preparePortableImages(original.subarray(0,30))).rejects.toThrow();
    expect(()=>portableHeroImages({[portableImagePaths.mobile]:assets[portableImagePaths.mobile]})).toThrow("Both");
    const broken=Buffer.from(assets[portableImagePaths.desktop]);broken.writeUInt32LE(0,4);
    expect(()=>portableHeroImages({...assets,[portableImagePaths.desktop]:broken})).toThrow("WebP");
    expect(()=>portableHeroImages({...assets,[portableImagePaths.mobile]:Buffer.alloc(250_001)})).toThrow("delivery budget");
    const legacy=portableHeroImages({[portableImagePaths.legacy]:original});
    expect(legacy.variants).toEqual([]);expect(legacy.fallback.width).toBe(1536);
  });
  it("rejects forged extended-canvas dimensions and animated image flags",async()=>{
    const rgba=await sharp({create:{width:120,height:80,channels:4,background:{r:40,g:80,b:90,alpha:.5}}}).png().toBuffer();
    const result=await preparePortableImages(rgba),original=Buffer.from(result[portableImagePaths.mobile]);
    expect(original.toString("ascii",12,16)).toBe("VP8X");
    const dimensions=Buffer.from(original);dimensions.writeUIntLE(10000,24,3);
    expect(()=>portableHeroImages({...result,[portableImagePaths.mobile]:dimensions})).toThrow("dimensions");
    const animated=Buffer.from(original);animated[20]|=0x02;
    expect(()=>portableHeroImages({...result,[portableImagePaths.mobile]:animated})).toThrow("animation");
  });
  it("admits exact local picture sources and width descriptors, while keeping original imagery private",()=>{
    const files=responsiveSite();expect(()=>assertPortableSiteSafety(files)).not.toThrow();
    const variants=portableHeroImages(assets).variants,sourceSet=variants.map(v=>`${v.path} ${v.width}w`).join(", ");
    expect(()=>assertPortableSiteSafety({...files,"index.html":Buffer.from(text(files["index.html"]).replace(`srcset="${portableImagePaths.mobile}"`,`srcset="${sourceSet}" sizes="(max-width: 760px) 100vw, 50vw"`))})).not.toThrow();
    expect(()=>assertPortableSiteSafety({...files,[portableImagePaths.legacy]:original})).toThrow("stay private");
    expect(()=>assertPortableSiteSafety({...files,"assets/images/customer-secret.webp":assets[portableImagePaths.mobile]})).toThrow("Unexpected");
  });
  it("rejects remote, escaped, missing and mismatched responsive assets before browser execution",()=>{
    const files=responsiveSite(),html=text(files["index.html"]);
    for(const source of ["https://outside.test/image.webp","//outside.test/image.webp","data:image/webp;base64,dGVzdA==","../assets/images/hero-mobile.webp","assets/images/%68ero-mobile.webp","assets/images/hero-mobile.webp?secret=1","assets/images/hero-mobile.webp 2x","assets/images/hero-mobile.webp 999w","assets/images/hero-mobile.webp, https://outside.test/image.webp 1000w","assets/images/hero-mobile.webp 720w, assets/images/hero-mobile.webp 720w"]){
      expect(()=>assertPortableSiteSafety({...files,"index.html":Buffer.from(html.replace(`srcset="${portableImagePaths.mobile}"`,`srcset="${source}"`))})).toThrow();
    }
    for(const injection of [`<source type="image/webp" srcset="${portableImagePaths.mobile}">`,`<picture><source type="image/webp" srcset="${portableImagePaths.mobile}"></picture>`,`<div srcset="${portableImagePaths.mobile}"></div>`]){
      expect(()=>assertPortableSiteSafety({...files,"index.html":Buffer.from(html.replace("</body>",`${injection}</body>`))})).toThrow();
    }
  });
  it("exports and independently rebuilds responsive images offline with no original PNG",async()=>{
    const files=responsiveSite(),blueprint=fixtureBlueprint();assertPortableSiteSafety(files);
    const archive=createPortableExport({files,plan:fixtureSitePlan,projectTitle:blueprint.brandName,productionTasks:blueprint.productionTasks,assetProvenance:{kind:"synthetic-test"}});
    const location=await mkdtemp(path.join(tmpdir(),"factory-responsive-export-")),zip=path.join(location,"source.zip"),extracted=path.join(location,"extracted");await writeFile(zip,archive.sourceZip);
    const command=promisify(execFile);
    await command("python",["-c","import pathlib,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; root=pathlib.Path(sys.argv[2]).resolve(); assert all((root / x.filename).resolve().is_relative_to(root) for x in z.infolist()); z.extractall(root)",zip,extracted]);
    await command(process.execPath,["build.mjs"],{cwd:extracted});
    for(const [name,bytes]of Object.entries(files))expect(await readFile(path.join(extracted,"dist",name))).toEqual(Buffer.from(bytes));
    await expect(readFile(path.join(extracted,"dist",portableImagePaths.legacy))).rejects.toThrow();
  },30000);
});
