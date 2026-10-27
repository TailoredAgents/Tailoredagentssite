import type { Browser } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { siteContentType,type SiteFiles,type SiteIssue,type SiteQaResult,siteLimits } from "./artifacts";
import { siteCsp } from "./render";
import { assertPortableSiteSafety } from "./safety";
import {actionDestinationIssue} from "./quality";
import {installSiteLabObserver,measureSiteLabPerformance,type SiteLabPerformance} from "./performance";

/** Browser must come from the dedicated, unprivileged isolated QA runtime. This
 * helper never launches Chromium or inherits the application's secrets. Network
 * requests are fulfilled from this version's memory bundle; all others abort.
 */
export async function checkPortableSite(input:{files:SiteFiles;browser:Browser}):Promise<SiteQaResult> {
  assertPortableSiteSafety(input.files);
  const pages=Object.keys(input.files).filter(p=>p.endsWith(".html")).sort();if(pages.length>siteLimits.maximumPages)throw new Error("Too many pages for a bounded QA run.");
  const origin="https://portable-site.factory.test",issues:SiteIssue[]=[],screenshots:SiteQaResult["screenshots"]=[],labPerformance:SiteLabPerformance[]=[];
  for(const viewport of [{name:"desktop" as const,width:1440,height:1000},{name:"mobile" as const,width:390,height:844}]) {
    const context=await input.browser.newContext({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:"block",acceptDownloads:false,permissions:[],javaScriptEnabled:true});
    const blocked=new Set<string>();
    try {
      await context.route("**/*",async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin||route.request().method()!=="GET"){blocked.add("Unexpected external or non-read request");await route.abort("blockedbyclient");return;}
        let pathname:string;try{pathname=decodeURIComponent(url.pathname);}catch{await route.abort();return;}
        if(pathname.includes("\\")||pathname.includes("..")||url.search){await route.abort();return;}
        const key=pathname==="/"?"index.html":pathname.slice(1).endsWith("/")?`${pathname.slice(1)}index.html`:pathname.slice(1);
        const bytes=input.files[key];if(!bytes){await route.fulfill({status:404,contentType:"text/plain",body:"Preview artifact not found"});return;}
        await route.fulfill({status:200,contentType:siteContentType(key),body:Buffer.from(bytes),headers:{"content-security-policy":siteCsp,"x-content-type-options":"nosniff","cache-control":"no-store"}});
      });
      await context.routeWebSocket("**/*",socket=>{blocked.add("Unexpected WebSocket request");socket.close();});
      for(const file of pages) {
        const page=await context.newPage(),pageErrors:string[]=[];
        page.on("pageerror",()=>pageErrors.push("The preview runtime reported a browser error."));
        try {
          await installSiteLabObserver(page);
          await page.goto(`${origin}/${file}`,{waitUntil:"load",timeout:15000});
          // Record the real initial render before forcing lazy assets into view
          // or clicking anything. These are isolated lab observations only.
          await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
          labPerformance.push(await measureSiteLabPerformance(page,file,viewport.name));
          // Inspect the full page, including images below the initial viewport.
          // Lazy images otherwise leave decode() pending until somebody scrolls.
          await page.evaluate(async()=>{
            for(const img of document.images)img.loading="eager";
            let timer:ReturnType<typeof setTimeout>;
            try { await Promise.race([
              Promise.all([document.fonts.ready,...[...document.images].map(i=>i.decode().catch(()=>undefined))]),
              new Promise(resolve=>{timer=setTimeout(resolve,5000);}),
            ]); } finally { clearTimeout(timer!); }
          });
          const inspection=await page.evaluate(()=>{
            const ids=[...document.querySelectorAll("[id]")].map(e=>e.id);
            const strip=document.querySelector<HTMLElement>("body.presentation-v1 .mobile-contact"),stripRect=strip?.getBoundingClientRect();
            // A fixed footer can cover any content as a visitor scrolls, even
            // when the first screenshot happens to place it over whitespace.
            const contactOverlay=!!strip&&!!stripRect&&stripRect.height>0&&(["fixed","sticky"].includes(getComputedStyle(strip).position)||[...document.querySelectorAll("main img,main h1,main h2,main h3,main p,main form")].some(element=>{
              if(strip.contains(element))return false;
              const rect=element.getBoundingClientRect();
              return Math.min(rect.right,stripRect.right)-Math.max(rect.left,stripRect.left)>2&&Math.min(rect.bottom,stripRect.bottom)-Math.max(rect.top,stripRect.top)>2;
            }));
            return {overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
              contactOverlay,
              missingImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute("src")||""),
              links:[...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map(a=>({href:a.getAttribute("href")||"",resolved:a.href,label:(a.textContent||"").trim()})),
              ids,duplicateIds:ids.filter((v,i)=>ids.indexOf(v)!==i),title:document.title,
              h1:document.querySelectorAll("h1").length,main:document.querySelectorAll("main").length,
              notices:document.querySelector(".preview-notice")?.textContent||""};
          });
          const add=(code:string,message:string)=>issues.push({code,message,page:file,viewport:viewport.name,severity:"error"});
          if(inspection.overflow)add("horizontal_overflow","Content extends beyond the viewport.");
          if(inspection.contactOverlay)add("mobile_contact_overlap","Quick contact controls must occupy their own normal-flow space without covering page content, images or captions.");
          if(inspection.missingImages.length)add("missing_image",`Missing local images: ${inspection.missingImages.slice(0,5).join(", ")}`);
          if(!inspection.title.trim()||inspection.h1!==1||inspection.main!==1)add("page_structure","Each page needs a title, one primary heading and one main landmark.");
          if(inspection.duplicateIds.length)add("duplicate_ids","Page sections contain duplicate identifiers.");
          if(!inspection.notices.includes("demonstrations"))add("demo_notice","The website concept must identify demo interactions.");
          for(const link of inspection.links){
            const incorrectAction=actionDestinationIssue(link.label,link.href);if(incorrectAction)add("misleading_action",incorrectAction);
            const url=new URL(link.resolved);
            if(["mailto:","tel:"].includes(url.protocol))continue;
            if(url.origin!==origin){add("unexpected_link","A link leaves the portable website without an approved integration.");continue;}
            const target=url.pathname.endsWith("/")?`${url.pathname.slice(1)}index.html`:url.pathname.slice(1);
            if(!input.files[target])add("broken_link",`Missing internal link target: ${target}`);
            else if(url.hash){
              const ids=target===file?inspection.ids:[...Buffer.from(input.files[target]).toString("utf8").matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
              if(!ids.includes(decodeURIComponent(url.hash.slice(1))))add("broken_anchor",`Missing page section: ${target}${url.hash}`);
            }
          }
          if(viewport.name==="mobile"){
            const menu=page.locator("[data-menu-toggle]");await menu.click();
            if(await menu.getAttribute("aria-expanded")!=="true"||!await page.locator("#site-menu").isVisible())add("mobile_menu","The mobile navigation did not open.");
            await menu.click();
          }
          for(const group of await page.locator("[data-service-tabs]").all()){
            const tabs=group.locator("[data-service-tab]"),panels=group.locator("[data-service-panel]"),count=await tabs.count();
            if(!count||await panels.count()!==count){add("service_tabs","Service choices do not have matching content panels.");continue;}
            for(let index=0;index<count;index++){
              await tabs.nth(index).click();
              if(await tabs.nth(index).getAttribute("aria-selected")!=="true"||!await panels.nth(index).isVisible()||await tabs.nth(index).getAttribute("aria-controls")!==await panels.nth(index).getAttribute("id"))add("service_tabs","A service choice did not reveal its associated content.");
              if(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2))add("horizontal_overflow","A revealed service panel extends beyond the viewport.");
              // The final whole-page axe run sees only the initially selected
              // panel. Check each other revealed panel in isolation so hidden
              // service content cannot escape contrast/label checks. The
              // blueprint bounds each collection to at most eight panels.
              if(index>0){
                const panelId=await panels.nth(index).getAttribute("id");
                if(panelId){
                  await panels.nth(index).scrollIntoViewIfNeeded();
                  const revealed=await new AxeBuilder({page}).include(`#${panelId}`).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
                  for(const violation of revealed.violations.filter(v=>["serious","critical"].includes(v.impact||"")))add(`accessibility_${violation.id}`,`${violation.help}: service panel ${index+1} (${panelId}), ${violation.nodes.length} affected elements.`);
                }
              }
            }
            await tabs.nth(0).click();
            if(count>1){await tabs.nth(0).press("ArrowRight");if(await tabs.nth(1).getAttribute("aria-selected")!=="true")add("service_tabs_keyboard","Service choices did not respond to keyboard navigation.");await tabs.nth(0).click();}
          }
          const forms=page.locator("[data-demo-form]");
          for(const form of await forms.all()){
            const values={name:"Preview check",email:"preview@example.test",phone:"(555) 555-0123",location:"Synthetic city",message:"Synthetic demo form check",contactDetail:"preview@example.test"};
            for(const [name,value] of Object.entries(values)){const field=form.locator(`[name="${name}"]`);if(await field.count())await field.fill(value);}
            await form.locator('button[type="submit"]').click();
            if(!(await form.locator("[data-demo-feedback]").textContent())?.includes("was not sent"))add("demo_form","Demo form did not explain that no message was sent.");
          }
          if(await forms.count())await page.reload({waitUntil:"load"});
          const accessibility=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
          for(const violation of accessibility.violations.filter(v=>["serious","critical"].includes(v.impact||"")))add(`accessibility_${violation.id}`,`${violation.help}: ${violation.nodes.length} affected elements (${violation.nodes.slice(0,3).map(n=>n.target.join(" ")).join(", ").slice(0,250)})`);
          for(const err of pageErrors)add("browser_error",err);
          // Accessibility probes focus the skip link and can scroll the page.
          // Capture the actual resting design after those interaction checks.
          await page.evaluate(async()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo({top:0,behavior:"instant"});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});
          const regions=await page.evaluate(()=>[...document.querySelectorAll("main > section,main > header,main > .hero")].slice(0,16).map((el,index)=>{const rect=el.getBoundingClientRect();return {id:el.id||`section-${index}`,top:Math.max(0,Math.round(rect.top+scrollY)),height:Math.round(rect.height)};}).filter(region=>region.height>0));
          screenshots.push({page:file,viewport:viewport.name,regions,bytes:await page.screenshot({fullPage:true,animations:"disabled",timeout:10000})});
        } catch {issues.push({code:"qa_interrupted",message:"Browser checks did not complete for this page.",page:file,viewport:viewport.name,severity:"error"});}
        finally{await page.close();}
      }
      if(blocked.size)issues.push({code:"blocked_network",message:"The preview attempted a request outside its local artifact bundle.",page:"index.html",viewport:viewport.name,severity:"error"});
    } finally {await context.close();}
  }
  const distinct=issues.filter((issue,i)=>issues.findIndex(x=>x.code===issue.code&&x.page===issue.page&&x.viewport===issue.viewport&&x.message===issue.message)===i);
  return {passed:!distinct.some(i=>i.severity==="error"),issues:distinct.slice(0,100),screenshots,labPerformance,checkedAt:new Date().toISOString()};
}

export function screenshotPath(page:string,viewport:"desktop"|"mobile") {
  return `screenshots/${path.posix.dirname(page)==="."?"home":path.posix.dirname(page)}-${viewport}.png`;
}
