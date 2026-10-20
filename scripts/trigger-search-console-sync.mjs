const endpoint = process.env.SEARCH_CONSOLE_SYNC_URL?.trim();
const secret = process.env.SEARCH_CONSOLE_SYNC_SECRET?.trim();
if (!endpoint || !secret || secret.length < 32)
  throw new Error("Configure the reporting job URL and private shared secret.");
const url = new URL(endpoint);
if (
  url.origin !== "https://tailoredagents.com" ||
  url.pathname !== "/api/cron/search-console" ||
  url.search ||
  url.username ||
  url.password
) {
  throw new Error(
    "The reporting job must call https://tailoredagents.com/api/cron/search-console directly.",
  );
}
// Bound active runtime. A later five-minute check continues any remaining work.
const deadline = Date.now() + 210_000;
let checks = 0;
do {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "manual",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(110_000),
  });
  if (response.status >= 300 && response.status < 400)
    throw new Error(
      "Hosting redirects the job request. Correct the primary domain; redirects are refused.",
    );
  if (!response.ok)
    throw new Error(`Reporting worker failed with HTTP ${response.status}.`);
  const result = await response.json();
  if (result.ok !== true)
    throw new Error("Reporting worker returned an invalid response.");
  checks++;
  console.log(
    `Worker check ${checks}: ${result.checked ?? 0} date updates, ${result.failed ?? 0} stopped imports.`,
  );
  if (!result.more) break;
} while (Date.now() < deadline);
