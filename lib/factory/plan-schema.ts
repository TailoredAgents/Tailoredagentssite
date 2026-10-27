import { z } from "zod";
import { factoryDesignRecipeSchema } from "./design-recipe";

const copy=z.string().trim().min(1);
const shortList=z.array(copy.max(1000)).max(16);

/** Pure saved-plan schema; no database, provider or configuration imports. */
export const factoryPlanSchema=z.object({
  summary:copy.max(2000),goal:copy.max(1000),audience:copy.max(1000),
  knownDetails:z.array(z.object({label:copy.max(150),value:copy.max(1200),basis:z.enum(["submitted","sourced","possible_match","assumption"]),sourceIds:z.array(copy.max(80)).max(8)}).strict()).max(24),
  uncertainties:shortList,assumptions:shortList,
  pages:z.array(z.object({title:copy.max(150),purpose:copy.max(1000),sections:z.array(copy.max(300)).max(12)}).strict()).min(1).max(10),
  callsToAction:z.array(copy.max(300)).max(8),
  design:z.object({direction:copy.max(1500),palette:z.array(copy.max(120)).max(8),typography:copy.max(700),imagery:copy.max(1200),recipe:factoryDesignRecipeSchema.nullable().optional()}).strict(),
  previewFeatures:shortList,productionIntegrations:shortList,
}).strict();

export const factoryPlanResponseSchema=z.object({
  changed:z.boolean(),reply:copy.max(6000),changeSummary:copy.max(2000),plan:factoryPlanSchema,
}).strict();

// New requests make every property explicit for strict structured output. Saved
// responses/plans without a recipe still parse without rewriting their approval.
export const factoryPlanGenerationSchema=factoryPlanResponseSchema.extend({
  plan:factoryPlanSchema.extend({design:factoryPlanSchema.shape.design.extend({recipe:factoryDesignRecipeSchema.nullable()})}),
});
