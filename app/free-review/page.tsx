import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { ReviewPreview } from "@/components/growth-visuals";
import { WebsiteReviewForm } from "@/components/website-review-form";
import { Eyebrow } from "@/components/ui";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free Website & Local Visibility Review",
  description: "Request a free initial review of your business website, mobile experience, inquiry paths, and local visibility foundations.",
  alternates: { canonical: "/free-review" },
};

export default function FreeReviewPage() {
  return (
    <>
      <section className="review-hero"><div className="container-shell review-hero-grid"><div><Eyebrow>Free initial website review</Eyebrow><h1 className="page-title">Find the clearest opportunities to make your website <span className="serif-italic">work harder.</span></h1><p className="lede">Share your current site and we&apos;ll take an initial look at the experience, inquiry paths, technical foundations, and local visibility signals that deserve attention.</p><div className="review-expectations"><span><Check size={14}/> Practical observations, not an automated score</span><span><Check size={14}/> No obligation and no ranking promises</span><span><Check size={14}/> A simple starting point for a useful conversation</span></div><div className="review-price-note"><strong>Know the starting point.</strong><span>Website projects begin at $1,500. Managed SEO begins at $400 per month.</span><Link href="/pricing">View pricing</Link></div><p className="review-contact-line">Prefer to talk? Call <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>.</p></div><ReviewPreview/></div></section>
      <section className="section-pad review-form-section"><div className="container-shell review-form-layout"><aside><Eyebrow>What happens next</Eyebrow><h2 className="h3">A focused first look, followed by a clear conversation.</h2><ol><li><span>01</span><div><b>Submit the current site</b><p>Tell us who you are, where the site lives, and optionally what concerns you most.</p></div></li><li><span>02</span><div><b>We review the basics</b><p>We look at clarity, mobile experience, inquiry paths, technical foundations, and visible local-search signals.</p></div></li><li><span>03</span><div><b>We follow up</b><p>If there is a useful opportunity to discuss, we&apos;ll contact you using the information supplied.</p></div></li></ol><p className="review-boundary">This is an initial human review, not a comprehensive technical audit, accessibility certification, security assessment, or guarantee of search performance.</p></aside><WebsiteReviewForm/></div></section>
    </>
  );
}
