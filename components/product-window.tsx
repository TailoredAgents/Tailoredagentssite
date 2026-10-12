export function ProductWindow() {
  return (
    <div className="os-window" role="img" aria-label="Conceptual StonegateOS operations workspace using synthetic data">
      <div className="os-topbar"><div className="os-brand"><span>S</span><b>StonegateOS</b></div><div className="os-search">⌕ &nbsp; Search customers, jobs, conversations… <kbd>⌘ K</kbd></div><div className="os-top-actions"><span>?</span><span>2</span><b>AM</b></div></div>
      <div className="os-shell">
        <aside className="os-sidebar">
          <span className="os-group-label">Workspace</span>
          <span className="os-nav active"><i>⌁</i>Overview</span><span className="os-nav"><i>□</i>Inbox <b>6</b></span><span className="os-nav"><i>◇</i>Contacts</span><span className="os-nav"><i>⌗</i>Calendar</span><span className="os-nav"><i>↗</i>Pipeline</span>
          <span className="os-group-label">Intelligence</span>
          <span className="os-nav"><i>✦</i>Call analysis <b>3</b></span><span className="os-nav"><i>◉</i>Marketing</span><span className="os-nav"><i>⬡</i>Automations</span>
          <span className="os-group-label">Operations</span>
          <span className="os-nav"><i>▣</i>Partners</span><span className="os-nav"><i>▤</i>Expenses</span>
        </aside>
        <div className="os-content">
          <div className="os-heading"><div><span className="micro-label">Monday · Operations</span><h3>Good morning, Alex</h3></div><span className="os-action">+ New request</span></div>
          <div className="os-kpis"><Metric label="Active pipeline" value="24" delta="4 need action"/><Metric label="Today’s schedule" value="07" delta="2 crews active"/><Metric label="AI review queue" value="03" delta="All within SLA"/><Metric label="Open partner work" value="11" delta="3 updates today"/></div>
          <div className="os-dashboard-grid">
            <section className="os-panel os-pipeline"><div className="os-panel-title"><div><b>Pipeline</b><span>Live operational view</span></div><span className="os-action">View all</span></div><div className="pipeline-head"><span>Customer</span><span>Stage</span><span>Next step</span><span>Owner</span></div><PipelineRow initials="ME" name="Morgan Ellis" meta="Office cleanout" stage="Qualified" next="Confirm availability" owner="AL"/><PipelineRow initials="JR" name="Jordan Reed" meta="Property clearing" stage="Proposal" next="Review quote" owner="KM"/><PipelineRow initials="SC" name="Summit Co." meta="Partner request" stage="Scheduled" next="Thu · 10:30" owner="AL"/><PipelineRow initials="NP" name="Nora Patel" meta="Residential" stage="New" next="Call back" owner="KM"/></section>
            <section className="os-panel os-ai"><div className="os-panel-title"><div><b>AI activity</b><span>Prepared for review</span></div><i className="os-live"/></div><div className="ai-activity-item"><span className="ai-icon">✦</span><div><b>Call documentation ready</b><p>Morgan Ellis · 2 minutes ago</p></div><span>Review</span></div><div className="ai-activity-item"><span className="ai-icon purple">↗</span><div><b>Follow-up drafted</b><p>Jordan Reed · 14 minutes ago</p></div><span>Review</span></div><div className="ai-activity-item"><span className="ai-icon green">✓</span><div><b>Partner request routed</b><p>Summit Co. · 21 minutes ago</p></div><span>Open</span></div><div className="os-ai-summary"><small>This week</small><strong>38</strong><span>assisted workflows completed</span></div></section>
            <section className="os-panel os-schedule"><div className="os-panel-title"><div><b>Today’s field schedule</b><span>7 appointments · 2 crews</span></div><span className="os-action">Open calendar</span></div><div className="schedule-track"><span>8 AM</span><span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span></div><div className="schedule-row"><b>Crew A</b><i className="job one">Ellis · Decatur</i><i className="job two">Patel · Atlanta</i></div><div className="schedule-row"><b>Crew B</b><i className="job three">Summit · Avondale</i><i className="job four">Reed · Tucker</i></div></section>
          </div>
        </div>
      </div>
      <span className="os-demo-label">Illustrative interface · Synthetic data</span>
    </div>
  );
}

function Metric({ label, value, delta }: { label: string; value: string; delta: string }) { return <div className="os-metric"><span>{label}</span><strong>{value}</strong><small>{delta}</small></div>; }
function PipelineRow({ initials, name, meta, stage, next, owner }: { initials: string; name: string; meta: string; stage: string; next: string; owner: string }) { return <div className="pipeline-row"><span className="customer"><i>{initials}</i><span><b>{name}</b><small>{meta}</small></span></span><span><em>{stage}</em></span><span>{next}</span><span className="owner">{owner}</span></div>; }
