import { getFactoryPreviewResolution, factoryPreviewUrl } from "@/lib/factory/build-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive", "referrer-policy": "no-referrer" };

/** A short branded entry point; website files still run on the isolated origin. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(slug)) return new Response("Preview unavailable", { status: 404, headers });
  try {
    const resolution = await getFactoryPreviewResolution(slug);
    const destination = resolution?.ready ? factoryPreviewUrl(slug) : null;
    if (!destination) return new Response("Preview unavailable", { status: 404, headers });
    return new Response(null, { status: 307, headers: { ...headers, location: destination } });
  } catch {
    return new Response("Preview temporarily unavailable", { status: 503, headers });
  }
}
