import { managedMetadata } from "@/lib/seo/public-metadata";
import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PageHero } from "@/components/ui";
import { siteConfig } from "@/lib/site";

const baselineMetadata: Metadata = {
  title: "Discuss a Project",
  description: "Tell Tailored Agents about your website, SEO, automation, integration, or custom software opportunity.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title={<>Tell us what you&apos;re ready to <span className="serif-italic">improve.</span></>} description="A useful first conversation can begin with a website, search visibility, one operational bottleneck, or a larger software opportunity." meta="Websites · Growth · Automation · Custom software" />
      <section className="section-pad"><div className="container-shell contact-grid"><aside className="contact-note"><span className="eyebrow">A good starting point</span><h2 className="h3" style={{marginTop:"1.2rem"}}>You do not need a complete technical specification.</h2><p>Share the current situation, the outcome you want, and any existing website or systems involved. We can help frame a useful next step.</p><div className="case-facts" style={{marginTop:"2rem"}}><div className="case-fact"><span>Call us</span><span><a className="contact-phone-link" href={siteConfig.phoneHref}>{siteConfig.phone}</a></span></div><div className="case-fact"><span>Useful context</span><span>Current experience and business priority</span></div><div className="case-fact"><span>Helpful</span><span>Existing website, tools, or integrations</span></div><div className="case-fact"><span>Avoid</span><span>Sensitive or confidential data</span></div></div></aside><ContactForm /></div></section>
    </>
  );
}

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { return managedMetadata("/contact", baselineMetadata); }
