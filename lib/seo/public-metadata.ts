import "server-only";
import type { Metadata } from "next";
import { Pool } from "pg";
import { SEO_SITE_ID, SEO_WORKSPACE_ID, managedPath } from "./config";
type PublicGlobal = typeof globalThis & { seoPublicMetadataPool?: Pool };
/** Only published, fact-checked metadata is public. Bounded independent queries
 * keep a database outage from taking the marketing pages down. Page ISR is
 * invalidated by publication actions; a worker rollback also expires in 5m. */
export async function managedMetadata(
  path: string,
  baseline: Metadata,
): Promise<Metadata> {
  if (!managedPath(path) || !process.env.DATABASE_URL) return baseline;
  try {
    const global = globalThis as PublicGlobal;
    if (!global.seoPublicMetadataPool) {
      global.seoPublicMetadataPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 800,
        idleTimeoutMillis: 10000,
        query_timeout: 1000,
        statement_timeout: 1000,
        application_name: "seo-public-metadata",
      });
      global.seoPublicMetadataPool.on("error", () => {});
    }
    const pool = global.seoPublicMetadataPool;
    const row = (
      await pool.query<{ title: string; description: string }>(
        "SELECT c.title,c.description FROM seo_publications p JOIN seo_changes c ON c.id=p.change_id AND c.workspace_id=p.workspace_id AND c.site_id=p.site_id JOIN sites s ON s.id=p.site_id AND s.workspace_id=p.workspace_id JOIN workspaces w ON w.id=p.workspace_id WHERE p.site_id=$1 AND p.workspace_id=$2 AND p.path=$3 AND c.status IN ('published','verified') AND c.human_reviewed_at IS NOT NULL AND s.status='active' AND w.status='active'",
        [SEO_SITE_ID, SEO_WORKSPACE_ID, path],
      )
    ).rows[0];
    if (!row) return baseline;
    return {
      ...baseline,
      title: { absolute: row.title },
      description: row.description,
      openGraph: {
        type: "website",
        siteName: "Tailored Agents",
        url: `https://www.tailoredagents.com${path}`,
        images: [
          {
            url: "https://www.tailoredagents.com/opengraph-image",
            width: 1200,
            height: 630,
            alt: "Tailored Agents",
          },
        ],
        ...baseline.openGraph,
        title: row.title,
        description: row.description,
      },
      twitter: {
        card: "summary_large_image",
        images: ["https://www.tailoredagents.com/opengraph-image"],
        ...baseline.twitter,
        title: row.title,
        description: row.description,
      },
    };
  } catch {
    return baseline;
  }
}
