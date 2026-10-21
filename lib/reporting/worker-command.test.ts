import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const endpoint = "https://www.tailoredagents.com/api/cron/search-console";
const command = pathToFileURL(resolve("scripts/trigger-search-console-sync.mjs")).href;
function run(url: string, responseStatus = 200) {
  return spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import assert from "node:assert/strict";
    globalThis.fetch = async (url, options) => {
      assert.equal(url, ${JSON.stringify(endpoint)});
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "manual");
      assert.equal(options.headers.Authorization, "Bearer " + process.env.SEARCH_CONSOLE_SYNC_SECRET);
      return new Response(JSON.stringify({ ok: true, more: false, checked: 0, failed: 0 }),
        { status: ${responseStatus}, headers: { "Content-Type": "application/json" } });
    };
    await import(${JSON.stringify(command)});
  `], {
    encoding: "utf8",
    timeout: 10_000,
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      SEARCH_CONSOLE_SYNC_URL: url,
      SEARCH_CONSOLE_SYNC_SECRET: "local-worker-test-secret-not-for-production",
    },
  });
}

describe("deployed reporting command", () => {
  it("posts to www directly and completes an idle worker check", () => {
    const result = run(endpoint);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Worker check 1: 0 date updates, 0 stopped imports.");
  });

  it("rejects an apex job URL before making a network request", () => {
    const result = run("https://tailoredagents.com/api/cron/search-console");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must call https://www.tailoredagents.com");
  });

  it("refuses redirects instead of forwarding the private job secret", () => {
    const result = run(endpoint, 301);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("redirects are refused");
    expect(result.stderr).not.toContain("local-worker-test-secret-not-for-production");
  });

  it("rejects fragments, query parameters, and the wrong endpoint", () => {
    for (const url of [endpoint + "#fragment", endpoint + "?test=1", endpoint + "/wrong"]) {
      expect(run(url).status).not.toBe(0);
    }
  });
});
