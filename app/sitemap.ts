import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/websites", "/seo", "/automation", "/packages", "/pricing", "/industries/hvac", "/free-review", "/work", "/work/stonegateos", "/solutions", "/solutions/commercial-insurance", "/solutions/freight-automation", "/engineering", "/company", "/partners", "/contact", "/privacy", "/terms"];
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(["", "/automation", "/pricing", "/work", "/solutions", "/company", "/contact", "/partners"].includes(route) ? "2026-11-10" : route === "/solutions/freight-automation" ? "2026-11-06" : route === "/solutions/commercial-insurance" ? "2026-11-04" : "2026-10-15"),
    changeFrequency: route === "" || ["/websites", "/seo", "/automation", "/packages", "/pricing", "/industries/hvac"].includes(route) ? "monthly" as const : "yearly" as const,
    priority: route === "" ? 1 : ["/solutions", "/automation", "/partners", "/pricing", "/work"].includes(route) ? .9 : route.includes("stonegateos") ? .85 : .75,
  }));
}
