import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function ArrowLink({ href, children, light = false }: { href: string; children: React.ReactNode; light?: boolean }) {
  return <Link className={`button ${light ? "button-ghost" : "button-dark"}`} href={href}>{children}<ArrowRight size={15} aria-hidden="true" /></Link>;
}

export function PageHero({ eyebrow, title, description, meta }: { eyebrow: string; title: React.ReactNode; description: string; meta?: string }) {
  return (
    <section className="page-hero">
      <div className="container-shell page-hero-grid">
        <div><Eyebrow>{eyebrow}</Eyebrow><h1 className="page-title">{title}</h1></div>
        <div><p className="lede">{description}</p>{meta && <p className="page-meta">{meta}</p>}</div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="final-cta section-pad">
      <div className="container-shell final-cta-grid">
        <div><Eyebrow>Start with a clear next step</Eyebrow><h2 className="h2">Let&apos;s build something that moves your business <span className="serif-italic">forward.</span></h2><p>Begin with a free website review, or tell us about a broader growth, automation, or software opportunity.</p></div>
        <div className="final-cta-action"><ArrowLink href="/free-review" light>Get a Free Website Review</ArrowLink><Link href="/contact" className="final-cta-secondary">Discuss a Project<ArrowRight size={14}/></Link></div>
      </div>
    </section>
  );
}
