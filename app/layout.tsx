import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteFrame } from "@/components/site-frame";
import { absoluteUrl, siteConfig } from "@/lib/site";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.title, template: "%s — Tailored Agents" },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "Tailored Agents — Better websites, more visibility, smarter business." }],
  },
  twitter: { card: "summary_large_image", title: siteConfig.title, description: siteConfig.description, images: [absoluteUrl("/opengraph-image")] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F9FC" };

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  telephone: siteConfig.phoneHref.replace("tel:", ""),
  contactPoint: { "@type": "ContactPoint", telephone: siteConfig.phoneHref.replace("tel:", ""), contactType: "sales" },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Tailored Agents services",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Website Design & Development" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Local SEO & Growth Analytics" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Tailored AI Agents & Business Automation" } },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteFrame
          header={<SiteHeader />}
          footer={<SiteFooter />}
          structuredData={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }} />}
        >
          {children}
        </SiteFrame>
      </body>
    </html>
  );
}
