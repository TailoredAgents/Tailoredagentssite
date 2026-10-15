import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/websites", "/seo", "/automation", "/industries/hvac", "/free-review", "/work", "/work/stonegateos", "/solutions", "/engineering", "/company", "/contact", "/privacy", "/terms"];
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date("2026-10-15"),
    changeFrequency: route === "" || ["/websites", "/seo", "/automation", "/industries/hvac"].includes(route) ? "monthly" as const : "yearly" as const,
    priority: route === "" ? 1 : ["/websites", "/seo", "/automation", "/free-review"].includes(route) ? .9 : route.includes("stonegateos") ? .85 : .75,
  }));
}
