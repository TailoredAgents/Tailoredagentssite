import {createHash} from "node:crypto";
import {resolveFactoryBuildImages} from "./build-assets";
import {validateBlueprintStructure} from "./site/validate";
import type {FactoryDraftSnapshot} from "./draft-types";

/** Private, bounded saved data only. Raw provider responses are never retained here. */
export function factoryDraftSnapshot(value:unknown,prefix:string):FactoryDraftSnapshot|null {
  try{
    if(!value||typeof value!=="object")return null;
    const state=value as Partial<FactoryDraftSnapshot>;
    if(state.heroKey!==`${prefix}assets/hero.png`||!state.imageAssets||!Array.isArray(state.inputUploads)||state.inputUploads.length>20)return null;
    const blueprint=validateBlueprintStructure(state.blueprint),slots=resolveFactoryBuildImages({uploads:state.inputUploads},blueprint);
    const imageAssets:FactoryDraftSnapshot["imageAssets"]={};
    for(const slot of slots){
      const image=state.imageAssets[slot.id];
      if(!image||image.key!==`${prefix}assets/${slot.id}.png`||!/^[0-9a-f]{64}$/.test(image.sha256)||!/^[0-9a-f]{64}$/.test(image.inputHash))return null;
      imageAssets[slot.id]={key:image.key,sha256:image.sha256,inputHash:image.inputHash,provenance:image.provenance??null};
    }
    const snapshot:FactoryDraftSnapshot={version:1,blueprint,heroKey:state.heroKey,imageAssets,inputUploads:state.inputUploads,provenance:state.provenance??null};
    return Buffer.byteLength(JSON.stringify(snapshot))<=200000?snapshot:null;
  }catch{return null;}
}
export function factoryDraftFingerprint(snapshot:FactoryDraftSnapshot){return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");}
