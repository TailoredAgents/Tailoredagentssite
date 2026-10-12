import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { PageHero } from "@/components/ui";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Discuss a Project",
  description: "Tell Tailored Agents about your AI agent, automation, integration, or custom software project.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title={<>Tell us what you&apos;re trying to <span className="serif-italic">make work better.</span></>} description="A useful first conversation starts with the operation: what is difficult today, what systems are involved, and what a better outcome would look like." meta="Project inquiries · No obligation" />
      <section className="section-pad"><div className="container-shell contact-grid"><aside className="contact-note"><span className="eyebrow">A good starting point</span><h2 className="h3" style={{marginTop:"1.2rem"}}>You do not need a complete technical specification.</h2><p>Share the problem, the people it affects, and the systems already involved. We can help frame the right technical approach.</p><div className="case-facts" style={{marginTop:"2rem"}}><div className="case-fact"><span>Call us</span><span><a className="contact-phone-link" href={siteConfig.phoneHref}>{siteConfig.phone}</a></span></div><div className="case-fact"><span>Useful context</span><span>Current workflow and friction</span></div><div className="case-fact"><span>Helpful</span><span>Existing tools or integrations</span></div><div className="case-fact"><span>Avoid</span><span>Sensitive or confidential data</span></div></div></aside><ContactForm /></div></section>
    </>
  );
}
