import { ImageResponse } from "next/og";

export const alt = "Tailored Agents — Better websites, more visibility, smarter business.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", overflow: "hidden", background: "#f6f8fc", color: "#111827", padding: "58px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", width: 680, height: 680, right: -170, top: -270, borderRadius: 680, background: "radial-gradient(circle, rgba(55,105,240,.3), rgba(108,76,224,.08) 56%, transparent 72%)", display: "flex" }} />
      <div style={{ position: "absolute", inset: 0, opacity: .25, backgroundImage: "linear-gradient(rgba(68,96,142,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(68,96,142,.1) 1px, transparent 1px)", backgroundSize: "62px 62px", display: "flex" }} />
      <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, fontSize: 17, letterSpacing: 3, fontWeight: 700 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #2e6ff2, #5848d8)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, letterSpacing: 0 }}>TA</div><span>TAILORED AGENTS</span></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 52 }}>
          <div style={{ width: 575, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 69, lineHeight: .94, letterSpacing: -4.7, fontWeight: 700 }}><span>Better websites.</span><span style={{ color: "#2e6ff2" }}>More visibility.</span><span>Smarter business.</span></div>
            <div style={{ marginTop: 22, color: "#617086", fontSize: 19, lineHeight: 1.42 }}>Premium websites, managed growth, and intelligent automation for businesses ready to move forward.</div>
          </div>
          <div style={{ width: 425, height: 300, display: "flex", flexDirection: "column", border: "1px solid #c8d4e5", borderRadius: 18, overflow: "hidden", background: "rgba(255,255,255,.96)", boxShadow: "0 25px 65px rgba(22,45,90,.18)" }}>
            <div style={{ height: 39, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid #e0e6ef", color: "#8793a5", fontSize: 9 }}><span>● &nbsp; ● &nbsp; ●</span><span>DESIGN CONCEPT</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", fontSize: 9 }}><b style={{ color: "#173a72", letterSpacing: 1.2 }}>NORTHSTAR</b><span style={{ color: "#7b8798" }}>HEATING &nbsp; COOLING &nbsp; SERVICE</span><i style={{ padding: "7px 9px", borderRadius: 6, color: "white", background: "#1f63d5", fontStyle: "normal" }}>REQUEST</i></div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 26px", background: "linear-gradient(135deg,#edf4ff,#fbfdff)" }}><small style={{ color: "#2f68d8", fontSize: 9, letterSpacing: 1.4 }}>COMFORT, ENGINEERED FOR HOME.</small><b style={{ width: 315, marginTop: 11, fontSize: 29, lineHeight: 1.02, letterSpacing: -1.3 }}>Reliable service starts with a clearer experience.</b><span style={{ width: 290, marginTop: 11, color: "#6c7b90", fontSize: 11, lineHeight: 1.4 }}>Responsive website design, local visibility, and connected inquiry paths.</span><div style={{ display: "flex", gap: 8, marginTop: 18 }}><i style={{ padding: "9px 12px", borderRadius: 7, color: "white", background: "#2468da", fontSize: 9, fontStyle: "normal" }}>SCHEDULE SERVICE</i><i style={{ padding: "9px 12px", border: "1px solid #d5deeb", borderRadius: 7, color: "#40516b", background: "white", fontSize: 9, fontStyle: "normal" }}>VIEW SERVICES</i></div></div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #d2dbe8", paddingTop: 17, color: "#66758b", fontSize: 16 }}><span>Websites · SEO & Analytics · Automation · Custom Software</span><span style={{ color: "#255fcf", fontWeight: 700 }}>tailoredagents.com</span></div>
      </div>
    </div>,
    size,
  );
}
