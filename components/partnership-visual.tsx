import { ArrowDown, Code2, Handshake, Network, Users } from "lucide-react";

export function PartnershipVisual() {
  return <div className="partnership-visual" aria-label="Your industry knowledge and our engineering, brought together around a shared opportunity">
    <span className="studio-label">Different strengths. Shared possibility.</span>
    <div className="partner-inputs"><div><Users size={27}/><h2>You know<br/>the business.</h2><p>Relationships<br/>Industry experience<br/>A real opportunity</p></div><span>+</span><div><Code2 size={27}/><h2>We build<br/>the solution.</h2><p>Custom AI<br/>Connected systems<br/>Software engineering</p></div></div>
    <div className="partner-join"><span/><ArrowDown size={22}/><span/></div>
    <div className="partner-outcome"><Handshake size={25}/><div><strong>Something worth building. Together.</strong><p>Agree the fit, scope and responsibilities.</p></div></div>
    <div className="partner-visual-foot"><Network size={15}/> Referrals · Delivery · Revenue sharing</div>
  </div>;
}
