import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "tailored-agents-web" }, { headers: { "Cache-Control": "no-store" } });
}
