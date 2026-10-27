import type {FactoryClaimedBuild} from "./build-types";
import type {SiteAssetDescriptor,SiteBlueprint} from "./site/types";
import {portableImageSlotPaths,portableLogoPath} from "./site/images";

export type FactoryImageSlot={id:string;role:"photo"|"logo";source:"provided"|"generated";uploadId:string|null;prompt:string;alt:string;caption:string};
export type FactorySavedImage={key:string;sha256:string;inputHash:string;provenance:unknown};

/** The generation model only sees approved descriptors, never storage keys. */
export function factoryBuildAssetDescriptors(build:Pick<FactoryClaimedBuild,"uploads">):SiteAssetDescriptor[]{
  let firstPhoto=true;
  return build.uploads.map((upload,index)=>{
    const role=upload.role||"photo",hero=role==="photo"&&firstPhoto;
    if(hero)firstPhoto=false;
    return {id:upload.id,path:hero?"assets/images/hero.png":`approved-reference-${index}.png`,alt:upload.alt?.trim()||(role==="logo"?"Business logo supplied by the team":"Business photo supplied by the team"),provenance:"provided",role,caption:upload.filename};
  });
}

/** Bind only uploads frozen by human approval. The model cannot fetch URLs,
 * choose another project's upload, turn a logo into a photo, or invent a logo. */
export function resolveFactoryBuildImages(build:Pick<FactoryClaimedBuild,"uploads">,blueprint:SiteBlueprint):FactoryImageSlot[]{
  const heroUpload=build.uploads.find(upload=>(upload.role||"photo")==="photo");
  const slots:FactoryImageSlot[]=[{id:"hero",role:"photo",source:heroUpload?"provided":"generated",uploadId:heroUpload?.id||null,...blueprint.heroImage}];
  const media=blueprint.media||[];
  if(media.length>4)throw new Error("A website may contain at most four additional image assets.");
  const ids=new Set(["hero"]);let logos=0,generated=heroUpload?0:1;
  for(const asset of media){
    portableImageSlotPaths(asset.id);
    if(ids.has(asset.id))throw new Error("Website image asset IDs must be unique.");
    ids.add(asset.id);
    if(asset.role==="logo"){
      portableLogoPath(asset.id);
      if(++logos>1||asset.source!=="provided")throw new Error("A business logo must be a single approved team upload.");
    }
    if(asset.source==="provided"){
      const upload=build.uploads.find(upload=>upload.id===asset.uploadId);
      if(!upload||(upload.role||"photo")!==asset.role)throw new Error("A website image does not match an approved upload and its role.");
    }else{
      if(asset.uploadId!==null||asset.role!=="photo"||++generated>3||media.filter(item=>item.source==="generated").length>2)throw new Error("Website image generation exceeds its bounded asset allowance.");
    }
    slots.push({...asset});
  }
  return slots;
}
