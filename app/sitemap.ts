import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/solutions", "/engineering", "/work", "/work/stonegateos", "/company", "/contact", "/privacy", "/terms"];
  return routes.map((route) => ({ url: `${siteConfig.url}${route}`, lastModified: new Date("2026-10-12"), changeFrequency: route === "" ? "monthly" as const : "yearly" as const, priority: route === "" ? 1 : route.includes("stonegateos") ? .9 : .8 }));
}
