import type {SiteBlueprint} from "./types";

/** Coordinates use CSS object-position semantics: 0 aligns the leading edge,
 * 100 the trailing edge. They never alter the stored original image. */
export function imageFocalPoint(blueprint:SiteBlueprint,assetId:string,viewport:"desktop"|"mobile"="desktop"){
  return blueprint.presentation?.imageFocalPoints?.find(point=>point.assetId===assetId)?.[viewport]
    ||(assetId==="hero"?blueprint.design?.heroFocalPoint:undefined)||{x:50,y:50};
}

export function imageCompositionCss(blueprint:SiteBlueprint){
  // Historical approved blueprints retain their original renderer behavior.
  if(blueprint.presentation?.imageFocalPoints===undefined)return "";
  const ids=["hero",...(blueprint.media||[]).filter(asset=>asset.role==="photo").map(asset=>asset.id)];
  const rules=(viewport:"desktop"|"mobile")=>ids.map(id=>{const point=imageFocalPoint(blueprint,id,viewport);return `body.presentation-v1 img[data-asset-id="${id}"]{object-position:${point.x}% ${point.y}%}`;}).join("\n");
  return `${rules("desktop")}\n@media(max-width:760px){${rules("mobile")}}`;
}
