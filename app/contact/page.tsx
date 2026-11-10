import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PageHero } from "@/components/ui";
import { contactInterestFromQuery } from "@/lib/contact";
import { publicPageMetadata, siteConfig } from "@/lib/site";

const baselineMetadata = publicPageMetadata(
  "Let’s Talk About Your Business",
  "Discuss custom AI, automation, software, websites, SEO or a partnership with Tailored Agents. Start with how your business works and what you want to improve.",
  "/contact",
);

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ interest?: string | string[] }> }) {
  const initialInterest = contactInterestFromQuery((await searchParams).interest);
  return (
    <>
      <PageHero eyebrow="Contact" title={<>Tell us what you&apos;re ready to <span className="serif-italic">improve.</span></>} description="Bring us a repetitive task, a missing connection, a software idea or a partnership opportunity. We can help you work out a practical next step." meta="AI & automation · Software · Partnerships · Web & SEO" />
      <section className="section-pad"><div className="container-shell contact-grid"><aside className="contact-note"><span className="eyebrow">A good starting point</span><h2 className="h3" style={{marginTop:"1.2rem"}}>You do not need a complete technical specification.</h2><p>Share the current situation, the outcome you want, and any existing website or systems involved. We can help frame a useful next step.</p><div className="case-facts" style={{marginTop:"2rem"}}><div className="case-fact"><span>Call us</span><span><a className="contact-phone-link" href={siteConfig.phoneHref}>{siteConfig.phone}</a></span></div><div className="case-fact"><span>Useful context</span><span>Current experience and business priority</span></div><div className="case-fact"><span>Helpful</span><span>Existing website, tools, or integrations</span></div><div className="case-fact"><span>Avoid</span><span>Sensitive or confidential data</span></div></div></aside><ContactForm key={initialInterest} initialInterest={initialInterest} /></div></section>
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/contact", baselineMetadata); }
