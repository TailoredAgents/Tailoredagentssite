// Loaded only into the local Next test process. Fail closed for other databases.
const database = new URL(process.env.DATABASE_URL || "");
if (!["postgres:","postgresql:"].includes(database.protocol) || !["127.0.0.1","localhost"].includes(database.hostname) || database.port !== "55433" || database.pathname !== "/ta_voice_browser_test" || database.search || database.hash)
  throw new Error("Voice transport requires the exact disposable local database.");
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, options) {
  const target = String(input instanceof Request ? input.url : input);
  if (target.startsWith("https://api.twilio.com/")) {
    if (!/^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/AC1{32}\/Recordings\/RE[0-9a-f]{32}\.mp3$/i.test(target)) throw new Error("Unexpected synthetic media target");
    return originalFetch("http://127.0.0.1:3161/media", { method:"POST", headers:{"content-type":"application/json",authorization:"Bearer voice-synthetic-control"}, body:JSON.stringify({uri:target,range:new Headers(options?.headers).get("range")}) });
  }
  return originalFetch(input, options);
};
require("twilio").RequestClient.prototype.request = async function(options) {
  if (!options.uri.startsWith("https://api.twilio.com/2010-04-01/Accounts/")) throw new Error("Unexpected fixture transport target.");
  const response = await originalFetch("http://127.0.0.1:3161/transport",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer voice-synthetic-control"},body:JSON.stringify({uri:options.uri,method:options.method,data:options.data,params:options.params})});
  if (!response.ok) throw new Error("Synthetic transport unavailable.");
  return response.json();
};
