import type { Metadata } from "next";
import { PageHero } from "@/components/ui";

export const metadata: Metadata = { title: "Website Terms", description: "Terms governing use of the Tailored Agents website.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title={<>Website <span className="serif-italic">terms.</span></>} description="These terms apply to your use of the Tailored Agents informational website and project inquiry form." meta="Effective October 12, 2026" />
      <article className="content-narrow legal">
        <h2>Informational purpose</h2><p>The content on this website is general information about Tailored Agents’ engineering capabilities and approach. It is not a promise that any specific solution is appropriate for your organization.</p>
        <h2>No engagement created</h2><p>Submitting an inquiry or communicating through this website does not create a client relationship, confidentiality obligation, or commitment to provide services. Any engagement requires a separate written agreement.</p>
        <h2>Demonstrations and case studies</h2><p>Interface illustrations are labeled when they use synthetic data or represent conceptual demonstrations. References to source-implemented capabilities do not guarantee that every feature is enabled, deployed, or suitable for a particular use.</p>
        <h2>Acceptable use</h2><p>You may not misuse the website, attempt unauthorized access, interfere with its operation, submit unlawful content, or use automated means to abuse the inquiry form.</p>
        <h2>Intellectual property</h2><p>Website design, original text, illustrations, and software are owned by Tailored Agents or used with permission. You may view the site for ordinary business evaluation but may not reproduce or redistribute substantial portions without authorization.</p>
        <h2>Third-party services</h2><p>The website may rely on hosting, delivery, and infrastructure providers. Third-party services are governed by their own terms and may change independently.</p>
        <h2>Disclaimers</h2><p>The website is provided on an “as available” basis. To the extent permitted by law, no warranty is made that the site will be uninterrupted, error-free, or suitable for every purpose.</p>
        <h2>Changes</h2><p>These terms may be updated as the website and its functionality evolve. Continued use after an update constitutes acceptance of the revised terms.</p>
        <h2>Contact</h2><p>A verified legal contact address and governing jurisdiction must be confirmed before public launch.</p>
      </article>
    </>
  );
}
