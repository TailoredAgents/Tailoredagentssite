// Separate scheduled process: model work and website scans don't block the CRM.
import { runSeoWorkerStep } from "../lib/seo/worker";
import { getDatabasePool } from "../lib/dashboard/db";
async function main() {
  const deadline = Date.now() + 210_000;
  try {
    while (Date.now() < deadline - 70_000) {
      const result = await runSeoWorkerStep();
      console.log(
        `SEO worker: ${result.checked} stage checked, ${result.failed} need review.`,
      );
      if (result.failed) process.exitCode = 1;
      if (!result.more) break;
      if (result.retryAfterMs)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(result.retryAfterMs + 50, 2500)),
        );
    }
  } finally {
    await getDatabasePool().end();
  }
}
void main().catch(() => {
  console.error(
    "SEO worker could not finish. Check its configuration and dashboard run history.",
  );
  process.exitCode = 1;
});
