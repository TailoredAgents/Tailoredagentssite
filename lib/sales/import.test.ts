import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  parseProspectCsv,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
} from "./import";
import { importFingerprint } from "./import-fingerprint";

describe("prospect CSV import", () => {
  it("reads BOM, quoted commas, escaped quotes, CRLF and multiline research without losing row locations", () => {
    const parsed = parseProspectCsv(
      '\uFEFFCompany,Phone,Notes,Website Status,Score\r\n"Example, Inc.",(212) 555-0123,"Said ""call tomorrow""\r\nNeeds booking",No website,87.5\r\nSecond Company,2125550124,Ready,Outdated,0',
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 2,
      businessName: "Example, Inc.",
      phone: "+12125550123",
      notes: 'Said "call tomorrow"\nNeeds booking',
      websiteStatus: "none",
      score: 87.5,
    });
    expect(parsed.rows[1]).toMatchObject({
      rowNumber: 4,
      score: 0,
      websiteStatus: "needs_redesign",
    });
    expect(parsed.mapping).toContainEqual({
      header: "Company",
      field: "businessName",
    });
  });

  it("recognizes the actual calling export headers using synthetic businesses", () => {
    const header =
      '"Dialer Lead Name","First Name","Last Name","Phone Number 1","Company Name","Address","City","State","Zip","Email","Vendor Contact ID","Comments","Website","Priority Tier","Score","Geographic Cohort","Call Order"';
    const row =
      "Synthetic Label,Avery,Example,2125550100,Synthetic Test Studio,123 Example St,Testville,NY,00000,OWNER@EXAMPLE.TEST,external-123,Interested,https://example.test,A,92,Test Cohort,1";
    const parsed = parseProspectCsv(`${header}\n${row}`);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      businessName: "Synthetic Test Studio",
      contactName: "Avery Example",
      phone: "+12125550100",
      email: "owner@example.test",
      city: "Testville",
      state: "NY",
      externalId: "external-123",
      score: 92,
    });
    expect(parsed.rows[0].notes).toContain("Geographic Cohort: Test Cohort");
    expect(parsed.rows[0].notes).toContain("Address: 123 Example St");
    expect(parsed.unmappedHeaders).toContain("Priority Tier");
  });

  it("keeps research, optional location and source data, and unfamiliar website labels", () => {
    const parsed = parseProspectCsv(
      "Business Name,Phone,Industry,State,City,Source URL,Facebook URL,Source List,Website Status,Opportunity Note\nTest Studio,2125550123,Salon,NY,Testville,maps.example.test/test,facebook.com/test,October List,Social only,Needs booking",
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      industry: "Salon",
      researchUrl: "https://maps.example.test/test",
      facebookUrl: "https://facebook.com/test",
      sourceList: "October List",
      websiteStatus: "unknown",
    });
    expect(parsed.rows[0].notes).toContain("Website Status: Social only");
    expect(parsed.rows[0].notes).toContain("Opportunity Note: Needs booking");
  });

  it("interprets Name as company only when no separate company is present", () => {
    expect(
      parseProspectCsv("Name,Phone\nTest Business,2125550123").rows[0]
        .businessName,
    ).toBe("Test Business");
    expect(
      parseProspectCsv(
        "Company,Name,Phone\nTest Business,Avery Example,2125550123",
      ).rows[0].contactName,
    ).toBe("Avery Example");
  });

  it.each([
    ["Email", "broken@address", "Invalid email"],
    ["Email", "hello..again@example.test", "Invalid email"],
    ["Website", "javascript:alert(1)", "Invalid website"],
    ["Website", "https://user:password@example.test", "Invalid website"],
    ["Source URL", "file:///secret.txt", "Invalid research"],
    ["Facebook URL", "not a URL", "Invalid Facebook"],
    ["Score", "101", "Score must"],
    ["Score", "NaN", "Score must"],
    ["Score", "-1", "Score must"],
    ["Phone", "12345", "Invalid phone"],
  ])(
    "excludes rows with invalid %s values instead of importing partial identities",
    (header, value, message) => {
      const parsed = parseProspectCsv(
        `Company,${header}${header === "Phone" ? "" : ",Phone"}\nTest Business,${value}${header === "Phone" ? "" : ",2125550123"}`,
      );
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.errors[0].message).toContain(message);
    },
  );

  it("requires a real business identity and reports every invalid row", () => {
    const parsed = parseProspectCsv(
      "Company,Phone\nName Alone,\n,2125550123\nValid Test Business,2125550124",
    );
    expect(parsed.errors.map((error) => error.row)).toEqual([2, 3]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].rowNumber).toBe(4);
  });

  it.each([
    ['Company,Phone\n"Unclosed,2125550123', "Unclosed quoted"],
    ['Company,Phone\nBad"Quote,2125550123', "Unexpected quote"],
    ['Company,Phone\n"Closed"bad,2125550123', "Unexpected text"],
    ["Company,Phone\nTest Business,2125550123,extra", "Expected 2 columns"],
    ["Company,company,Phone\nA,B,2125550123", "headers must be unique"],
    ["Company,,Phone\nA,B,2125550123", "needs a header"],
    ["Company,Phone", "no data rows"],
    ["", "CSV is empty"],
  ])("rejects malformed CSV structure", (csv, message) => {
    const parsed = parseProspectCsv(csv);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0].message).toContain(message);
  });

  it("bounds bytes, columns, rows, fields and combined research notes", () => {
    expect(
      parseProspectCsv("é".repeat(1024 * 1024 + 1)).errors[0].message,
    ).toContain("2 MB");
    expect(
      parseProspectCsv(
        Array.from({ length: 81 }, (_, index) => `column${index}`).join(","),
      ).errors[0].message,
    ).toContain("80 columns");
    expect(
      parseProspectCsv(
        `Company,Phone\n${Array.from({ length: 5001 }, () => "Test,2125550123").join("\n")}`,
      ).errors[0].message,
    ).toContain("5000 data rows");
    expect(
      parseProspectCsv(
        `Company,Phone,Notes\nTest,2125550123,${"a".repeat(20001)}`,
      ).errors[0].message,
    ).toContain("20000 characters");
    expect(
      parseProspectCsv(
        `Company,Phone,Notes,Other\nTest,2125550123,${"a".repeat(12000)},${"b".repeat(12000)}`,
      ).errors[0].message,
    ).toContain("Combined research notes");
  });

  it("keeps independent rows independent even when identities overlap", () => {
    const parsed = parseProspectCsv(
      "Company,Phone\nAlpha Test,2125550123\nBeta Test,2125550123",
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.map((row) => row.businessName)).toEqual([
      "Alpha Test",
      "Beta Test",
    ]);
  });
});

describe("BatchDialer result parsing", () => {
  it("accepts phone-only outcomes with an external identity and a timezone-aware call date", () => {
    const parsed = parseProspectCsv(
      "Phone,Disposition,Lead ID,Last Call Date\n2125550123,Interested,test-call-1,2026-10-21T14:30:00-04:00",
      { mode: "dialer" },
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      businessName: "",
      phone: "+12125550123",
      outcome: "Interested",
      externalId: "test-call-1",
      occurredAt: "2026-10-21T18:30:00.000Z",
    });
  });

  it("accepts email-based results and preserves DNC/STOP outcomes without suggesting consent", () => {
    const parsed = parseProspectCsv(
      "Email,Call Result,Call ID\nOWNER@example.test,DNC,call-1\nowner@example.test,STOP,call-2",
      { mode: "dialer" },
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.map((row) => row.outcome)).toEqual(["DNC", "STOP"]);
  });

  it("requires outcome and sufficient identity for repeated result imports", () => {
    const missingIdentity = parseProspectCsv(
      "Phone,Call Result\n2125550123,Interested",
      { mode: "dialer" },
    );
    expect(missingIdentity.errors[0].message).toContain(
      "prevent duplicate activity",
    );
    expect(
      parseProspectCsv("Phone,Call ID\n2125550123,call1", { mode: "dialer" })
        .errors[0].message,
    ).toContain("Disposition/Call Result");
    const invalid = parseProspectCsv(
      "Phone,Call Result,Call ID\n,Interested,call-1\n2125550123,,call-2",
      { mode: "dialer" },
    );
    expect(invalid.errors).toHaveLength(2);
  });

  it("accepts valid calendar dates but rejects rolled dates and timezone guesses", () => {
    const valid = parseProspectCsv(
      "Phone,Outcome,Last Call Date\n2125550123,No answer,2026-10-21",
      { mode: "dialer" },
    );
    expect(valid.errors).toEqual([]);
    expect(valid.rows[0].occurredAt).toBe("2026-10-21T00:00:00.000Z");
    for (const date of [
      "2026-02-30",
      "2026-02-30T12:00:00Z",
      "2026-10-21T24:00Z",
      "2026-10-21 14:30",
      "10/21/2026 2:30 PM",
    ]) {
      const parsed = parseProspectCsv(
        `Phone,Outcome,Last Call Date\n2125550123,No answer,${date}`,
        { mode: "dialer" },
      );
      expect(parsed.rows).toEqual([]);
      expect(parsed.errors[0].message).toContain("ISO timestamp with timezone");
    }
  });
});

describe("conservative identity normalization", () => {
  it("normalizes presentation without fuzzy merging people or unrelated businesses", () => {
    expect(normalizeEmail("  Avery+sales@EXAMPLE.TEST ")).toBe(
      "avery+sales@example.test",
    );
    expect(normalizeEmail("avery@example.test")).not.toBe(
      normalizeEmail("avery+sales@example.test"),
    );
    expect(normalizePhone("(212) 555-0123 ext. 42")).toBe("+12125550123");
    expect(normalizePhone("1-212-555-0123")).toBe("+12125550123");
    expect(normalizePhone("+44 20 7946 0123")).toBe("+442079460123");
    expect(normalizePhone("020 7946 0123")).toBeNull();
    expect(normalizePhone("+012345678")).toBeNull();
    expect(normalizeDomain("https://WWW.Example.test/path?a=1")).toBe(
      "example.test",
    );
    expect(normalizeDomain("branch.example.test")).toBe("branch.example.test");
    expect(normalizeDomain("http://localhost/private")).toBeNull();
    expect(normalizeDomain("javascript:alert(1)")).toBeNull();
  });

  it("fingerprints complete files consistently without confusing changed results", () => {
    expect(importFingerprint("\uFEFFCompany,Phone\r\nTest,2125550123")).toBe(
      importFingerprint("Company,Phone\nTest,2125550123"),
    );
    expect(importFingerprint("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
    expect(importFingerprint("Interested")).not.toBe(importFingerprint("DNC"));
  });
});
