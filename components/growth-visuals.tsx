"use client";

import { useState } from "react";
import { ArrowUpRight, BarChart3, Check, Gauge, MapPin, MessageSquareText, Search, Wrench } from "lucide-react";

export function GrowthHeroVisual() {
  return (
    <div className="growth-visual" aria-label="Concept website, mobile design, search analytics, and lead workflow using illustrative data">
      <div className="growth-browser">
        <div className="concept-browser-bar"><span><i/><i/><i/></span><b>northstarcomfort.com</b><em>Design concept</em></div>
        <div className="concept-site concept-site-hvac">
          <div className="concept-nav"><strong><i><Wrench size={13}/></i>NORTHSTAR</strong><span>Heating</span><span>Cooling</span><span>Maintenance</span><button>Request service</button></div>
          <div className="concept-hero-copy"><small>Comfort, engineered for home.</small><h3>Reliable heating and cooling, without the guesswork.</h3><p>Clear service options, straightforward scheduling, and a team built around responsive care.</p><div><b>Schedule service</b><span>Explore solutions <ArrowUpRight size={11}/></span></div></div>
          <div className="concept-service-row"><span><i>01</i><b>Cooling repair</b><small>Fast paths to request service</small></span><span><i>02</i><b>System replacement</b><small>Helpful options and next steps</small></span><span><i>03</i><b>Maintenance</b><small>Plans explained clearly</small></span></div>
        </div>
      </div>

      <div className="growth-phone" aria-hidden="true">
        <div className="phone-island" />
        <div className="mobile-concept-head"><i><Wrench size={11}/></i><b>NORTHSTAR</b><span>Menu</span></div>
        <span className="mobile-concept-kicker">AC repair · Palm Beach County</span>
        <strong>Home comfort, handled.</strong>
        <p>Book service from any screen.</p>
        <button>Request service</button>
        <div className="mobile-concept-card"><small>Need help now?</small><b>Choose a service</b><span>Cooling · Heating · Maintenance</span></div>
      </div>

      <div className="growth-signal-card search-signal" aria-hidden="true">
        <span className="signal-icon"><Search size={14}/></span><div><small>Search visibility</small><b>12 priority pages monitored</b><span><i/> Illustrative reporting</span></div>
      </div>
      <div className="growth-signal-card lead-signal" aria-hidden="true">
        <span className="signal-icon violet"><MessageSquareText size={14}/></span><div><small>New website inquiry</small><b>Service request captured</b><span><i/> Follow-up path prepared</span></div>
      </div>
    </div>
  );
}

const concepts = [
  { id: "hvac", type: "HVAC website", name: "Northstar Heating & Air", line: "Responsive service paths built around urgency, trust, and local relevance.", tone: "blue" },
  { id: "roofing", type: "Roofing website", name: "Ridgeway Roofing Co.", line: "A confident editorial system for projects, materials, service areas, and quote requests.", tone: "slate" },
  { id: "outdoor", type: "Premium local service", name: "Lumen Outdoor Living", line: "A visual, project-led experience designed to make higher-value work feel tangible.", tone: "green" },
] as const;

export function WebsiteConceptGallery({ featuredOnly = false }: { featuredOnly?: boolean }) {
  const shown = featuredOnly ? concepts.slice(0, 2) : concepts;
  return (
    <div className={`concept-gallery ${featuredOnly ? "concept-gallery-featured" : ""}`}>
      {shown.map((concept, index) => (
        <article className={`concept-project concept-${concept.tone}`} key={concept.id}>
          <div className="concept-project-meta"><span>Design Concept · 0{index + 1}</span><b>{concept.type}</b></div>
          <div className="mini-browser">
            <div className="mini-browser-bar"><i/><i/><i/><span>{concept.id}.concept</span></div>
            <div className="mini-site-nav"><b>{concept.name.split(" ")[0].toUpperCase()}</b><span>Services</span><span>Work</span><span>About</span><i>Get started</i></div>
            <div className="mini-site-hero"><small>{concept.type}</small><strong>{index === 0 ? "Comfort starts with a better experience." : index === 1 ? "Protection built above the standard." : "Outdoor spaces, considered beautifully."}</strong><p>{concept.line}</p><span>Explore the experience <ArrowUpRight size={12}/></span></div>
            <div className="mini-site-grid"><i/><i/><i/></div>
          </div>
          <div className="concept-project-copy"><h3>{concept.name}</h3><p>{concept.line}</p></div>
        </article>
      ))}
    </div>
  );
}

const dashboardViews = {
  overview: {
    label: "Performance overview",
    title: "Search and inquiry signals in one view",
    bars: [34, 45, 39, 58, 52, 69, 63, 76, 72, 86, 80, 91],
    items: [["Website inquiries", "Trend monitored"], ["Organic visibility", "12 priority pages"], ["Site experience", "Core pages reviewed"]],
  },
  visibility: {
    label: "Local visibility",
    title: "High-intent topics organized by opportunity",
    bars: [50, 43, 61, 54, 70, 67, 78, 73, 85, 81, 89, 94],
    items: [["AC repair near me", "Priority topic"], ["Heating service", "Coverage reviewed"], ["Maintenance plans", "Content opportunity"]],
  },
  actions: {
    label: "Optimization work",
    title: "Recommendations become visible, accountable tasks",
    bars: [24, 31, 38, 46, 44, 52, 58, 65, 68, 74, 82, 88],
    items: [["Improve service-area page", "Prepared"], ["Clarify title and description", "Completed"], ["Add conversion event", "In review"]],
  },
} as const;

type DashboardView = keyof typeof dashboardViews;

export function SeoDashboard({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState<DashboardView>("overview");
  const view = dashboardViews[active];
  return (
    <div className={`seo-dashboard ${compact ? "seo-dashboard-compact" : ""}`}>
      <div className="seo-dashboard-top"><div><span className="dashboard-logo"><BarChart3 size={15}/></span><b>Growth overview</b><small>Illustrative interface · Synthetic data</small></div><span className="dashboard-period">Last 90 days</span></div>
      <div className="seo-dashboard-shell">
        <div className="seo-dashboard-nav" role="tablist" aria-label="Example analytics dashboard views">
          {(Object.keys(dashboardViews) as DashboardView[]).map((id) => <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setActive(id)}>{id === "overview" ? <Gauge size={14}/> : id === "visibility" ? <MapPin size={14}/> : <Check size={14}/>}<span>{dashboardViews[id].label}</span></button>)}
        </div>
        <div className="seo-dashboard-main" role="tabpanel" tabIndex={0}>
          <div className="dashboard-heading"><div><small>{view.label}</small><h3>{view.title}</h3></div><span><i/> Human reviewed</span></div>
          <div className="dashboard-metrics"><span><small>Organic search</small><b>Visibility trend</b><em>Monitored</em></span><span><small>Website inquiries</small><b>Conversion events</b><em>Configured</em></span><span><small>Performance</small><b>Core pages</b><em>Reviewed</em></span></div>
          <div className="dashboard-grid">
            <div className="dashboard-chart"><div className="chart-label"><span>Illustrative search visibility</span><small>Weekly trend</small></div><div className="seo-bars">{view.bars.map((height, index) => <i key={index} style={{height:`${height}%`}}><b/></i>)}</div><div className="seo-axis"><span>Week 1</span><span>Week 6</span><span>Week 12</span></div></div>
            <div className="dashboard-actions"><div className="chart-label"><span>{active === "actions" ? "Optimization queue" : "Signals to review"}</span><small>Example</small></div>{view.items.map(([name, status], index) => <div className="dashboard-action" key={name}><i>{index + 1}</i><span><b>{name}</b><small>{status}</small></span><em>{index === 1 ? "Done" : "Review"}</em></div>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReviewPreview() {
  return (
    <div className="review-preview" aria-label="Example website review scope">
      <div className="review-preview-head"><span><Search size={16}/></span><div><small>Free initial review</small><b>What we look at first</b></div><em>Example scope</em></div>
      <div className="review-preview-score"><div><small>Website clarity</small><span><i style={{width:"74%"}}/></span><b>Review</b></div><div><small>Mobile experience</small><span><i style={{width:"82%"}}/></span><b>Review</b></div><div><small>Local visibility foundations</small><span><i style={{width:"61%"}}/></span><b>Review</b></div></div>
      <div className="review-preview-list"><span><Check size={14}/><b>First-impression clarity</b><small>Can visitors quickly understand the offer?</small></span><span><Check size={14}/><b>Inquiry paths</b><small>Are next steps visible and easy to complete?</small></span><span><Check size={14}/><b>Search foundations</b><small>Are core technical and local signals in place?</small></span><span><Check size={14}/><b>Priority opportunities</b><small>What deserves attention first?</small></span></div>
      <p>No automated score or ranking guarantee. We review the supplied site and follow up with practical observations.</p>
    </div>
  );
}
