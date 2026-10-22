type Environment = Partial<Record<"VOICE_BROWSER_TEST_SDK" | "DATABASE_URL" | "NODE_ENV", string>>;

/** A browser SDK fixture can only be selected in the named disposable local dev suite. */
export function voiceBrowserFixture(environment: Environment = process.env) {
  if (environment.VOICE_BROWSER_TEST_SDK !== "true") return false;
  let database: URL;
  try { database = new URL(environment.DATABASE_URL || ""); } catch { throw new Error("Voice SDK fixture requires its isolated local database."); }
  if (environment.NODE_ENV !== "development" || !["postgres:", "postgresql:"].includes(database.protocol) || !["127.0.0.1", "localhost"].includes(database.hostname) || database.port !== "55433" || database.pathname !== "/ta_voice_browser_test" || database.search || database.hash)
    throw new Error("Voice SDK fixture is restricted to the disposable local development suite.");
  return true;
}

// Next's development React runtime needs eval for debugging. Production keeps
// the stricter policy; both public and dashboard policies use the same switch.
export function browserScriptSources(development = process.env.NODE_ENV === "development") {
  return `'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`;
}

export function voiceDashboardHeaders(fixture = false) {
  // The SDK is bundled locally. These are Twilio's documented default-roaming
  // signaling, insights and sound hosts; public pages retain the original CSP.
  const hosts = "https://media.twiliocdn.com https://sdk.twilio.com";
  return [
    { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
    { key: "Content-Security-Policy", value: `default-src 'self'; script-src ${browserScriptSources()} ${hosts}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://eventgw.twilio.com wss://voice-js.roaming.twilio.com ${hosts}${fixture ? " http://127.0.0.1:3161" : ""}; media-src 'self' blob: mediastream: ${hosts}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests` },
  ];
}
