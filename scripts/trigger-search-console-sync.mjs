const endpoint = process.env.SEARCH_CONSOLE_SYNC_URL?.trim();
const secret = process.env.SEARCH_CONSOLE_SYNC_SECRET?.trim();

if (!endpoint || !secret) {
  throw new Error("SEARCH_CONSOLE_SYNC_URL and SEARCH_CONSOLE_SYNC_SECRET are required.");
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(5 * 60 * 1000),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) {
  throw new Error(`Search Console sync failed with HTTP ${response.status}.`);
}
console.log(`Search Console sync complete: ${result.succeeded ?? 0} succeeded, ${result.failed ?? 0} failed.`);
