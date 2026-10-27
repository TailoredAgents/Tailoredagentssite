import {describe,it,expect} from "vitest";
import {familyForPlan} from "./families";
import {fixtureBlueprint,fixtureSitePlan} from "./fixtures";
import {actionDestinationIssue,publicSiteCopy,reviewSiteDepth} from "./quality";

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
  it.each(["Contact","Service Areas"])("accepts purposeful %s form pages without forcing unrelated sales sections",title=>{
    const b=fixtureBlueprint("trades","split",true),plan=structuredClone(fixtureSitePlan);
    const path=title==="Contact"?"contact/index.html":"service-areas/index.html";
    plan.pages.push({title,purpose:"Prepare an inquiry",sections:["Inquiry form","Direct contact"]});
    b.pages.push({...structuredClone(b.pages[1]),path,title,sections:[
      {id:"inquiry",kind:"contact",layout:"split",eyebrow:"Inquiry",title:"Prepare a message",body:"Share your city or ZIP code and describe the concern you would like to discuss with the team.",items:[]},
      {id:"direct",kind:"contact",layout:"band",eyebrow:"Next step",title:"Talk to the team",body:"Use the direct contact options to discuss coverage and possible next steps before making any arrangements.",items:[]},
    ]});
    b.interactions!.forms.push({pagePath:path,sectionId:"inquiry",fields:["location","message"],submitLabel:"Preview inquiry"});
    expect(reviewSiteDepth(b,plan).filter(i=>i.page===path)).toEqual([]);
    b.interactions!.forms=[];
    expect(reviewSiteDepth(b,plan).some(i=>i.page===path&&i.code==="thin_page")).toBe(true);
    b.interactions!.forms.push({pagePath:path,sectionId:"inquiry",fields:["message"],submitLabel:"Preview inquiry"});
    b.pages.at(-1)!.sections[1].body="Call us.";
    expect(reviewSiteDepth(b,plan).some(i=>i.page===path&&i.code==="thin_page")).toBe(false);
    b.pages.at(-1)!.title="Services";b.pages.at(-1)!.path="services-extra/index.html";
    b.interactions!.forms[0].pagePath="services-extra/index.html";
    expect(reviewSiteDepth(b,plan).some(i=>i.page==="services-extra/index.html"&&i.code==="thin_page")).toBe(true);
  });
  it("accepts useful concise pages rather than enforcing section or layout quotas",()=>{
    const b=fixtureBlueprint("trades","split",true);b.pages[0].sections=b.pages[0].sections.slice(0,2);b.pages[2].sections=b.pages[2].sections.slice(0,1);
    for(const section of b.pages[0].sections)section.layout="rows";
    expect(reviewSiteDepth(b,fixtureSitePlan).filter(i=>i.code==="thin_page"||i.code==="repeated_layout")).toEqual([]);
  });
  it("checks direct action promises without confusing a scheduling invitation for a dialer",()=>{
    expect(actionDestinationIssue("Call Cosmo’s","services/index.html#cooling")).toContain("must dial");
    expect(actionDestinationIssue("Call our team","tel:+17025550199")).toBeNull();
    expect(actionDestinationIssue("Schedule a call","contact/index.html")).toBeNull();
    expect(actionDestinationIssue("Callback request","contact/index.html")).toBeNull();
    expect(actionDestinationIssue("Email Cosmo’s","#inquiry")).toContain("email address");
    expect(actionDestinationIssue("Email our team","mailto:team@example.test")).toBeNull();
  });
  it("rejects substituted pages even when the total page count is correct",()=>{
    const blueprint=fixtureBlueprint("trades","split",true);
    blueprint.pages[2].title="Careers";blueprint.pages[2].path="careers/index.html";
    expect(reviewSiteDepth(blueprint,fixtureSitePlan)).toEqual(expect.arrayContaining([expect.objectContaining({code:"missing_planned_pages",message:expect.stringContaining("Services")})]));
  });
  it("accepts familiar title aliases and planned identities retained in paths",()=>{
    const blueprint=fixtureBlueprint("trades","split",true);
    blueprint.pages[0].title="Welcome";
    blueprint.pages[1].title="About us";blueprint.pages[1].path="about/index.html";
    blueprint.pages[2].title="Explore your options";
    expect(reviewSiteDepth(blueprint,fixtureSitePlan).filter(issue=>issue.code==="missing_planned_pages")).toEqual([]);
  });
  it("does not use one alias page to satisfy two approved pages",()=>{
    const blueprint=fixtureBlueprint("trades","split",true),plan=structuredClone(fixtureSitePlan);
    plan.pages.push({title:"About",purpose:"Company story",sections:["Story"]});
    expect(reviewSiteDepth(blueprint,plan).some(issue=>issue.code==="missing_planned_pages")).toBe(true);
    blueprint.pages.push({...structuredClone(blueprint.pages[1]),title:"About",path:"about/index.html"});
    expect(reviewSiteDepth(blueprint,plan).some(issue=>issue.code==="missing_planned_pages")).toBe(false);
  });
  it("does not confuse different service detail pages",()=>{
    const blueprint=fixtureBlueprint("trades","split",true),plan=structuredClone(fixtureSitePlan);
    plan.pages[2].title="Heating repair";
    blueprint.pages[2].title="Cooling installation";blueprint.pages[2].path="cooling-installation/index.html";
    expect(reviewSiteDepth(blueprint,plan).some(issue=>issue.code==="missing_planned_pages")).toBe(true);
  });
  it("detects copied bodies with new headings and small wording changes",()=>{
    const blueprint=fixtureBlueprint("trades","split",true);
    blueprint.pages[1].sections=structuredClone(blueprint.pages[0].sections).map(section=>({...section,id:`new-${section.id}`,title:`A different headline about ${section.id}`,body:section.body.replace(/clear/gi,"thoughtful")}));
    expect(reviewSiteDepth(blueprint,fixtureSitePlan).filter(issue=>issue.code==="repeated_page")).toEqual(expect.arrayContaining([expect.objectContaining({page:"approach/index.html"})]));
  });
  it("allows shared contact invitations on otherwise distinct pages",()=>{
    const blueprint=fixtureBlueprint("trades","split",true);
    for(const page of blueprint.pages)page.sections.push({id:"invitation",kind:"statement",layout:"band",eyebrow:"Next step",title:"Get in touch",body:"Contact us to discuss your plans and find a useful direction for the next step.",items:[]});
    expect(reviewSiteDepth(blueprint,fixtureSitePlan).filter(issue=>issue.code==="repeated_page")).toEqual([]);
  });
  it.each([
    "Licensed and insured specialists.","More than 20 years of experience.","Rated 4.9 stars by our customers.",
    "Trusted by 500 customers.","Plans start at $99.","Save 25% on installation.","Established in 2005.","Available 24/7.",
  ])("finds unsupported claims in public copy even with an empty factualClaims list: %s",claim=>{
    const blueprint=fixtureBlueprint();blueprint.pages[0].hero.body=claim;
    expect(blueprint.factualClaims).toEqual([]);
    expect(reviewSiteDepth(blueprint,fixtureSitePlan).some(issue=>issue.code==="unsupported_concrete_claim")).toBe(true);
  });
  it("accepts submitted evidence and common experience/date paraphrases",()=>{
    const blueprint=fixtureBlueprint(),plan=structuredClone(fixtureSitePlan);
    blueprint.pages[0].hero.body="Licensed and insured. 20 years in business. Serving since 2005. 4.9-star rated. Prices from $99.";
    plan.knownDetails=[{label:"Business details",value:"Licensed and insured. 20 years of experience. Founded in 2005. Rated 4.9 stars. Prices from $99.",basis:"submitted",sourceIds:[]}];
    expect(reviewSiteDepth(blueprint,plan).filter(issue=>issue.code==="unsupported_concrete_claim")).toEqual([]);
  });
  it("does not accept possible matches or unconfirmed claims as evidence",()=>{
    const blueprint=fixtureBlueprint(),plan=structuredClone(fixtureSitePlan);
    blueprint.pages[0].hero.body="Licensed specialists. Serving since 2005.";
    plan.knownDetails=[{label:"Possible company",value:"Serving since 2005.",basis:"possible_match",sourceIds:[]},{label:"Credentials",value:"Licensed status unconfirmed.",basis:"submitted",sourceIds:[]}];
    const issue=reviewSiteDepth(blueprint,plan).find(issue=>issue.code==="unsupported_concrete_claim");
    expect(issue?.message).toContain("Licensed");expect(issue?.message).toContain("since 2005");
  });
  it("does not treat a matching customer count as evidence for a price",()=>{
    const blueprint=fixtureBlueprint(),plan=structuredClone(fixtureSitePlan);
    blueprint.pages[0].hero.body="Plans from $99.";
    plan.knownDetails=[{label:"Customers",value:"99 customers.",basis:"sourced",sourceIds:["one"]}];
    expect(reviewSiteDepth(blueprint,plan).some(issue=>issue.code==="unsupported_concrete_claim")).toBe(true);
  });
  it("does not block useful concepts, questions, explicit examples or ordinary numbered steps",()=>{
    const blueprint=fixtureBlueprint();
    blueprint.pages[0].hero.body="Explore heating and cooling options. Start with 3 easy steps. Ask whether the team is licensed. Are estimates available for $99? Example pricing: $99. Hours remain unconfirmed.";
    expect(reviewSiteDepth(blueprint,fixtureSitePlan).filter(issue=>issue.code==="unsupported_concrete_claim")).toEqual([]);
  });
  it("includes metadata, image copy, item titles and contact details in public-copy review",()=>{
    const blueprint=fixtureBlueprint();blueprint.pages[0].description="Licensed professionals.";blueprint.heroImage.caption="Our 500 completed projects.";blueprint.pages[0].sections[0].items[0].title="Certified specialists";blueprint.contact.email="test@example.com";
    const copy=publicSiteCopy(blueprint)[0];
    expect(copy.page).toBe("index.html");expect(copy.text).toContain("Licensed professionals.");expect(copy.text).toContain("Our 500 completed projects.");expect(copy.text).toContain("Certified specialists");expect(copy.text).toContain("test@example.com");
    expect(reviewSiteDepth(blueprint,fixtureSitePlan).find(issue=>issue.code==="unsupported_concrete_claim")?.message).toContain("Certified");
  });
});
