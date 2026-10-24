const url = new URL(process.env.DATABASE_URL || "");
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55433" ||
  url.pathname !== "/ta_seo_browser_test" ||
  url.search ||
  url.hash ||
  process.env.SEO_OPENAI_API_KEY !== "seo-synthetic-no-live-key"
)
  throw new Error("SEO transport requires exact local fixture configuration.");
const https = require("node:https"),
  http = require("node:http"),
  dns = require("node:dns/promises"),
  { syncBuiltinESMExports } = require("node:module");
const originalRequest = https.request,
  originalLookup = dns.lookup,
  originalFetch = globalThis.fetch;
dns.lookup = async function (host, ...args) {
  if (host === "www.tailoredagents.com")
    return [{ address: "93.184.216.34", family: 4 }];
  return originalLookup.call(this, host, ...args);
};
https.request = function (input, options, callback) {
  const target = new URL(String(input));
  if (target.origin === "https://www.tailoredagents.com")
    return http.request(
      `http://127.0.0.1:3170${target.pathname}`,
      { method: "GET", headers: options.headers },
      callback,
    );
  return originalRequest.call(this, input, options, callback);
};
globalThis.fetch = async function (input, options) {
  const target = String(input instanceof Request ? input.url : input);
  if (target === "https://api.openai.com/v1/responses")
    return originalFetch("http://127.0.0.1:3171/openai", {
      method: "POST",
      headers: {
        authorization: "Bearer seo-synthetic-control",
        "content-type": "application/json",
      },
      body: options.body,
    });
  if (target.startsWith("https://api.dataforseo.com/v3/serp/google/organic/"))
    return originalFetch("http://127.0.0.1:3171/research", {
      method: "POST",
      headers: {
        authorization: "Bearer seo-synthetic-control",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        path: new URL(target).pathname,
        body: options.body || null,
      }),
    });
  return originalFetch(input, options);
};
syncBuiltinESMExports();
