import { createHash } from "node:crypto";
import data from "./font-assets/data.json";
import type { SiteFiles } from "./artifacts";

export type PortableFontTheme="studio"|"editorial"|"warm"|"technical";
const faces={
  "dm-sans.woff2":{family:"Site Sans",weight:"400 800",style:"normal"},
  "dm-serif-display.woff2":{family:"Site Display",weight:"400",style:"normal"},
  "dm-serif-display-italic.woff2":{family:"Site Display",weight:"400",style:"italic"},
  "manrope.woff2":{family:"Site Geometric",weight:"400 800",style:"normal"},
} as const;
const themeFiles:Record<PortableFontTheme,Array<keyof typeof faces>>={studio:["dm-sans.woff2"],editorial:["dm-sans.woff2","dm-serif-display.woff2","dm-serif-display-italic.woff2"],warm:["manrope.woff2","dm-serif-display.woff2","dm-serif-display-italic.woff2"],technical:["dm-sans.woff2","manrope.woff2"]};
const fontRule=(name:keyof typeof faces)=>{const f=faces[name];return `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:swap;src:url("fonts/${name}") format("woff2")}`;};
const license=["Locally bundled font software. Latin WOFF2 subsets distributed by Google Fonts.\nSource and licensing: https://github.com/google/fonts\n",data["dmsans-OFL.txt"],data["dmserifdisplay-OFL.txt"],data["manrope-OFL.txt"]].join("\n\n");
export const portableFontPaths=Object.keys(faces).map(name=>`assets/fonts/${name}`);
export const portableFontLicensePath="assets/fonts/licenses.txt";

/** Static imported data keeps exports portable in both the Next server and worker;
 * no runtime fetch, remote font dependency or working-directory lookup is needed. */
export function portableFontFiles(theme:PortableFontTheme):SiteFiles{
  return Object.fromEntries([...themeFiles[theme].map(name=>[`assets/fonts/${name}`,new Uint8Array(Buffer.from(data[name],"base64"))] as const),[portableFontLicensePath,new TextEncoder().encode(license)]]);
}
export function portableFontCss(theme:PortableFontTheme,headingWeight?:400|600|700|800){
  const serif=theme==="editorial"||theme==="warm";
  const body=theme==="warm"?'"Site Geometric",Arial,sans-serif':'"Site Sans",Arial,sans-serif';
  const heading=serif?'"Site Display",Georgia,serif':theme==="technical"?'"Site Geometric",Arial,sans-serif':body;
  const weight=headingWeight??(serif?400:600);
  // Emphasis belongs to the selected typography direction. A sans-serif plan
  // must not acquire an editorial serif (or synthetic italic) through <em>.
  return `${themeFiles[theme].map(fontRule).join("\n")}\n.presentation-v1{--body-font:${body};--heading-font:${heading};--emphasis-font:${heading};--emphasis-style:${serif?"italic":"normal"};--emphasis-weight:${serif?400:weight};--heading-weight:${weight};font-family:var(--body-font)}`;
}
/** Exact trusted bytes/rules are checked before safety permits local CSS URLs. */
export function assertPortableFontAssets(files:SiteFiles){
  const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
  const fonts=Object.keys(files).filter(name=>name.startsWith("assets/fonts/"));
  for(const name of fonts){
    const leaf=name.slice("assets/fonts/".length);
    if(name===portableFontLicensePath){if(Buffer.from(files[name]).toString("utf8")!==license)throw new Error("Portable font license text was modified.");continue;}
    if(!(leaf in faces)||hash(files[name])!==hash(Buffer.from(data[leaf as keyof typeof faces],"base64")))throw new Error("Only the bundled licensed fonts are allowed.");
  }
  if(fonts.some(name=>name.endsWith(".woff2"))&&!files[portableFontLicensePath])throw new Error("Portable fonts require their license attribution.");
}
export function stripApprovedFontCss(css:string,files:SiteFiles){
  assertPortableFontAssets(files);
  return css.replace(/@font-face\s*\{[^{}]*\}/gi,rule=>{
    const name=(Object.keys(faces) as Array<keyof typeof faces>).find(key=>fontRule(key)===rule);
    if(!name||!files[`assets/fonts/${name}`])throw new Error("Only exact local bundled font declarations are allowed.");
    return "";
  });
}
