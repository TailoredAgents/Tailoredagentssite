import { describe,it,expect } from "vitest";
import { usageCost, modelCost } from "./config";
describe("SEO standard pricing and cache accounting",()=>{
  it("counts ordinary input, cache reads, both write lifetimes and output once",()=>{
    expect(usageCost("gpt-6.1-sol",{input_tokens:12000,output_tokens:1000,input_tokens_details:{cached_tokens:4000,cache_write_tokens:7000,cache_write_tokens_details:{ttl_30m_tokens:3000,ttl_12h_tokens:4000}}})).toBe(39900);
  });
  it("conservatively reserves all possible short cache writes",()=>{
    expect(modelCost("gpt-6.1-sol",108192,8000)*10).toBe(3504800);
    expect(usageCost("gpt-6.1-sol",{input_tokens:100,output_tokens:100})).toBe(1250);
  });
  it("rejects overlapping or contradictory provider usage",()=>{
    expect(()=>usageCost("gpt-6.1-sol",{input_tokens:100,output_tokens:1,input_tokens_details:{cached_tokens:80,cache_write_tokens:30}})).toThrow();
  });
});
