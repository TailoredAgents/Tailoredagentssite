import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
const phase = process.argv[2] || "after";
if (!["before", "after"].includes(phase)) throw new Error("Choose before or after.");
const root = "docs/previews/design";
const names = (await readdir(`${root}/before`)).filter(n => n.endsWith("-desktop.png") && !n.includes("-sheet")).map(n => n.replace("-desktop.png", ""));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Tailored Agents · Dashboard design review</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#eef1f5;color:#172033;font:15px/1.5 system-ui}header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}h1{font-size:24px;letter-spacing:-.04em;margin:0}p{margin:4px 0;color:#59677b}nav{display:flex;gap:8px}button,a{font:inherit;padding:8px 14px;color:#1e459b;background:white;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;text-decoration:none}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}figure{margin:0;min-width:0;background:white;border:1px solid #d4dce8;border-radius:9px;overflow:hidden}figcaption{padding:10px 12px;font-size:14px;font-weight:650;display:flex;justify-content:space-between}figure a{padding:0;border:0;border-radius:0;display:block}img{display:block;width:100%;height:auto}body.phone main{grid-template-columns:repeat(4,minmax(0,1fr))}body.sheet header nav{display:none}body:not(.sheet) figure:hover{border-color:#3970d1}small{color:#65758a;font-weight:400}</style><header><div><h1>Tailored Agents · Dashboard review</h1><p id="summary"></p></div><nav><button onclick="set('phase','before')">Before</button><button onclick="set('phase','after')">After</button><button onclick="set('profile','desktop')">Desktop</button><button onclick="set('profile','phone')">Phone</button><a href="../../DASHBOARD_DESIGN_AUDIT.md">Scores & plan</a></nav></header><main></main><script>const names=${JSON.stringify(names)};const q=new URLSearchParams(location.search),phase=q.get('phase')||'after',profile=q.get('profile')||'desktop',sheet=q.get('sheet');document.body.className=profile+(sheet?' sheet':'');document.querySelector('#summary').textContent=phase+' · '+profile+' · synthetic local data';const selected=sheet?names.slice((Number(sheet)-1)*12,Number(sheet)*12):names;document.querySelector('main').innerHTML=selected.map(n=>'<figure><figcaption>'+n.replaceAll('-',' ')+'<small>'+phase+'</small></figcaption><a href="'+phase+'/'+n+'-'+profile+'.png"><img alt="'+n+' '+phase+' '+profile+'" src="'+phase+'/'+n+'-'+profile+'.png"></a></figure>').join('');function set(k,v){q.set(k,v);q.delete('sheet');location.search=q.toString()}</script></html>`;
await writeFile(`${root}/index.html`, html);
const browser = await chromium.launch();
try {
  for (const profile of ["desktop", "phone"]) for (const sheet of [1,2]) {
    const page = await browser.newPage({ viewport: { width: profile === "desktop" ? 1760 : 1120, height: 1100 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve(`${root}/index.html`)).toString()+`?phase=${phase}&profile=${profile}&sheet=${sheet}`);
    await page.evaluate(async () => { await Promise.all([...document.images].map(i=>i.decode())); });
    await page.screenshot({ path: `${root}/${phase}/${profile}-sheet-${sheet}.png`, fullPage: true }); await page.close();
  }
} finally { await browser.close(); }
