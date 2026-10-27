import { z } from "zod";
import { designFamilies } from "./site/families";
import { designFamilyIds, fontThemes, heroCompositions } from "./site/types";
import type { FactoryDesignRecipe } from "./types";

export const factoryDesignRecipeSchema = z.object({
  version: z.literal(1),
  family: z.enum(designFamilyIds),
  composition: z.enum(heroCompositions),
  fontTheme: z.enum(fontThemes),
  density: z.enum(["compact", "balanced", "airy"]),
  radius: z.enum(["square", "soft", "rounded"]),
}).strict();

/** Use the renderer's real family map, not a second independently drifting list. */
export function assertFactoryDesignRecipe(recipe: FactoryDesignRecipe) {
  factoryDesignRecipeSchema.parse(recipe);
  if (!designFamilies[recipe.family].compositions.includes(recipe.composition)) {
    throw new Error("The proposed design uses a homepage composition that its design family does not support.");
  }
}

/** Serializable context for both planning and generation; no provider or UI dependencies. */
export const factoryDesignCapabilities = {
  families: Object.fromEntries(Object.entries(designFamilies).map(([id, family]) => [id, {
    label: family.name, compositions: family.compositions,
  }])),
  fontThemes: {
    studio: "Refined sans headings and body; emphasis remains sans.",
    technical: "Geometric sans headings with readable sans body.",
    editorial: "Editorial serif headings with readable sans body.",
    warm: "Soft serif headings with readable sans body.",
  },
  density: { compact: "Close, focused section rhythm", balanced: "Moderate section rhythm", airy: "Generous section rhythm where content supports it" },
  radius: { square: "Near-square corners", soft: "Gently softened corners", rounded: "Pronounced rounded corners" },
  innerIntroductions: "Compact and text-only unless an approved, purposeful inner image is placed explicitly.",
};
