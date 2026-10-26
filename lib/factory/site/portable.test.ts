import {beforeAll,afterAll,describe,expect,it} from "vitest";
import {chromium,type Browser} from "playwright";
import sharp from "sharp";
import {mkdir,writeFile,readFile,mkdtemp} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {tmpdir} from "node:os";
import {fixtureBlueprint,fixtureHeroSvg,fixtureSitePlan} from "./fixtures";
import {portableBundle} from "./validate";
import {renderPortableSite,trustedSiteRuntime} from "./render";
import {assertPortableSiteSafety} from "./safety";
import {createPortableExport} from "./package";
import {checkPortableSite,screenshotPath} from "./qa";
import {designFamilies} from "./families";
import {designFamilyIds} from "./types";
import {relativeSiteLink,safeSitePath,siteManifest,zipSiteFiles} from "./artifacts";

const command=promisify(execFile),output=path.join(tmpdir(),"tailored-agents-factory-site-core");
let browser:Browser,hero:Buffer;
beforeAll(async()=>{await mkdir(output,{recursive:true});hero=await sharp(Buffer.from(fixtureHeroSvg)).png().toBuffer();browser=await chromium.launch({headless:true});},30000);
afterAll(async()=>{await browser?.close();});

describe("Portable website renderer and independent source export",()=>{
  it("escapes model-authored content and rejects active resource injection before browser execution",()=>{
    const blueprint=fixtureBlueprint();blueprint.brandName='<script>alert("unsafe")</script>';blueprint.pages[0].hero.body='<img src="https://outside.test" onerror="bad()">';
    const {files}=renderPortableSite(portableBundle(blueprint),{"assets/images/hero.png":hero});
    expect(Buffer.from(files["index.html"]).toString()).toContain("&lt;script&gt;");expect(()=>assertPortableSiteSafety(files)).not.toThrow();
    for(const injected of ['<script src="https://outside.test/a.js"></script>','<img src="https://outside.test/a.png">','<iframe src="https://outside.test"></iframe>','<form action="https://outside.test"><button>Send</button></form>','<img src="assets/images/hero.png" onerror="alert(1)">']){
      expect(()=>assertPortableSiteSafety({...files,"index.html":Buffer.from(Buffer.from(files["index.html"]).toString().replace("</body>",`${injected}</body>`))})).toThrow();
    }
    expect(()=>assertPortableSiteSafety({...files,"assets/runtime.js":Buffer.from(`${trustedSiteRuntime};fetch('https://outside.test')`)})).toThrow("trusted");
    expect(()=>assertPortableSiteSafety({...files,"assets/site.css":Buffer.from("@import 'https://outside.test/font.css';")})).toThrow("styles");
    blueprint.accent="#fff};body{background:url(https://outside.test)}";
    expect(()=>renderPortableSite(portableBundle(blueprint),{"assets/images/hero.png":hero})).toThrow();
  });
  it("keeps paths, local links, private metadata and public artifacts separate",()=>{
    for(const name of ["../secret","a/../../file","/root/file","C:/file","a\\file",".env","assets//file","a/./file"]){expect(()=>safeSitePath(name)).toThrow();}
    expect(relativeSiteLink("services/index.html","assets/site.css")).toBe("../assets/site.css");
    const b=fixtureBlueprint("professional","minimal",true),{files,manifest}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    expect(manifest.files.filter(f=>f.path.endsWith(".html"))).toHaveLength(3);expect(files["brief.json"]).toBeUndefined();expect(files["blueprint.json"]).toBeUndefined();
    expect(()=>assertPortableSiteSafety(files)).not.toThrow();
    expect(()=>siteManifest({...files,"bad.exe":new Uint8Array()})).toThrow();
    expect(zipSiteFiles(files)).toEqual(zipSiteFiles(files));
  });
  it("extracts the actual ZIP and builds identical static files without dependencies or Factory services",async()=>{
    const b=fixtureBlueprint("professional","minimal",true),{files,manifest}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero});
    const archive=createPortableExport({files,plan:fixtureSitePlan,projectTitle:b.brandName,productionTasks:b.productionTasks,assetProvenance:{kind:"synthetic-test"},blueprint:b});
    const location=await mkdtemp(path.join(output,"standalone-")),zip=path.join(location,"source.zip"),extracted=path.join(location,"extracted");await writeFile(zip,archive.sourceZip);
    // Python's independent ZIP reader checks CRC and extracts only this archive's
    // already validated local entries; no generated program is executed.
    await command("python",["-c","import pathlib,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; root=pathlib.Path(sys.argv[2]).resolve(); assert all((root / x.filename).resolve().is_relative_to(root) for x in z.infolist()); z.extractall(root)",zip,extracted]);
    const built=await command(process.execPath,["build.mjs"],{cwd:extracted});expect(built.stdout).toContain("Static website built into dist/");
    for(const file of manifest.files)expect(await readFile(path.join(extracted,"dist",file.path))).toEqual(Buffer.from(files[file.path]));
    expect(JSON.parse(await readFile(path.join(extracted,"package.json"),"utf8")).dependencies).toBeUndefined();
    expect(await readFile(path.join(extracted,"blueprint.json"),"utf8")).toContain(b.brandName);
  },30000);
  it("checks a complete three-page export at desktop and mobile, including nav/forms/accessibility",async()=>{
    const {files}=renderPortableSite(portableBundle(fixtureBlueprint("professional","minimal",true)),{"assets/images/hero.png":hero});
    const qa=await checkPortableSite({files,browser});await writeFile(path.join(output,"multipage-qa.json"),JSON.stringify({...qa,screenshots:qa.screenshots.map(s=>({page:s.page,viewport:s.viewport}))},null,2));
    for(const shot of qa.screenshots){const location=path.join(output,"multipage",screenshotPath(shot.page,shot.viewport));await mkdir(path.dirname(location),{recursive:true});await writeFile(location,shot.bytes);}
    expect(qa.issues).toEqual([]);expect(qa.passed).toBe(true);expect(qa.screenshots).toHaveLength(6);
  },120000);
  it("handles all section styles, long labels and dark contact bands without overflow or inaccessible text",async()=>{
    const b=fixtureBlueprint("editorial","asymmetric",true);
    b.brandName="A thoughtful independent studio with an unusually long name";
    b.pages[0].hero.headline="AReallyLongUnbrokenConceptNameThatMustStayWithinItsColumn";
    b.pages[1].title="A detailed introduction to our creative process";
    b.pages[2].title="Explore all of our proposed creative services";
    for(const page of b.pages){
      page.sections.push({id:"story",kind:"about",layout:"split",eyebrow:"The idea",title:"A considered point of view.",body:"An early direction for the next chapter.",items:[{title:"Start with what matters",body:"Discuss the direction before moving ahead."}]});
      page.sections.push({id:"statement",kind:"statement",layout:"band",eyebrow:"A useful starting point",title:"Every detail has a purpose.",body:"Find the right approach for what comes next.",items:[]});
      page.sections.push({id:"contact",kind:"contact",layout:"band",eyebrow:"Let's begin",title:"Tell us what you have in mind.",body:"This demonstration form is a preview of the experience.",items:[]});
    }
    const {files}=renderPortableSite(portableBundle(b),{"assets/images/hero.png":hero}),qa=await checkPortableSite({files,browser});
    expect(qa.issues).toEqual([]);expect(qa.passed).toBe(true);
  },120000);
});

describe("Twelve distinctive design compositions — real local browser checks",()=>{
  for(const family of designFamilyIds)for(const composition of designFamilies[family].compositions){
    it(`${family}/${composition} has local imagery, working interactions, responsive layouts and no serious WCAG violations`,async()=>{
      const blueprint=fixtureBlueprint(family,composition),{files}=renderPortableSite(portableBundle(blueprint),{"assets/images/hero.png":hero});
      const qa=await checkPortableSite({files,browser}),directory=path.join(output,`${family}-${composition}`);await mkdir(directory,{recursive:true});
      for(const shot of qa.screenshots)await writeFile(path.join(directory,`${shot.viewport}.png`),shot.bytes);
      await writeFile(path.join(directory,"qa.json"),JSON.stringify({...qa,screenshots:qa.screenshots.map(s=>({page:s.page,viewport:s.viewport}))},null,2));
      expect(qa.issues).toEqual([]);expect(qa.passed).toBe(true);expect(qa.screenshots).toHaveLength(2);
    },60000);
  }
});
