export async function runScheduledWorkers(env, { fetcher = fetch, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)), log = console.log, error = log } = {}) {
  const deadline = now() + 210_000;
  async function lane(name, endpoint, secret, path, timeout) {
    if (!endpoint || !secret || secret.length < 32) throw new Error(`${name}: configure its URL and private secret.`);
    const url = new URL(endpoint);
    if (url.origin !== "https://www.tailoredagents.com" || url.pathname !== path || url.search || url.hash || url.username || url.password)
      throw new Error(`${name}: must call https://www.tailoredagents.com directly with the exact worker path.`);
    let failed = false;
    while (now() <= deadline - timeout) {
      const response = await fetcher(url, { method: "POST", redirect: "manual", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(Math.min(timeout, deadline-now())) });
      if (response.status >= 300 && response.status < 400) throw new Error(`${name}: hosting redirects are refused. Review the primary domain.`);
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}; review worker status.`);
      const result = await response.json();
      if (result.ok !== true) throw new Error(`${name}: invalid worker response.`);
      log(`${name}: ${result.checked ?? 0} checked; ${result.failed ?? 0} need review.`);
      failed ||= Boolean(result.failed);
      for (const [key, title] of [["voice", "Voicemail retention"], ["callRecordings", "Call recordings"], ["metaLeads", "Meta leads"], ["metaConversions", "Meta conversions"], ["introductions", "Lead introductions"]]) {
        if (result[key]?.checked || result[key]?.failed) log(`${title}: ${result[key].checked ?? 0} checked; ${result[key].failed ?? 0} need review.`);
      }
      if (!result.more) break;
      const delay = Number(result.retryAfterMs || 0);
      if (!Number.isFinite(delay) || delay < 0 || delay > 2500) break;
      if (now() + delay + 50 > deadline) break;
      if (delay) await sleep(delay + 50);
    }
    if (failed) throw new Error(`${name}: some work needs review; see the dashboard.`);
  }
  const tasks = [lane("Reporting", env.SEARCH_CONSOLE_SYNC_URL?.trim(), env.SEARCH_CONSOLE_SYNC_SECRET?.trim(), "/api/cron/search-console", 110_000)];
  // Omit only the SEO URL to pause this lane during rollback; reporting continues.
  if (env.SEO_WORKER_URL?.trim()) tasks.push(lane("SEO", env.SEO_WORKER_URL.trim(), env.SEO_WORKER_SECRET?.trim(), "/api/cron/seo", 90_000));
  // Factory planning is independent of reporting/SEO. Omitting its URL pauses
  // this lane; its database settings separately control paid work and intake.
  if (env.FACTORY_WORKER_URL?.trim()) tasks.push(lane("Website planning", env.FACTORY_WORKER_URL.trim(), (env.FACTORY_WORKER_SECRET || env.SEARCH_CONSOLE_SYNC_SECRET)?.trim(), "/api/cron/factory", 110_000));
  const results = await Promise.allSettled(tasks);
  for (const result of results) if (result.status === "rejected") error(result.reason instanceof Error ? result.reason.message : "Worker check failed.");
  return results.every(r => r.status === "fulfilled");
}
