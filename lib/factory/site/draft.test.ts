import {describe,expect,it} from "vitest";
import {applySiteDraftPatches,parseSiteDraftPatches,type SiteDraftPatch} from "./draft";
import {fixtureBlueprint} from "./fixtures";

const content={headline:"A clear starting point",body:"Discuss the priorities that matter to your project.",layout:null,items:null};
const patches:SiteDraftPatch[]=[{target:{pagePath:"index.html",sectionId:"__intro__"},content},{target:{pagePath:"services/index.html",sectionId:"options"},content:{...content,headline:"Compare the possibilities",layout:"rows"}}];

describe("Atomic saved website draft patches",()=>{
  it("changes multiple selected parts without mutating the source, routes, actions, forms, design or assets",()=>{
    const source=fixtureBlueprint("trades","split",true);
    source.pages[0].sections.find(section=>section.id==="services")!.kind="contact";
    source.interactions!.forms.push({pagePath:"index.html",sectionId:"services",fields:["name","email","message"],submitLabel:"Preview inquiry"});
    source.interactions!.actions.push({pagePath:"services/index.html",sectionId:"options",itemIndex:0,label:"Read the process",targetPage:"approach/index.html",targetSection:"discovery"});
    const snapshot=structuredClone(source),expected=structuredClone(source);
    expected.pages[0].hero.headline=content.headline;expected.pages[0].hero.body=content.body;
    Object.assign(expected.pages[2].sections[0],{title:patches[1].content.headline,body:content.body,layout:"rows"});
    const result=applySiteDraftPatches(source,JSON.stringify(patches));
    expect(result).toEqual(expected);expect(source).toEqual(snapshot);
    for(const key of ["interactions","design","heroImage","contact","media","presentation"] as const)expect(result[key]).toEqual(snapshot[key]);
  });
  it("rejects a later invalid target atomically and cannot inject fields outside content scope",()=>{
    const source=fixtureBlueprint("trades","split",true),snapshot=structuredClone(source);
    expect(()=>applySiteDraftPatches(source,[patches[0],{...patches[1],target:{...patches[1].target,sectionId:"missing"}}])).toThrow("Choose a section");
    expect(source).toEqual(snapshot);
    for(const value of [{...patches[1],content:{...content,contact:{phone:"+15555550123"}}},{...patches[1],target:{...patches[1].target,versionId:"different-website"}},{...patches[1],forms:[]}])expect(()=>applySiteDraftPatches(source,[patches[0],value])).toThrow();
    expect(source).toEqual(snapshot);
  });
  it("rejects duplicate or empty targets, invalid JSON, and batches above twelve parts",()=>{
    expect(()=>parseSiteDraftPatches([patches[0],patches[0]])).toThrow("only one change");
    expect(()=>parseSiteDraftPatches([])).toThrow("at least one");
    expect(()=>parseSiteDraftPatches("not-json")).toThrow("saved section changes");
    expect(()=>parseSiteDraftPatches(Array.from({length:13},(_,i)=>({...patches[0],target:{...patches[0].target,sectionId:`section-${i}`}})))).toThrow("up to 12");
    expect(()=>parseSiteDraftPatches([patches[0],{...patches[1],target:{pagePath:"../index.html",sectionId:"options"}}])).toThrow();
  });
  it("bounds UTF-8 bytes before parsing or returning a structurally valid batch",()=>{
    expect(()=>parseSiteDraftPatches(" ".repeat(200001))).toThrow("too long");
    expect(()=>parseSiteDraftPatches("界".repeat(70000))).toThrow("too long");
    const oversized=Array.from({length:12},(_,i)=>({target:{pagePath:"index.html",sectionId:`section-${i}`},content:{...content,body:"界".repeat(1400),items:Array.from({length:8},()=>({title:"Item",body:"界".repeat(1400)}))}}));
    expect(()=>parseSiteDraftPatches(oversized)).toThrow("too long");
  });
  it("preserves item identities linked to actions and validates every introduction contract",()=>{
    const source=fixtureBlueprint("trades","split",true);
    source.interactions!.actions.push({pagePath:"services/index.html",sectionId:"options",itemIndex:0,label:"Read the process",targetPage:"approach/index.html",targetSection:null});
    const snapshot=structuredClone(source);
    expect(()=>applySiteDraftPatches(source,[patches[0],{...patches[1],content:{...content,items:[]}}])).toThrow("number and order");
    expect(()=>applySiteDraftPatches(source,[patches[1],{...patches[0],content:{...content,layout:"rows"}}])).toThrow("introduction supports");
    expect(source).toEqual(snapshot);
  });
});
