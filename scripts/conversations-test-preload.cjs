// Guarded test-process transport. Never imported by the production application.
const database = new URL(process.env.DATABASE_URL || "");
if (!["postgres:","postgresql:"].includes(database.protocol) || !["127.0.0.1","localhost"].includes(database.hostname) || database.pathname !== "/ta_conversations_browser_test" || database.search || database.hash)
  throw new Error("Conversation transport requires the exact disposable local database.");
require("twilio").RequestClient.prototype.request = async function(options) {
  if (!options.uri.startsWith("https://api.twilio.com/2010-04-01/Accounts/")) throw new Error("Unexpected fixture transport target.");
  const response = await fetch("http://127.0.0.1:3151/transport",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer conversations-synthetic-control"},body:JSON.stringify({uri:options.uri,method:options.method,data:options.data,params:options.params})});
  if (!response.ok) throw new Error("Synthetic transport unavailable.");
  return await response.json();
};
