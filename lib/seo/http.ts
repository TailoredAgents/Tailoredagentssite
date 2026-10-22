import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";
import { SEO_ORIGIN, managedPath } from "./config";
const blocked = new BlockList();
for (const [address, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["100.64.0.0", 10],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, bits, "ipv4");
export function publicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family === 6)
    return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
  return false;
}
export function crawlerUrl(path: string) {
  if (!managedPath(path))
    throw new Error("Only registered public marketing pages can be scanned.");
  return new URL(path, SEO_ORIGIN);
}
export async function readPublicPage(
  path: string,
): Promise<{ body: string; status: number }> {
  const url = crawlerUrl(path),
    addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("Website DNS did not resolve to public addresses.");
  const pinned = addresses.find((a) => a.family === 4) || addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        family: pinned.family,
        headers: {
          "user-agent":
            "TailoredAgentsSEOMonitor/1.0 (+https://www.tailoredagents.com)",
          accept: "text/html",
        },
        lookup: (_host, _options, callback) =>
          callback(null, pinned.address, pinned.family),
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.destroy();
          reject(
            new Error(
              "Unexpected website redirect; review the canonical route.",
            ),
          );
          return;
        }
        if (!String(res.headers["content-type"] || "").includes("text/html")) {
          res.destroy();
          reject(new Error("Page did not return HTML."));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000)
            res.destroy(new Error("Page exceeds crawl size limit."));
          else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({ status, body: Buffer.concat(chunks).toString("utf8") }),
        );
        res.on("error", reject);
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error("Website scan exceeded its deadline.")),
      20000,
    );
    req.on("close", () => clearTimeout(deadline));
    req.setTimeout(15000, () =>
      req.destroy(new Error("Website scan timed out.")),
    );
    req.on("error", reject);
    req.end();
  });
}
export async function providerJson(
  url: string,
  options: RequestInit,
  maximum = 2_000_000,
) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !["api.openai.com", "api.dataforseo.com"].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw new Error("Unapproved provider origin.");
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(65000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("SEO provider did not confirm the request.");
  }
  if (!response.body) throw new Error("Empty provider response.");
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > maximum) {
        await reader.cancel();
        throw new Error("Provider response exceeds its limit.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
