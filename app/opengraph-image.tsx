import { ImageResponse } from "next/og";

export const alt = "Tailored Agents — Intelligence built into the way you work.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F7F7F4", color: "#1E252B", padding: "68px 76px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 22, letterSpacing: 4, fontWeight: 700 }}><div style={{ width: 34, height: 34, border: "2px solid #1E252B", display: "flex" }}/><span>TAILORED AGENTS</span></div>
      <div style={{ display: "flex", maxWidth: 980, fontSize: 84, lineHeight: .98, letterSpacing: -5, fontWeight: 500 }}>Intelligence built into the way you work.</div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #C9CDCA", paddingTop: 22, color: "#5D6870", fontSize: 22 }}><span>AI Engineering & Custom Software</span><span>tailoredagents.com</span></div>
    </div>,
    size,
  );
}
