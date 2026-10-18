import type { Metadata } from "next";
import { PageHero } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy Notice", description: "How Tailored Agents handles inquiry and website measurement information.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title={<>Privacy <span className="serif-italic">notice.</span></>} description="This notice describes the limited information this website collects, including inquiry details and first-party website measurement." meta="Effective October 18, 2026" />
      <article className="content-narrow legal">
        <p>This website is designed to collect as little personal information as practical. It does not use advertising trackers, persistent cross-session identifiers, public user accounts, or behavioral profiling.</p>
        <h2>Information you provide</h2><p>If you submit a project inquiry or website review request, we collect your name, organization, email address, optional phone number, the website URL or area of interest you provide, and any project description or primary concern you choose to include. Please do not submit confidential, regulated, or sensitive personal information through these forms.</p>
        <h2>How information is used</h2><p>Inquiry information is used to assess and respond to your request, communicate about a potential project, maintain reasonable business records, and protect the form from abuse. It is not sold.</p>
        <h2>Storage and delivery providers</h2><p>Submissions are stored in the private Tailored Agents operations database hosted by Render. When email notifications are configured, Resend also processes the submission to notify the team. Authorized Tailored Agents team members can access inquiry records through the private dashboard.</p>
        <h2>Website measurement</h2><p>The website records first-party events such as page views, calls-to-action, phone-link clicks, form starts, and successful inquiry submissions. It uses a random identifier held only in session storage to group activity within one browser session. It does not store a persistent visitor identifier, full referring URL, advertising profile, form contents, raw IP address, or user-agent string with these events. External referring domains and normalized UTM campaign fields may be retained to explain acquisition. Do Not Track and Global Privacy Control signals disable this client-side measurement.</p>
        <h2>Technical data</h2><p>The server processes basic request information, such as an IP address, to protect public endpoints from abuse. The application stores a one-way hash used for a short-lived rate-limit record rather than the raw address. It is designed not to write inquiry contents to application logs. Hosting and network providers may retain standard service logs under their own policies.</p>
        <h2>Retention and security</h2><p>First-party measurement events are scheduled for deletion after 25 months. New inquiry records are assigned a 24-month retention period. If an inquiry does not become a client relationship, its identifying content is scheduled for anonymization after that period. Records connected to active or completed business may be kept longer where reasonably necessary for service, contractual, accounting, legal, or security purposes. Audit records are scheduled for deletion after 36 months. Reasonable safeguards are used, but no online transmission or storage system can be guaranteed completely secure.</p>
        <h2>Your choices</h2><p>You may enable Do Not Track or Global Privacy Control in a compatible browser to disable first-party website measurement, and you may choose not to submit a form. You may request access, correction, or deletion of previously submitted information through the website contact page or the published business phone number. Tailored Agents may need to verify the request and may retain information where legally permitted or required.</p>
        <h2>Changes</h2><p>This notice may be updated if the website’s actual data practices change. The effective date will be revised when that happens.</p>
        <h2>Contact</h2><p>Privacy questions can be raised through the website contact page or by calling the business phone number published in the site footer.</p>
      </article>
    </>
  );
}
