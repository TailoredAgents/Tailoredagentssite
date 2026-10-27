import { describe, expect, it } from "vitest";
import { z } from "zod";
import { factoryDesignCapabilities, assertFactoryDesignRecipe } from "./design-recipe";
import { factoryPlanGenerationSchema, factoryPlanSchema } from "./plan-schema";
import { applyApprovedDesign } from "./site/design";
import { designFamilies } from "./site/families";
import { fixtureBlueprint, fixtureSitePlan } from "./site/fixtures";
import { validateBlueprintStructure } from "./site/validate";
import type { FactoryDesignRecipe } from "./types";

describe("Approved renderer design contract",()=>{
  it("keeps legacy plans valid and requires an explicit recipe slot only in new provider requests",()=>{
    const {sources:_sources,...legacy}=fixtureSitePlan;
    expect(factoryPlanSchema.parse(legacy).design.recipe).toBeUndefined();
    const json=z.toJSONSchema(factoryPlanGenerationSchema,{target:"draft-7"}) as unknown as {properties:{plan:{properties:{design:{required:string[]}}}}};
    expect(json.properties.plan.properties.design.required).toContain("recipe");
    expect(factoryPlanGenerationSchema.parse({changed:false,reply:"Unchanged",changeSummary:"Question answered",plan:{...legacy,design:{...legacy.design,recipe:null}}}).plan.design.recipe).toBeNull();
  });
  it("derives available compositions directly from the renderer family map",()=>{
    for(const [family,definition] of Object.entries(designFamilies)){
      expect(factoryDesignCapabilities.families[family].compositions).toEqual(definition.compositions);
      for(const composition of definition.compositions){
        const recipe:FactoryDesignRecipe={version:1,family:family as FactoryDesignRecipe["family"],composition,fontTheme:"studio",density:"balanced",radius:"soft"};
        expect(()=>assertFactoryDesignRecipe(recipe)).not.toThrow();
        const blueprint=applyApprovedDesign(fixtureBlueprint(),{...fixtureSitePlan,design:{...fixtureSitePlan.design,recipe}});
        expect(blueprint.family).toBe(family);expect(blueprint.composition).toBe(composition);
        expect(()=>validateBlueprintStructure(blueprint)).not.toThrow();
      }
    }
  });
  it.each(["studio","technical","editorial","warm"] as const)("preserves approved %s typography and rhythm against generated defaults",fontTheme=>{
    const recipe:FactoryDesignRecipe={version:1,family:"professional",composition:"framed",fontTheme,density:"compact",radius:"square"};
    const original=fixtureBlueprint();original.design!.density="airy";original.design!.radius="rounded";
    const blueprint=applyApprovedDesign(original,{...fixtureSitePlan,design:{...fixtureSitePlan.design,typography:"Match the selected bundled theme",recipe}});
    expect(blueprint.family).toBe("professional");expect(blueprint.composition).toBe("framed");
    expect(blueprint.presentation?.fontTheme).toBe(fontTheme);
    expect(blueprint.design).toMatchObject({density:"compact",radius:"square",typography:{heading:fontTheme==="technical"?"geometric":["editorial","warm"].includes(fontTheme)?"editorial":"modern"}});
    expect(original.design!.density).toBe("airy");
  });
});
