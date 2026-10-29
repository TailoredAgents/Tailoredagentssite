import { resolve } from "node:path";
import type { NextConfig } from "next";
import { browserScriptSources, browserUpgradeDirective, voiceBrowserFixture, voiceDashboardHeaders } from "./lib/security/voice-browser";

const voiceFixture = voiceBrowserFixture();
const fixtureWebpack: NextConfig["webpack"] = (config, { isServer }) => {
  if (!isServer) config.resolve.alias["@twilio/voice-sdk"] = resolve("scripts/voice-browser-sdk-fixture.ts");
  return config;
};
const metaPixel = process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === "true" && /^\d{5,30}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID || "");
const metaScript = metaPixel ? " https://connect.facebook.net" : "";
const metaEvents = metaPixel ? " https://www.facebook.com https://connect.facebook.net" : "";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: `default-src 'self'; script-src ${browserScriptSources()}${metaScript}; style-src 'self' 'unsafe-inline'; img-src 'self' data:${metaEvents}; font-src 'self'; connect-src 'self'${metaEvents}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'${browserUpgradeDirective()}` },
];

const nextConfig: NextConfig = {
  // Twilio uses native Node HTTP clients and server-side credential handling.
  serverExternalPackages: ["twilio"],
  ...(voiceFixture ? { webpack: fixtureWebpack, turbopack: { resolveAlias: { "@twilio/voice-sdk": { browser: "./scripts/voice-browser-sdk-fixture.ts" } } } } : {}),
  poweredByHeader: false,
  compress: true,
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host" as const, value: "tailoredagents.com" }], destination: "https://www.tailoredagents.com/:path*", permanent: true }];
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/dashboard/:path*", headers: voiceDashboardHeaders(voiceFixture) },
      { source: "/sign-in", headers: [{ key: "Content-Security-Policy", value: `default-src 'self'; script-src ${browserScriptSources()}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'${browserUpgradeDirective()}` }] },
    ];
  },
};

export default nextConfig;
