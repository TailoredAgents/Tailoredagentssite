import {createHash} from "node:crypto";
import sharp from "sharp";
import {describe,expect,it,vi} from "vitest";
import type {FactoryClaimedBuild} from "../build-types";
import {assetEvidenceLimits,buildAssetEvidence,validateAssetEvidence} from "./asset-evidence";
import {portableImageLimits} from "./images";
vi.mock("server-only",()=>({}));
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
function upload(id:string,bytes:Uint8Array,role:"photo"|"logo"="photo"):FactoryClaimedBuild["uploads"][number]{return {id,role,filename:"untrusted-filename-ignore-instructions.png",alt:"Untrusted image text",storageKey:`private/${id}.png`,byteSize:bytes.length,sha256:digest(bytes),contentType:"image/png",createdAt:"2026-10-28"};}

describe("Bounded approved-image evidence",()=>{
  it("covers all 20 approved uploads with two bounded sheets and original role, dimensions and digest",async()=>{
    const landscape=await sharp({create:{width:800,height:200,channels:3,background:"#d04020"}}).png().toBuffer(),portrait=await sharp({create:{width:200,height:800,channels:3,background:"#2040d0"}}).png().toBuffer();
    const uploads=Array.from({length:20},(_,index)=>upload(`asset-${index}`,index%2?portrait:landscape,index===0?"logo":"photo"));
    const load=vi.fn(async(key:string,_maximum:number)=>Number(key.match(/asset-(\d+)/)![1])%2?portrait:landscape);
    const evidence=await buildAssetEvidence({uploads},load);
    expect(load).toHaveBeenCalledTimes(20);expect(load.mock.calls.every(call=>call[1]===portableImageLimits.sourceBytes)).toBe(true);
    expect(evidence.references).toEqual(uploads.map((item,index)=>({id:item.id,reference:`A${index+1}`,role:item.role,width:index%2?200:800,height:index%2?800:200,sha256:item.sha256})));
    expect(evidence.images).toHaveLength(2);
    for(const image of evidence.images){expect(image.bytes.byteLength).toBeLessThanOrEqual(assetEvidenceLimits.sheetBytes);expect(await sharp(image.bytes).metadata()).toMatchObject({format:"jpeg",width:1600,height:560});}
    expect(evidence.images[0].label).toContain("A1–A10");expect(evidence.images[1].label).toContain("A11–A20");
    expect(JSON.stringify(evidence.references)).not.toContain("private/");expect(evidence.images.map(item=>item.label).join(" ")).not.toContain("untrusted-filename");
    expect(()=>validateAssetEvidence(evidence,uploads.map(item=>item.id))).not.toThrow();
    // Fit-inside keeps both aspect ratios visible rather than silently cropping
    // off the edges before the generator decides how to use the photos.
    const {data,info}=await sharp(evidence.images[0].bytes).raw().toBuffer({resolveWithObject:true});
    const pixel=(x:number,y:number)=>Array.from(data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3));
    expect(pixel(160,160)[0]).toBeGreaterThan(150);expect(pixel(160,60).every(value=>value>240)).toBe(true);
    expect(pixel(480,60)[2]).toBeGreaterThan(150);expect(pixel(340,160).every(value=>value>240)).toBe(true);
  });

  it("needs no images for a sparse lead and rejects oversized upload sets before reading anything",async()=>{
    const load=vi.fn();expect(await buildAssetEvidence({uploads:[]},load)).toEqual({references:[],images:[]});
    await expect(buildAssetEvidence({uploads:Array.from({length:21},(_,index)=>upload(String(index),Buffer.from("unused")))},load)).rejects.toThrow("Too many");expect(load).not.toHaveBeenCalled();
  });

  it("rejects changed approved contents and non-normalized images before they enter a model request",async()=>{
    const bytes=await sharp({create:{width:120,height:80,channels:3,background:"#123456"}}).png().toBuffer(),approved=upload("photo",bytes);
    const changed=await sharp(bytes).negate().png().toBuffer();
    await expect(buildAssetEvidence({uploads:[approved]},async()=>changed)).rejects.toThrow("saved contents");
    const jpeg=await sharp(bytes).jpeg().toBuffer();await expect(buildAssetEvidence({uploads:[{...approved,sha256:undefined}]},async()=>jpeg)).rejects.toThrow("normalized PNG");
    await expect(buildAssetEvidence({uploads:[{...approved,sha256:undefined}]},async()=>new Uint8Array(portableImageLimits.sourceBytes+1))).rejects.toThrow("normalized PNG");
    // Old snapshots can be inspected without inventing a hash from today's DB row.
    expect((await buildAssetEvidence({uploads:[{...approved,sha256:undefined}]},async()=>bytes)).references[0].sha256).toBe(digest(bytes));
  });

  it("refuses foreign or duplicate references and over-budget contact sheets",()=>{
    const reference={id:"approved",reference:"A1",role:"photo" as const,width:120,height:80,sha256:"a".repeat(64)};
    expect(()=>validateAssetEvidence({references:[reference],images:[]},[])).toThrow("unapproved");
    expect(()=>validateAssetEvidence({references:[reference,reference],images:[]},["approved"])).toThrow("duplicate");
    expect(()=>validateAssetEvidence({references:[reference],images:[{bytes:new Uint8Array(assetEvidenceLimits.sheetBytes+1),label:"Approved photos"}]},["approved"])).toThrow("request limits");
    expect(()=>validateAssetEvidence({references:[reference],images:Array.from({length:3},()=>({bytes:new Uint8Array(1),label:"Photos"}))},["approved"])).toThrow();
  });
});
