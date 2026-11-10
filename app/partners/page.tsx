import Link from "next/link";
import { ArrowUpRight, Handshake, Network, Users } from "lucide-react";
import { ArrowLink, Eyebrow, PageHero } from "@/components/ui";
import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata(
  "Partnerships & Revenue Sharing",
  "Explore referrals, delivery partnerships and revenue-share opportunities with Tailored Agents. Discuss the fit, responsibilities and terms privately.",
  "/partners",
);

export default function PartnersPage() {
  return <>
    <PageHero eyebrow="Partnerships" title={<>You know the business.<br/>Let’s build the <span className="serif-italic">possibility.</span></>} description="Bring your relationships, industry knowledge or an opportunity worth exploring. We bring custom AI, automation and software capability. Let’s see where working together makes sense." meta="Referrals · Delivery partnerships · Revenue sharing" />
    <section className="business-partnerships section-pad"><div className="container-shell">
      <div className="business-partnership-grid">
        <article><Users size={28}/><span>01 / Introductions</span><h2>Connect us with a business.</h2><p>Know an owner whose team is buried in manual work, disconnected tools or slow follow-up? A useful introduction starts with the problem they want to solve.</p><ArrowLink href="/contact?interest=partnership">Discuss an introduction</ArrowLink></article>
        <article><Network size={28}/><span>02 / Delivery</span><h2>Bring a solution to your clients.</h2><p>Explore a joint project where your client relationship or industry expertise fits our engineering capability. We agree on scope, roles and ongoing responsibilities before work begins.</p><ArrowLink href="/contact?interest=partnership">Explore working together</ArrowLink></article>
        <article id="revenue-share"><Handshake size={28}/><span>03 / Revenue sharing</span><h2>Explore a shared opportunity.</h2><p>Our revenue-share program starts with a conversation about the opportunity and each partner’s contribution. Fit, responsibilities and commercial terms are discussed privately and agreed in writing.</p><ArrowLink href="/contact?interest=revenue-share">Discuss revenue sharing</ArrowLink></article>
      </div>
      <p className="business-partnership-note">An inquiry starts a conversation. Participation, compensation and any revenue-share arrangement require a separate agreement.</p>
    </div></section>
    <section className="section-pad section-rule"><div className="container-shell business-services"><div><Eyebrow>A useful introduction</Eyebrow><h2>“You should talk<br/>to <span className="serif-italic">Tailored Agents.”</span></h2><p className="lede">Introduce us when someone wants to improve how their business runs and is open to exploring a practical solution.</p></div><ul className="business-referral-list"><li>A team keeps copying information between tools.</li><li>Documents and exceptions slow down customer work.</li><li>Leads or customer requests get lost between people.</li><li>An industry needs software that fits its actual process.</li></ul></div></section>
    <section className="section-pad business-partner-section"><div className="container-shell business-partner-conversation"><Eyebrow>Start with the opportunity</Eyebrow><h2 className="h2">Tell us who you help<br/>and what you <span className="serif-italic">have in mind.</span></h2><p className="lede">A short overview is enough to begin. Please keep client-confidential information out of the initial inquiry.</p><ArrowLink href="/contact?interest=partnership">Start a partnership conversation</ArrowLink><Link href="/work/stonegateos" className="business-text-link">Explore our engineering work<ArrowUpRight size={16}/></Link></div></section>
  </>;
}
