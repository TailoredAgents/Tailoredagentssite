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
        <div><Eyebrow>Start a conversation</Eyebrow><h2 className="h2">Let&apos;s build something <span className="serif-italic">useful.</span></h2><p>Tell us what your organization is working toward. We&apos;ll help explore where intelligent software and automation could make a meaningful difference.</p></div>
        <div className="final-cta-action"><ArrowLink href="/contact" light>Discuss Your Project</ArrowLink></div>
      </div>
    </section>
  );
}
