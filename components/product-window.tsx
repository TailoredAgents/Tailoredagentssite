"use client";

import { useState } from "react";
import { BrainCircuit, CalendarDays, ChartNoAxesCombined, Handshake, Smartphone, UsersRound } from "lucide-react";

const views = [
  { id: "intelligence", label: "AI Intelligence", icon: BrainCircuit },
  { id: "crm", label: "CRM & Sales", icon: UsersRound },
  { id: "schedule", label: "Booking", icon: CalendarDays },
  { id: "marketing", label: "Marketing", icon: ChartNoAxesCombined },
  { id: "partners", label: "Partners", icon: Handshake },
  { id: "mobile", label: "Mobile Ops", icon: Smartphone },
] as const;

type ViewId = typeof views[number]["id"];

export function ProductWindow() {
  const [active, setActive] = useState<ViewId>("intelligence");
  const activeView = views.find((view) => view.id === active) ?? views[0];

  return (
    <div className="platform-showcase" aria-label="Interactive conceptual StonegateOS platform demonstration using synthetic data">
      <div className="platform-switcher" role="tablist" aria-label="Explore StonegateOS capabilities">
        <span className="platform-switcher-label">Explore the platform · Synthetic interface</span>
        <div className="platform-tabs">
          {views.map((view) => {
            const Icon = view.icon;
            return <button key={view.id} id={`platform-tab-${view.id}`} type="button" role="tab" aria-selected={active === view.id} aria-controls="platform-panel" onClick={() => setActive(view.id)}><Icon size={14}/><span>{view.label}</span></button>;
          })}
        </div>
      </div>

      <div className="os-window">
        <div className="os-topbar"><div className="os-brand"><span>S</span><b>StonegateOS</b></div><div className="os-search">⌕ &nbsp; Search customers, jobs, conversations… <kbd>⌘ K</kbd></div><div className="os-top-actions"><span>?</span><span>2</span><b>AM</b></div></div>
        <div className="os-shell">
          <aside className="os-sidebar" aria-label="Conceptual application navigation">
            <span className="os-group-label">Workspace</span>
            <span className={`os-nav ${active === "crm" ? "active" : ""}`}><i>◇</i>CRM & pipeline</span><span className={`os-nav ${active === "schedule" ? "active" : ""}`}><i>⌗</i>Schedule</span><span className="os-nav"><i>□</i>Inbox <b>6</b></span>
            <span className="os-group-label">Intelligence</span>
            <span className={`os-nav ${active === "intelligence" ? "active" : ""}`}><i>✦</i>Call analysis <b>3</b></span><span className={`os-nav ${active === "marketing" ? "active" : ""}`}><i>◉</i>Marketing</span><span className="os-nav"><i>⬡</i>Automations</span>
            <span className="os-group-label">Operations</span>
            <span className={`os-nav ${active === "partners" ? "active" : ""}`}><i>▣</i>Partners</span><span className={`os-nav ${active === "mobile" ? "active" : ""}`}><i>▤</i>Field mobile</span>
          </aside>
          <div className="os-content">
            <div className="os-view-heading"><div><span className="micro-label">Connected operations · {activeView.label}</span><h3>{viewTitle(active)}</h3><p>{viewDescription(active)}</p></div><span className="os-action">{viewAction(active)}</span></div>
            <div className={`os-view os-view-${active}`} id="platform-panel" role="tabpanel" aria-labelledby={`platform-tab-${active}`} tabIndex={0}>
              <PlatformView active={active} />
            </div>
          </div>
        </div>
        <span className="os-demo-label">Illustrative interface · Synthetic data</span>
      </div>
    </div>
  );
}

function PlatformView({ active }: { active: ViewId }) {
  if (active === "intelligence") return <IntelligenceView />;
  if (active === "crm") return <CrmView />;
  if (active === "schedule") return <ScheduleView />;
  if (active === "marketing") return <MarketingView />;
  if (active === "partners") return <PartnersView />;
  return <MobileView />;
}

function IntelligenceView() {
  return <div className="os-intelligence-layout"><section className="os-panel call-record"><div className="os-panel-title"><div><b>Morgan Ellis</b><span>Call · 12:48 · Processed</span></div><span className="os-status success">CRM synced</span></div><div className="os-waveform">{[34,61,44,76,48,88,57,69,92,43,78,52,84,64,37,71,49,89,58,75,41,65,82,47].map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div><div className="os-transcript-snippet"><small>00:53 · Morgan</small><p>“Ideally Thursday the 24th, sometime after 10. We have freight elevator access.”</p></div><div className="os-call-tags"><span>Office cleanout</span><span>Decatur</span><span>High intent</span></div></section><section className="os-panel extracted-record"><div className="os-panel-title"><div><b>Extracted requirements</b><span>Structured from conversation</span></div><span className="os-spark">✦</span></div><div className="os-field-grid"><span><small>Service</small>Commercial cleanout</span><span><small>Target</small>Thu 24 · After 10</span><span><small>Access</small>Freight elevator</span><span><small>Follow-up</small>Email + text</span></div><div className="os-prepared-note"><small>Prepared CRM note</small><p>Customer requested office cleanout in Decatur. Quote by email; text when ready. Confirm item volume before booking.</p></div></section><section className="os-panel review-queue"><div className="os-panel-title"><div><b>Review queue</b><span>Human decision points</span></div><span className="os-status">3 open</span></div>{[["Call note","Morgan Ellis","Ready"],["Follow-up draft","Jordan Reed","Review"],["Coaching insight","Nora Patel","Open"]].map(([a,b,c])=><div className="review-row" key={a}><i>✦</i><span><b>{a}</b><small>{b}</small></span><em>{c}</em></div>)}</section></div>;
}

function CrmView() {
  return <><div className="os-kpis"><Metric label="Active opportunities" value="24" delta="4 need attention"/><Metric label="New inquiries" value="08" delta="Today"/><Metric label="Proposals ready" value="05" delta="2 awaiting review"/><Metric label="Follow-ups" value="11" delta="Assigned across team"/></div><section className="os-panel os-pipeline"><div className="os-panel-title"><div><b>Sales pipeline</b><span>Customer context and next actions</span></div><span className="os-action">Open pipeline</span></div><div className="pipeline-head"><span>Customer</span><span>Stage</span><span>Next step</span><span>Owner</span></div><PipelineRow initials="ME" name="Morgan Ellis" meta="Office cleanout" stage="Qualified" next="Confirm availability" owner="AL"/><PipelineRow initials="JR" name="Jordan Reed" meta="Property clearing" stage="Proposal" next="Review quote" owner="KM"/><PipelineRow initials="SC" name="Summit Co." meta="Partner request" stage="Scheduled" next="Thu · 10:30" owner="AL"/><PipelineRow initials="NP" name="Nora Patel" meta="Residential" stage="New" next="Call back" owner="KM"/></section></>;
}

function ScheduleView() {
  return <div className="booking-layout"><section className="os-panel booking-calendar"><div className="os-panel-title"><div><b>Thursday, October 24</b><span>Team availability and confirmed work</span></div><span className="os-status success">2 crews active</span></div><div className="calendar-grid"><div className="time-column"><span>8 AM</span><span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span></div><div className="crew-column"><b>Crew A</b><span className="calendar-job job-blue"><small>9:00–11:00</small>Ellis · Decatur</span><span className="calendar-job job-iris"><small>1:30–3:00</small>Patel · Atlanta</span></div><div className="crew-column"><b>Crew B</b><span className="calendar-job job-green"><small>10:30–12:30</small>Summit · Avondale</span><span className="calendar-job job-blue late"><small>3:00–4:30</small>Reed · Tucker</span></div></div></section><section className="os-panel booking-detail"><div className="os-panel-title"><div><b>Selected appointment</b><span>Morgan Ellis · Confirmed</span></div></div><div className="booking-detail-list"><span><small>Arrival</small>9:00–9:30 AM</span><span><small>Service</small>Office cleanout</span><span><small>Access</small>Freight elevator</span><span><small>Assigned</small>Crew A · 2 operators</span></div><div className="booking-check"><i>✓</i><span><b>Customer notification prepared</b><small>Send after operator review</small></span></div></section></div>;
}

function MarketingView() {
  return <div className="marketing-layout"><section className="os-panel marketing-overview"><div className="os-panel-title"><div><b>Marketing intelligence</b><span>Connected advertising and first-party signals</span></div><span className="os-status">30 days</span></div><div className="marketing-metric-line"><div><small>High-intent inquiries</small><b>Trend view</b></div><span>Evidence, not a performance claim</span></div><div className="marketing-bars">{[45,52,48,66,58,73,69,82,76,91,83,88].map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div><div className="chart-axis"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div></section><section className="os-panel marketing-insights"><div className="os-panel-title"><div><b>Prepared recommendations</b><span>Awaiting approval</span></div><span className="os-spark">✦</span></div><div className="insight-row priority"><span>01</span><div><b>Review high-intent local search terms</b><p>Several terms show closer alignment with qualified service inquiries.</p></div></div><div className="insight-row"><span>02</span><div><b>Compare landing-page intent</b><p>Validate message alignment before changing campaign structure.</p></div></div><div className="approval-note">No campaign changes occur without approval.</div></section></div>;
}

function PartnersView() {
  return <div className="partner-layout"><section className="os-panel partner-accounts"><div className="os-panel-title"><div><b>Commercial accounts</b><span>Locations, requests, and service status</span></div><span className="os-action">New request</span></div>{[["Summit Property Group","4 locations","2 active"],["Northline Offices","2 locations","1 review"],["Park & Alder","6 locations","3 scheduled"]].map(([a,b,c],index)=><div className="partner-row" key={a}><span className="partner-logo">{["SP","NO","PA"][index]}</span><div><b>{a}</b><small>{b}</small></div><em>{c}</em></div>)}</section><section className="os-panel partner-work"><div className="os-panel-title"><div><b>Request lifecycle</b><span>Summit · Avondale location</span></div><span className="os-status success">Scheduled</span></div><div className="lifecycle"><span className="done"><i>✓</i>Submitted<small>Oct 18</small></span><span className="done"><i>✓</i>Reviewed<small>Oct 18</small></span><span className="done"><i>✓</i>Approved<small>Oct 19</small></span><span className="current"><i>4</i>Scheduled<small>Oct 24</small></span></div><div className="partner-proof"><span><small>Scope</small>Office furniture removal</span><span><small>Site contact</small>Jamie R.</span><span><small>Proof required</small>Before & after media</span></div></section></div>;
}

function MobileView() {
  return <div className="mobile-ops-layout"><div className="phone-frame"><div className="phone-status"><span>9:41</span><i/></div><div className="phone-head"><span>Thursday · 4 jobs</span><b>Good morning, Crew A</b></div><div className="phone-job active"><small>NOW · 9:00 AM</small><b>Morgan Ellis</b><span>Commercial cleanout · Decatur</span><em>Open job →</em></div><div className="phone-job"><small>NEXT · 1:30 PM</small><b>Nora Patel</b><span>Residential · Atlanta</span></div><div className="phone-nav"><span>Today</span><span>Messages</span><span>Profile</span></div></div><section className="os-panel field-context"><div className="os-panel-title"><div><b>Field context</b><span>Information prepared for the assigned crew</span></div><span className="os-status success">Synced</span></div><div className="field-context-grid"><span><small>Customer</small>Morgan Ellis</span><span><small>Arrival</small>9:00–9:30 AM</span><span><small>Access</small>Freight elevator</span><span><small>Job notes</small>Office furniture + files</span></div><div className="offline-note"><i>↻</i><div><b>Designed for field conditions</b><p>Media, completion evidence, receipts, and job updates synchronize through controlled workflows.</p></div></div></section></div>;
}

function viewTitle(id: ViewId) { return ({ intelligence: "AI-assisted work, connected to the record.", crm: "Every customer interaction in context.", schedule: "Booking connected to operational capacity.", marketing: "Campaign evidence turned into reviewable action.", partners: "Commercial work coordinated across locations.", mobile: "The operating system, built for the field." } as const)[id]; }
function viewDescription(id: ViewId) { return ({ intelligence: "Recorded calls become structured documentation, next steps, and coaching signals.", crm: "Leads, conversations, proposals, and ownership move through one shared operating model.", schedule: "Availability, customer requirements, and field assignments stay synchronized.", marketing: "Advertising and first-party data support bounded recommendations with human approval.", partners: "Accounts, locations, service requests, proof, and approvals share one traceable lifecycle.", mobile: "Assigned teams receive the context, communication, media, and completion tools needed for daily work." } as const)[id]; }
function viewAction(id: ViewId) { return ({ intelligence: "Review queue", crm: "+ New opportunity", schedule: "+ Book work", marketing: "Open analysis", partners: "+ Partner request", mobile: "View field status" } as const)[id]; }
function Metric({ label, value, delta }: { label: string; value: string; delta: string }) { return <div className="os-metric"><span>{label}</span><strong>{value}</strong><small>{delta}</small></div>; }
function PipelineRow({ initials, name, meta, stage, next, owner }: { initials: string; name: string; meta: string; stage: string; next: string; owner: string }) { return <div className="pipeline-row"><span className="customer"><i>{initials}</i><span><b>{name}</b><small>{meta}</small></span></span><span><em>{stage}</em></span><span>{next}</span><span className="owner">{owner}</span></div>; }
