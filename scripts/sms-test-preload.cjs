// Test process only: intercept the SDK transport, never production application code.
const database = new URL(process.env.DATABASE_URL || "");
if (!["127.0.0.1", "localhost"].includes(database.hostname) || database.pathname !== "/ta_sms_browser_test" || database.search || database.hash)
  throw new Error("SMS transport fixture requires the exact disposable local browser database.");
const twilio = require("twilio");
twilio.RequestClient.prototype.request = async function (options) {
  if (!options.uri.startsWith("https://api.twilio.com/2010-04-01/Accounts/")) throw new Error("Unexpected SMS fixture transport target.");
  const response = await fetch("http://127.0.0.1:3141/transport", {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer sms-fixture-control" },
    body: JSON.stringify({ uri: options.uri, method: options.method, data: options.data, params: options.params }),
  });
  if (!response.ok) throw new Error("Synthetic SMS transport unavailable.");
  return await response.json();
};
