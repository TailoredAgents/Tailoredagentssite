import type { Metadata } from "next";
import { PageHero } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy Notice", description: "How Tailored Agents handles information submitted through this website.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title={<>Privacy <span className="serif-italic">notice.</span></>} description="This notice describes the limited information this website collects and how project inquiry information is handled." meta="Effective October 12, 2026" />
      <article className="content-narrow legal">
        <p>This website is designed to collect as little personal information as practical. It does not include advertising trackers, user accounts, or behavioral profiling.</p>
        <h2>Information you provide</h2><p>If you submit a project inquiry or website review request, we collect your name, organization, email address, optional phone number, the website URL or area of interest you provide, and any project description or primary concern you choose to include. Please do not submit confidential, regulated, or sensitive personal information through these forms.</p>
        <h2>How information is used</h2><p>Inquiry information is used to assess and respond to your request, communicate about a potential project, maintain reasonable business records, and protect the form from abuse. It is not sold.</p>
        <h2>Delivery providers</h2><p>When configured for production, the form uses Resend to deliver your inquiry by email. The information in your submission is processed by that provider for message delivery. This website does not store submitted inquiries in its own database.</p>
        <h2>Technical data</h2><p>The server may temporarily process basic request information, such as an IP address, to enforce rate limits and protect the form from spam. The application is designed not to log the contents of form submissions. Hosting and network providers may retain standard service logs under their own policies.</p>
        <h2>Retention and security</h2><p>Delivered inquiries may be retained in business email systems as reasonably necessary to respond, maintain records, or meet legal obligations. Reasonable safeguards are used, but no online transmission or storage system can be guaranteed completely secure.</p>
        <h2>Your choices</h2><p>You may choose not to submit the form. Requests concerning previously submitted information can be made through the same contact channel once a verified business contact address is published.</p>
        <h2>Changes</h2><p>This notice may be updated if the website’s actual data practices change. The effective date will be revised when that happens.</p>
        <h2>Contact</h2><p>Privacy questions can be raised through the website contact page or by calling the business phone number published in the site footer.</p>
      </article>
    </>
  );
}
