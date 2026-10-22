import { createHash } from "node:crypto";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { SEO_ORIGIN, managedPath } from "./config";
import type { SeoSnapshot } from "./types";
type Node = DefaultTreeAdapterMap["node"];
function children(node: Node): Node[] {
  return "childNodes" in node ? node.childNodes : [];
}
function tag(node: Node) {
  return "tagName" in node ? node.tagName : "";
}
function attr(node: Node, name: string) {
  return "attrs" in node
    ? node.attrs.find((a) => a.name === name)?.value || ""
    : "";
}
function content(node: Node): string {
  if (["script", "style", "template", "noscript"].includes(tag(node)))
    return "";
  return node.nodeName === "#text" && "value" in node
    ? node.value
    : children(node).map(content).join(" ");
}
function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
export function parsePage(
  path: string,
  html: string,
  status = 200,
): SeoSnapshot {
  if (!managedPath(path) || Buffer.byteLength(html) > 2_000_000)
    throw new Error("Unsupported page snapshot.");
  const document = parse(html),
    nodes: Node[] = [];
  const walk = (n: Node, depth = 0) => {
    if (depth > 180) return;
    nodes.push(n);
    for (const c of children(n)) walk(c, depth + 1);
  };
  walk(document);
  const find = (name: string) => nodes.filter((n) => tag(n) === name);
  const title = clean(find("title").map(content).at(-1) || "");
  const description = attr(
    (find("meta")
      .filter((n) => attr(n, "name").toLowerCase() === "description")
      .at(-1) as Node) || document,
    "content",
  );
  const canonical = attr(
    (find("link")
      .filter((n) => attr(n, "rel").split(/\s+/).includes("canonical"))
      .at(-1) as Node) || document,
    "href",
  );
  const robots = find("meta")
    .filter((n) =>
      ["robots", "googlebot"].includes(attr(n, "name").toLowerCase()),
    )
    .map((n) => attr(n, "content"))
    .join(",");
  const h1 = find("h1")
      .map((n) => clean(content(n)).slice(0, 500))
      .slice(0, 8),
    headings = nodes
      .filter((n) => /^h[23]$/.test(tag(n)))
      .map((n) => clean(content(n)).slice(0, 500))
      .slice(0, 30);
  const main = find("main")[0] || find("body")[0] || document,
    text = clean(content(main)).slice(0, 14000);
  const links = [
    ...new Set(
      find("a")
        .map((n) => attr(n, "href"))
        .filter((v) => v && v.length < 2000),
    ),
  ].slice(0, 100);
  let canonicalMatches = false;
  try {
    canonicalMatches =
      new URL(canonical).href === new URL(SEO_ORIGIN + path).href;
  } catch {
    /* Malformed canonical stays an observation. */
  }
  const issues: string[] = [];
  if (status !== 200) issues.push(`HTTP ${status}`);
  if (!title) issues.push("Missing page title");
  if (!description) issues.push("Missing search description");
  if (!canonical) issues.push("Missing canonical URL");
  else if (!canonicalMatches)
    issues.push("Canonical URL differs from the registered page");
  if (/\bnoindex\b/i.test(robots)) issues.push("Public page requests noindex");
  if (h1.length !== 1) issues.push(`${h1.length} main headings`);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        title,
        description,
        canonical,
        robots,
        h1,
        headings,
        text,
      }),
    )
    .digest("hex");
  return {
    path,
    url: SEO_ORIGIN + path,
    status,
    title,
    description,
    canonical,
    robots,
    h1,
    headings,
    text,
    links,
    issues,
    fingerprint,
  };
}
