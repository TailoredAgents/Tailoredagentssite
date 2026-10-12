import Link from "next/link";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-shell">
        <div className="footer-top">
          <div>
            <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true" />TAILORED AGENTS</Link>
            <p className="footer-statement">Custom AI agents, intelligent automation, and purpose-built software.</p>
          </div>
          <div className="footer-links">
            <div>
              <h3>Explore</h3>
              {siteConfig.nav.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
            </div>
            <div>
              <h3>Information</h3>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/contact">Start a conversation</Link>
              <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Tailored Agents. All rights reserved.</span>
          <span>AI engineering & custom software development</span>
        </div>
      </div>
    </footer>
  );
}
