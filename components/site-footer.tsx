import Link from "next/link";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-shell">
        <div className="footer-top">
          <div>
            <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true" />TAILORED AGENTS</Link>
            <p className="footer-statement">Premium websites, measurable digital growth, and intelligent business automation.</p>
          </div>
          <div className="footer-links">
            <div>
              <h3>Explore</h3>
              {siteConfig.nav.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
            </div>
            <div>
              <h3>Information</h3>
              <Link href="/engineering">Engineering</Link>
              <Link href="/solutions">Solutions</Link>
              <Link href="/industries/hvac">HVAC services</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/contact">Start a conversation</Link>
              <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Tailored Agents. All rights reserved.</span>
          <span>Websites · Growth · Automation · Software engineering</span>
        </div>
      </div>
    </footer>
  );
}
