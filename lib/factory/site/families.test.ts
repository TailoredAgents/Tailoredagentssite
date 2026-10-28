import {describe,expect,it} from "vitest";
import {familyForPlan,familyHintForPlan} from "./families";
import {fixtureSitePlan} from "./fixtures";

describe("Industry suggestions without substring or candidate contamination",()=>{
  it.each([
    ["A proof of concept for a new business","general"],
    ["Lawn care and mowing service","trades"],
    ["Workspace software consulting","professional"],
    ["Aerospace consulting","professional"],
    ["Account signup for a new business website","general"],
    ["Spa and massage studio","wellness"],
    ["Independent landscape contractors","trades"],
    ["A tax accountant serving landscaping contractors","general"],
    ["Website redesign for a bakery","hospitality"],
    ["Professional HVAC services","trades"],
    ["Professional lawn care","trades"],
    ["Professional massage studio","wellness"],
    ["Professional photography","editorial"],
    ["Professional services firm","professional"],
  ])("classifies %s only as a hint",(text,expected)=>expect(familyForPlan(text)).toBe(expected));
  it("ignores candidate matches and assumptions when suggesting a family",()=>{
    const plan={...fixtureSitePlan,goal:"A first website",audience:"Future visitors",knownDetails:[
      {label:"Candidate spa",value:"Possibly a massage spa",basis:"possible_match" as const,sourceIds:["source-1"]},
      {label:"Assumed trade",value:"Maybe roofing",basis:"assumption" as const,sourceIds:[]},
    ]};
    expect(familyHintForPlan(plan)).toBe("general");
    expect(familyHintForPlan({...plan,knownDetails:[...plan.knownDetails,{label:"Industry",value:"Accounting",basis:"submitted",sourceIds:[]}]})).toBe("professional");
  });
  it("prefers an explicit eligible business type over its customer's industry",()=>{
    expect(familyHintForPlan({...fixtureSitePlan,goal:"Serve landscaping contractors",audience:"Roofing companies",knownDetails:[{label:"Business type",value:"Tax accounting",basis:"sourced",sourceIds:["source-1"]}]})).toBe("professional");
  });
});
