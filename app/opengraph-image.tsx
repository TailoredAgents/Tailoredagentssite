import { ImageResponse } from "next/og";

export const alt = "Tailored Agents — AI systems that do real work.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", overflow: "hidden", background: "#f6f8fc", color: "#111827", padding: "60px 66px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", width: 620, height: 620, right: -130, top: -250, borderRadius: 620, background: "radial-gradient(circle, rgba(55,105,240,.27), rgba(108,76,224,.07) 56%, transparent 72%)", display: "flex" }} />
      <div style={{ position: "absolute", inset: 0, opacity: .28, backgroundImage: "linear-gradient(rgba(68,96,142,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(68,96,142,.1) 1px, transparent 1px)", backgroundSize: "62px 62px", display: "flex" }} />
      <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, fontSize: 18, letterSpacing: 3.2, fontWeight: 700 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #2e6ff2, #5848d8)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, letterSpacing: 0 }}>TA</div>
          <span>TAILORED AGENTS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 60 }}>
          <div style={{ width: 640, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: .95, letterSpacing: -5.3, fontWeight: 700 }}><span>AI systems that do</span><span style={{ color: "#2e6ff2" }}>real work.</span></div>
            <div style={{ marginTop: 25, color: "#617086", fontSize: 22, lineHeight: 1.42 }}>Custom agents, automation, and connected software engineered around real operations.</div>
          </div>
          <div style={{ width: 370, height: 260, display: "flex", flexDirection: "column", border: "1px solid #cdd7e6", borderRadius: 18, overflow: "hidden", background: "rgba(255,255,255,.94)", boxShadow: "0 24px 60px rgba(22,45,90,.16)" }}>
            <div style={{ height: 46, display: "flex", alignItems: "center", gap: 8, padding: "0 15px", borderBottom: "1px solid #e0e6ef", fontSize: 12, fontWeight: 700 }}><span style={{ width: 8, height: 8, borderRadius: 8, background: "#24a06b" }} />Call intelligence</div>
            <div style={{ padding: 17, display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#748198", fontSize: 11 }}><span>CUSTOMER CONVERSATION</span><span>PROCESSED</span></div>
              <div style={{ marginTop: 14, padding: "13px 14px", borderRadius: 10, background: "#f1f5fb", color: "#3f4d63", fontSize: 13, lineHeight: 1.4 }}>“We’re clearing out an office before the end of the month.”</div>
              <div style={{ display: "flex", gap: 7, marginTop: 13 }}><span style={{ padding: "7px 10px", borderRadius: 7, background: "#e8f0ff", color: "#245fc7", fontSize: 10 }}>TRANSCRIBE · DONE</span><span style={{ padding: "7px 10px", borderRadius: 7, background: "#eeeafd", color: "#6552c7", fontSize: 10 }}>EXTRACT · DONE</span></div>
              <div style={{ marginTop: 12, padding: "11px 12px", border: "1px solid #d8e4f5", borderRadius: 9, color: "#2f4566", fontSize: 11 }}>CRM note and next step prepared for review</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #d2dbe8", paddingTop: 18, color: "#66758b", fontSize: 17 }}><span>AI Engineering · Intelligent Automation · Custom Software</span><span style={{ color: "#255fcf", fontWeight: 700 }}>tailoredagents.com</span></div>
      </div>
    </div>,
    size,
  );
}
