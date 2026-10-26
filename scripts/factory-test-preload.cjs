const database = new URL(process.env.DATABASE_URL || "");
if (database.hostname !== "127.0.0.1" || database.port !== "55433" || database.pathname !== "/ta_factory_browser_test" || database.search || database.hash || process.env.FACTORY_OPENAI_API_KEY !== "factory-synthetic-no-live-key") {
  throw new Error("Factory transport requires the exact local browser fixture.");
}
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input, options) {
  const target = String(input instanceof Request ? input.url : input);
  if (target === "https://api.openai.com/v1/responses") return originalFetch("http://127.0.0.1:3181/openai", {
    method: "POST", headers: { authorization: "Bearer factory-synthetic-control", "content-type": "application/json" }, body: options.body, signal: options.signal,
  });
  return originalFetch(input, options);
};
