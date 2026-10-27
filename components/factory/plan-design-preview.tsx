import type {CSSProperties} from "react";
import type {FactoryPlanContent} from "@/lib/factory/types";
import {approvedDesignConstraints} from "@/lib/factory/site/design";
import {designFamilies} from "@/lib/factory/site/families";

const openings={split:"Text beside the image",immersive:"Full-image opening",editorial:"Editorial opening",centered:"Centered opening",asymmetric:"Asymmetric opening",minimal:"Typography-led opening",framed:"Framed image opening"};
const typeLabels={studio:"Clean studio typography",editorial:"Editorial serif typography",warm:"Warm serif typography",technical:"Precise sans-serif typography"};
const paletteLabels={background:"Background",surface:"Surface",ink:"Text",muted:"Secondary text",accent:"Accent",accentSecondary:"Supporting accent"};

/** A schematic of the saved proposal, never a pre-approval generated client site. */
export function PlanDesignPreview({plan}:{plan:FactoryPlanContent}){
  const recipe=plan.design.recipe;
  const palette=approvedDesignConstraints(plan).palette;
  const colors=Object.entries(palette).filter((entry):entry is [keyof typeof paletteLabels,string]=>/^#[0-9a-f]{6}$/i.test(entry[1]||""));
  if(!recipe&&!colors.length)return null;
  const family=recipe?designFamilies[recipe.family]:null;
  const style={"--direction-bg":palette.background||family?.background||"#eef2f7","--direction-surface":palette.surface||family?.surface||"#ffffff","--direction-ink":palette.ink||family?.ink||"#172b46","--direction-accent":palette.accent||family?.accent||"#3769b2","--direction-radius":recipe?.radius==="rounded"?"16px":recipe?.radius==="square"?"2px":"8px"} as CSSProperties;
  return <figure className="factory-plan-visual" aria-label="Planned visual direction">
    <figcaption><strong>Visual direction</strong><span>{recipe?"An outline of your proposed style. The finished website takes shape after approval.":"Colors recorded in this plan."}</span></figcaption>
    {recipe?<><div className={`factory-direction-sketch is-${recipe.composition} type-${recipe.fontTheme} density-${recipe.density}`} style={style} aria-hidden="true"><div className="factory-direction-nav"><i/><span/><span/><b/></div><div className="factory-direction-hero"><div className="factory-direction-copy"><i/><strong>A clear first<br/>impression.</strong><span/><span/><b/></div><div className="factory-direction-image"><i/></div></div><div className="factory-direction-sections"><span/><span/><span/></div></div><ul className="factory-direction-choices"><li>{openings[recipe.composition]}</li><li>{typeLabels[recipe.fontTheme]}</li><li>{recipe.density==="compact"?"Compact spacing":recipe.density==="airy"?"Generous spacing":"Balanced spacing"}</li><li>{recipe.radius==="square"?"Crisp corners":recipe.radius==="rounded"?"Rounded details":"Soft corners"}</li></ul></>:null}
    {colors.length?<ul className="factory-direction-swatches" aria-label="Planned colors">{colors.map(([role,color])=><li key={role}><i style={{backgroundColor:color}} aria-hidden="true"/><span>{paletteLabels[role]}<small>{color.toUpperCase()}</small></span></li>)}</ul>:null}
  </figure>;
}
