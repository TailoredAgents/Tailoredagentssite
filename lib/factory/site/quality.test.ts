import {describe,it,expect} from "vitest";
import {familyForPlan} from "./families";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import {reviewSiteDepth} from "./quality";

describe("Website design direction and content depth",()=>{
  it.each(["Cosmo's heating and air conditioning website redesign","New website for cooling and heat pump maintenance","Air conditioning installation"])("recognizes the trade in %s",text=>expect(familyForPlan(text)).toBe("trades"));
  it("does not confuse a website redesign with a creative industry",()=>{
    expect(familyForPlan("Website redesign for a new business")).toBe("general");
    expect(familyForPlan("A design studio website redesign")).toBe("editorial");
    expect(familyForPlan("Web design for a massage practice")).toBe("wellness");
  });
  it("flags omitted pages, sparse homepages and copied inner pages",()=>{
    const sparse=fixtureBlueprint();sparse.pages[0].sections=sparse.pages[0].sections.slice(0,1);
    expect(reviewSiteDepth(sparse,fixtureSitePlan).map(i=>i.code)).toEqual(expect.arrayContaining(["missing_planned_pages","thin_page"]));
    const duplicate=fixtureBlueprint("trades","split",true);
    duplicate.pages[1].sections=structuredClone(duplicate.pages[0].sections);
    expect(reviewSiteDepth(duplicate,fixtureSitePlan).some(i=>i.code==="repeated_page")).toBe(true);
  });
  it("accepts a complete concept with unknown business details",()=>{
    expect(reviewSiteDepth(fixtureBlueprint("trades","split",true),fixtureSitePlan)).toEqual([]);
  });
});
