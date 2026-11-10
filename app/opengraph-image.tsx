import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Tailored Agents — Custom AI built around your business";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/brand/tailored-agents-logo.png"));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0c1b32", color: "#ffffff", padding: "48px 60px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", padding: "12px 18px", background: "#ffffff", borderRadius: 9 }}><img src={`data:image/png;base64,${logo.toString("base64")}`} width={210} height={69} alt="Tailored Agents"/></div><span style={{ color: "#bed1ee", fontSize: 17 }}>CUSTOM AI · AUTOMATION · SOFTWARE</span></div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 650 }}><div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1, letterSpacing: -4, display: "flex", flexDirection: "column" }}><span>AI that works</span><span>around</span><span style={{ color: "#9dc0ff" }}>your business.</span></div><p style={{ fontSize: 22, lineHeight: 1.4, color: "#c1d1e6", maxWidth: 600, margin: "22px 0 0" }}>Connect your systems. Simplify repeated work. Give your team more room to move.</p></div>
        <div style={{ width: 350, display: "flex", flexDirection: "column", padding: 28, background: "#1a3d6d", borderRadius: 18, color: "#eff5ff" }}><span style={{ fontSize: 13, color: "#b0c8ec", letterSpacing: 1.5 }}>BUILT AROUND YOUR WORK</span>{[["01","Understand the process"],["02","Connect the right tools"],["03","Keep people in control"]].map(([n,t])=><div key={n} style={{ display: "flex", gap: 16, alignItems: "center", padding: "24px 0", borderBottom: "1px solid #3c5473" }}><span style={{ color: "#9dbfff", fontSize: 16 }}>{n}</span><span style={{ fontSize: 20, lineHeight: 1.2 }}>{t}</span></div>)}<span style={{ marginTop: 22, color: "#b0c8ec", fontSize: 15 }}>A practical next step starts here.</span></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 18, borderTop: "1px solid #3c5473", color: "#bed1ee", fontSize: 17 }}><span>Based in Georgia. Built around your business.</span><span style={{ color: "#9dc0ff", fontWeight: 700 }}>tailoredagents.com</span></div>
    </div>,size,
  );
}
