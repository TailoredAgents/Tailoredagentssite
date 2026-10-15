import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Bot, Check, MonitorSmartphone, Search, Workflow } from "lucide-react";
import { GrowthHeroVisual, SeoDashboard, WebsiteConceptGallery } from "@/components/growth-visuals";
import { ProductWindow } from "@/components/product-window";
import { ArrowLink, Eyebrow, FinalCta } from "@/components/ui";
import { coreServices, servicePricing } from "@/lib/services";

export const metadata: Metadata = {
  title: "Premium Websites, Local SEO & AI Automation",
  description: "Tailored Agents builds high-performing websites, improves local search visibility, and develops managed AI agents and intelligent automations for growing businesses.",
  alternates: { canonical: "/" },
};

const serviceIcons = [MonitorSmartphone, Search, Workflow];

const growthSteps = [
  ["01", "Website", "Start with a credible customer experience, clear services, and useful inquiry paths."],
  ["02", "Growth Hub", "Bring website signals, search priorities, completed work, and next actions into view."],
  ["03", "Managed Growth", "Improve visibility and conversion through a consistent, human-reviewed monthly cadence."],
  ["04", "Tailored Agent", "Add one bounded agent responsibility when a repeated workflow is ready for it."],
] as const;

export default function Home() {
  return (
    <>
      <section className="growth-hero">
        <div className="growth-hero-atmosphere" aria-hidden="true" />
        <div className="container-shell growth-hero-grid">
          <div className="growth-hero-copy">
            <Eyebrow>Websites · Growth · Automation</Eyebrow>
            <h1 className="growth-display"><span>Better websites.</span><span>More <em>visibility.</em></span><span>Smarter business.</span></h1>
            <p className="lede">Tailored Agents builds high-performing websites, improves local search visibility, and develops intelligent automations that help growing businesses capture more opportunities and operate more efficiently.</p>
            <div className="hero-actions"><ArrowLink href="/free-review">Get a Free Website Review</ArrowLink><Link className="button button-light" href="/work">Explore Our Work<ArrowRight size={15}/></Link></div>
            <div className="growth-proof-row"><span><Check size={13}/> Designed around your business</span><span><Check size={13}/> Built for speed and clarity</span><span><Check size={13}/> Ready to grow with you</span></div>
          </div>
          <GrowthHeroVisual />
        </div>
        <div className="container-shell growth-capability-strip"><span>Website strategy</span><i/><span>Responsive development</span><i/><span>Local search visibility</span><i/><span>Business automation</span></div>
      </section>

      <section className="section-pad featured-websites-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Featured website design</Eyebrow><h2 className="h2">First impressions that <span className="serif-italic">work harder.</span></h2></div><p className="lede">We design customer-facing experiences around credibility, usability, performance, and the decisions a visitor needs to make before becoming an inquiry.</p></div>
          <WebsiteConceptGallery featuredOnly />
          <div className="section-end-link"><ArrowLink href="/websites">Explore website development</ArrowLink></div>
        </div>
      </section>

      <section className="section-pad service-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>What we do</Eyebrow><h2 className="h2">A stronger digital presence, built to <span className="serif-italic">keep improving.</span></h2></div><p className="lede">Begin with the service your business needs now. Add ongoing visibility work and targeted automation as the next opportunity becomes clear.</p></div>
          <div className="core-service-grid">
            {coreServices.map((service, index) => {
              const Icon = serviceIcons[index];
              return <Link href={service.href} className={`core-service-card service-card-${index + 1}`} key={service.key}><div className="service-card-top"><span><Icon size={20}/></span><em>0{index + 1}</em></div><h3>{service.title}</h3><p>{service.summary}</p><div className="service-detail">{service.detail}</div><b>Explore service <ArrowRight size={14}/></b></Link>;
            })}
          </div>
        </div>
      </section>

      <section className="section-pad analytics-showcase-section">
        <div className="container-shell analytics-intro">
          <div><Eyebrow>Managed SEO & Growth Hub</Eyebrow><h2 className="h2">Your website is the front door. The work behind it should be <span className="serif-italic">visible.</span></h2></div>
          <div><p className="lede">Our managed-service experience is designed to bring performance signals, search priorities, completed work, and recommended next actions into one clear view. The dashboard shown below is illustrative.</p><ArrowLink href="/seo" light>Explore SEO & the Growth Hub</ArrowLink></div>
        </div>
        <div className="container-shell analytics-dashboard-stage"><SeoDashboard /></div>
        <div className="container-shell hub-layer-grid">
          <article><BarChart3 size={18}/><span>01 / Monitor</span><h3>Understand what is happening.</h3><p>Website activity, conversion events, visibility signals, and performance trends become easier to review.</p></article>
          <article><Search size={18}/><span>02 / Improve</span><h3>Turn signals into priorities.</h3><p>See what was reviewed, what changed, what deserves attention next, and why the work matters.</p></article>
          <article><Bot size={18}/><span>03 / Automate</span><h3>Add agents when the workflow is ready.</h3><p>The same business context can support approvals, activity history, and tailored agents as the engagement expands.</p></article>
        </div>
      </section>

      <section className="section-pad growth-journey-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>A practical growth path</Eyebrow><h2 className="h2">Start with what brings people in. Build what helps the business <span className="serif-italic">run.</span></h2></div><p className="lede">Each layer can stand on its own. Begin with the website and visibility work that matter now, then add automation only when a defined workflow makes the next investment useful.</p></div>
          <div className="growth-journey">
            {growthSteps.map(([number, title, text], index) => <article key={title}><span>{number}</span><div className="journey-icon">{index === 0 ? <MonitorSmartphone size={18}/> : index === 1 ? <BarChart3 size={18}/> : index === 2 ? <Search size={18}/> : <Workflow size={18}/>}</div><h3>{title}</h3><p>{text}</p>{index < growthSteps.length - 1 && <i aria-hidden="true">→</i>}</article>)}
          </div>
        </div>
      </section>

      <section className="dark-section section-pad stonegate-section growth-stonegate-section">
        <div className="container-shell showcase-intro">
          <div className="showcase-copy"><Eyebrow>Featured engineering work · StonegateOS</Eyebrow><h2 className="h2">The technical depth behind the <span className="serif-italic">growth work.</span></h2><p className="lede">StonegateOS demonstrates our ability to develop connected applications, internal platforms, customer workflows, field tools, analytics, and AI-assisted automation for complex service operations.</p><ArrowLink href="/work/stonegateos" light>Read the case study</ArrowLink></div>
          <ul className="check-list"><li>Customer acquisition</li><li>CRM & communications</li><li>Scheduling & quoting</li><li>Field operations</li><li>Partner workflows</li><li>Marketing analysis</li><li>AI-assisted work</li><li>Durable automation</li></ul>
        </div>
        <div className="container-shell product-stage"><ProductWindow /></div>
      </section>

      <section className="section-pad pricing-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Clear starting points</Eyebrow><h2 className="h2">Competitive options. Thoughtful <span className="serif-italic">scope.</span></h2></div><p className="lede">See the entry price before starting a conversation. Every paid engagement still receives a written scope so the deliverables, responsibilities, and complete price are clear.</p></div>
          <div className="pricing-grid">
            {Object.values(servicePricing).map((item, index) => <article className={index === 0 ? "featured-price" : ""} key={item.label}><span>0{index + 1}</span><h3>{item.label}</h3><small>{item.qualifier}</small><strong>{item.price}</strong><p>{item.note}</p><Link href={item.href}>{item.cta}<ArrowRight size={14}/></Link></article>)}
          </div>
          <p className="pricing-note">Website packages begin at $1,500, managed SEO at $400 per month, focused automation at $650, and managed tailored agents at $750 per month plus activation and usage. Scope, integrations, and technical requirements affect the final proposal.</p>
          <div className="section-end-link"><ArrowLink href="/pricing">Explore packages and pricing</ArrowLink></div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
