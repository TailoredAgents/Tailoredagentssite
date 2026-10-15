import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, ChartNoAxesCombined, Layers3 } from "lucide-react";
import { PackageCalculator } from "@/components/package-calculator";
import { Eyebrow, FinalCta } from "@/components/ui";

export const metadata: Metadata = {
  title: "Website & SEO Growth Packages",
  description: "Explore Tailored Agents website and SEO bundles, then adjust the upfront website investment to see a clear six-month cost breakdown.",
  alternates: { canonical: "/packages" },
};

export default function PackagesPage() {
  return (
    <>
      <section className="packages-hero">
        <div className="container-shell packages-hero-grid">
          <div>
            <Eyebrow>Flexible growth packages</Eyebrow>
            <h1 className="page-title">Shape the launch around your <span className="serif-italic">cash flow.</span></h1>
            <p className="lede">Pair a professional website with managed SEO, choose how much of the website to fund upfront, and see the complete breakdown before starting a conversation.</p>
            <div className="hero-actions"><Link className="button button-dark" href="#package-builder">Build your package<ArrowRight size={15} aria-hidden="true" /></Link><Link className="button button-light" href="/pricing">Compare individual services</Link></div>
          </div>
          <aside className="packages-hero-card" aria-label="How flexible packages work">
            <span className="micro-label blue">One package. Three clear stages.</span>
            <div><span>01</span><strong>Choose the website and SEO cadence</strong><small>Select a package matched to the scope and growth opportunity.</small></div>
            <div><span>02</span><strong>Adjust the upfront investment</strong><small>Move the slider to balance today&apos;s payment against the first six months.</small></div>
            <div><span>03</span><strong>Continue SEO month to month</strong><small>After the website balance is satisfied, only the selected SEO service remains.</small></div>
          </aside>
        </div>
      </section>

      <section className="section-pad package-builder-section" id="package-builder">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Interactive package builder</Eyebrow><h2 className="h2">See where every dollar <span className="serif-italic">goes.</span></h2></div><p className="lede">The website price, deferred amount, estimated flex cost, setup value, and ongoing SEO are separated so the monthly number never hides the actual investment.</p></div>
          <PackageCalculator />
        </div>
      </section>

      <section className="section-pad package-paths-section">
        <div className="container-shell">
          <div className="section-heading-wide"><div><Eyebrow>Prefer a standalone service?</Eyebrow><h2 className="h2">Every service still works <span className="serif-italic">on its own.</span></h2></div><p className="lede">Packages are an optional way to coordinate a launch. Website-only, SEO-only, automation, and custom software engagements remain available.</p></div>
          <div className="package-paths-grid">
            <article><Layers3 size={20} /><span>01</span><h3>Website only</h3><p>Focused business websites begin at $1,500, with larger growth and advanced scopes available.</p><Link href="/pricing#websites">View website pricing<ArrowRight size={14} /></Link></article>
            <article><ChartNoAxesCombined size={20} /><span>02</span><h3>SEO only</h3><p>Month-to-month managed SEO begins at $400 per month plus a one-time foundation setup.</p><Link href="/pricing#seo">View SEO pricing<ArrowRight size={14} /></Link></article>
            <article><Bot size={20} /><span>03</span><h3>Automation & software</h3><p>Focused automations begin at $650. Connected systems and custom software receive a tailored scope.</p><Link href="/pricing#automation">View automation pricing<ArrowRight size={14} /></Link></article>
          </div>
        </div>
      </section>

      <section className="section-pad package-policy-section">
        <div className="container-shell package-policy-grid">
          <div><Eyebrow>Clear boundaries</Eyebrow><h2 className="h2">Flexible does not mean <span className="serif-italic">unclear.</span></h2></div>
          <div className="package-policy-list">
            <div><span>SEO</span><p>SEO remains month to month and may be canceled before the next billing cycle.</p></div>
            <div><span>Website</span><p>The website payment obligation is separate from SEO. Canceling SEO does not remove an unpaid website balance.</p></div>
            <div><span>Ownership</span><p>Website ownership transfers after the applicable website balance is paid in full.</p></div>
            <div><span>Availability</span><p>Flex structures are estimates and are offered only after the payment terms and business scope are approved in writing.</p></div>
            <div><span>Scope</span><p>Calculator results are estimates. The written proposal confirms deliverables, outside costs, and exact terms.</p></div>
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
