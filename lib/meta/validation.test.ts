import { leadDisplayName, leadCompanyName, leadBusinessName } from "@/lib/operations/format";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { boundedBody, mapMetaLead, signedMetaBody } from "./validation";

describe("Meta payload boundaries", () => {
  it("verifies the exact bytes and rejects altered or malformed signatures", () => {
    const body = Buffer.from('{"entry":[]}');
    const signature = `sha256=${createHmac("sha256", "fixture").update(body).digest("hex")}`;
    expect(signedMetaBody(body, signature, "fixture")).toBe(true);
    expect(
      signedMetaBody(Buffer.from('{ "entry":[]}'), signature, "fixture"),
    ).toBe(false);
    for (const value of [null, "", "sha256=abc", "sha1=" + "a".repeat(64)])
      expect(signedMetaBody(body, value, "fixture")).toBe(false);
  });
  it("rejects oversized streamed requests even without content-length", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(20));
        controller.close();
      },
    });
    await expect(boundedBody(body, 10)).rejects.toThrow("body_too_large");
  });
  it("maps a phone-only Instagram lead without inventing an email or business", () => {
    const lead = mapMetaLead({
      id: "111111",
      form_id: "222222",
      created_time: "2026-10-23T16:00:00Z",
      platform: "instagram",
      field_data: [
        { name: "full_name", values: ["Example Person"] },
        { name: "phone_number", values: ["(678) 555-0101"] },
        { name: "your_goal", values: ["Improve my website"] },
      ],
    });
    expect(lead).toMatchObject({
      name: "Example Person",
      organization: "",
      email: null,
      phone: "+16785550101",
      context: { platform: "instagram" },
    });
    expect(lead.description).toContain("your goal: Improve my website");
  });
  it.each(["None", " NONE ", "N/A", "n.a.", "Not applicable", "No company", "Not yet", "—"])("keeps a person's identity when the company answer is %s", company => {
    const lead=mapMetaLead({id:"111111",form_id:"222222",created_time:"2026-10-23T16:00:00Z",field_data:[{name:"full_name",values:["Jordan Smith"]},{name:"company_name",values:[company]}]});
    expect(lead.organization).toBe("");
    expect(leadDisplayName({...lead,organization:company})).toBe("Jordan Smith");
    expect(leadCompanyName({...lead,organization:company})).toBe("");
    expect(lead.description).toContain(company);
  });
  it("shows a real business second but preserves it for business conversion", () => {
    const lead={name:"Jordan Smith",organization:"None Such Studio"};
    expect(leadDisplayName(lead)).toBe("Jordan Smith");
    expect(leadCompanyName(lead)).toBe("None Such Studio");
    expect(leadBusinessName(lead)).toBe("None Such Studio");
  });
  it("retains malformed contact answers as context without turning them into links", () => {
    const lead = mapMetaLead({
      id: "111111",
      form_id: "222222",
      created_time: "2026-10-23T16:00:00Z",
      field_data: [
        { name: "email", values: ["not an email"] },
        { name: "phone_number", values: ["javascript:alert(1)"] },
      ],
    });
    expect(lead.email).toBeNull();
    expect(lead.phone).toBeNull();
    expect(lead.description).toContain("not an email");
  });
});
