import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  initializePixel,
  metaPreference,
  pixelId,
  publicPixelPath,
  saveMetaPreference,
  trackMetaLead,
} from "./pixel";
const storage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  };
};
describe("Optional website Pixel", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456789");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ENABLED", "true");
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("location", {
      pathname: "/contact",
      hostname: "www.tailoredagents.com",
    });
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("sessionStorage", storage());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("stays off until configured and excludes private paths", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ENABLED", "false");
    expect(pixelId()).toBeNull();
    for (const path of [
      "/sign-in",
      "/dashboard",
      "/dashboard/leads/123",
      "/api/contact",
    ])
      expect(publicPixelPath(path)).toBe(false);
    expect(publicPixelPath("/websites")).toBe(true);
  });
  it("does not send a lead without a visitor choice", () => {
    initializePixel("123456789");
    trackMetaLead("a".repeat(64));
    expect(window.fbq?.queue.some((row) => row[2] === "Lead")).toBe(false);
  });
  it("initializes once with automatic events disabled and deduplicates success retries", () => {
    saveMetaPreference("accepted");
    initializePixel("123456789");
    initializePixel("123456789");
    trackMetaLead("a".repeat(64));
    trackMetaLead("a".repeat(64));
    expect(window.fbq?.queue.filter((row) => row[0] === "init")).toHaveLength(
      1,
    );
    expect(window.fbq?.queue.filter((row) => row[2] === "Lead")).toEqual([
      ["trackSingle", "123456789", "Lead", {}, { eventID: "a".repeat(64) }],
    ]);
    expect(window.fbq?.disablePushState).toBe(true);
    expect(window.fbq?.queue).toContainEqual([
      "set",
      "autoConfig",
      false,
      "123456789",
    ]);
  });
  it("honors GPC and withdrawal even with a previously accepted choice", () => {
    saveMetaPreference("accepted");
    initializePixel("123456789");
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    expect(metaPreference()).toBe("declined");
    trackMetaLead("a".repeat(64));
    expect(window.fbq?.queue.some((row) => row[2] === "Lead")).toBe(false);
    saveMetaPreference("declined");
    expect(window.fbq?.queue).toContainEqual(["consent", "revoke"]);
  });
});
