import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  async redirects() {
    // Enable only after Render stops redirecting apex requests to www.
    // Redirects are compiled at build time, so changing this requires a rebuild.
    if (process.env.ENABLE_APEX_REDIRECT !== "true") return [];
    return [{ source: "/:path*", has: [{ type: "host" as const, value: "www.tailoredagents.com" }], destination: "https://tailoredagents.com/:path*", permanent: true }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
