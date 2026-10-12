export function ProductWindow() {
  const bars = [38, 54, 45, 73, 62, 88, 69, 78, 92, 75, 84, 96];
  return (
    <div className="product-window" aria-label="Conceptual StonegateOS operations dashboard using synthetic data">
      <div className="window-bar"><span className="window-dot"/><span className="window-dot"/><span className="window-dot"/><span className="window-label">Conceptual interface · Synthetic data</span></div>
      <div className="product-layout">
        <div className="product-rail"><span className="rail-mark"/><span className="rail-dot active">01</span><span className="rail-dot">02</span><span className="rail-dot">03</span><span className="rail-dot">04</span></div>
        <div className="dashboard">
          <div className="dash-top"><h3>Operations overview</h3><span className="concept-label">Mon · 08:42</span></div>
          <div className="metric-strip">
            <div className="metric"><span>Open requests</span><strong>18</strong></div>
            <div className="metric"><span>Today’s work</span><strong>07</strong></div>
            <div className="metric"><span>Needs review</span><strong>03</strong></div>
          </div>
          <div className="dash-main">
            <div className="dash-card"><div className="dash-title"><span>Weekly activity</span><span className="concept-label">12 periods</span></div><div className="bar-chart">{bars.map((bar, i) => <i key={i} style={{ height: `${bar}%` }} />)}</div></div>
            <div className="dash-card"><div className="dash-title"><span>System activity</span><span className="concept-label">Live</span></div><ul className="activity"><li>Call notes prepared for review</li><li>Partner request synchronized</li><li>Follow-up task scheduled</li><li>Receipt data extracted</li></ul></div>
          </div>
        </div>
      </div>
    </div>
  );
}
