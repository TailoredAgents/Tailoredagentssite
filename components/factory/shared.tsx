import Link from "next/link";
import { CircleAlert, Info, ShieldCheck } from "lucide-react";
import type { FactoryWorkspace, FactoryProjectSummary } from "@/lib/factory/types";

export const factoryStatusLabels: Record<FactoryProjectSummary["status"], string> = {
  draft: "Planning workspace", research_queued: "Research queued", researching: "Researching", plan_ready: "Ready to review", approved: "Approved for build", failed: "Needs attention",
};

export function FactoryStatus({ status }: { status: FactoryProjectSummary["status"] }) {
  const tone = status === "plan_ready" ? "ready" : status === "approved" ? "approved" : status === "failed" ? "error" : status === "researching" ? "working" : "idle";
  return <span className={`factory-status is-${tone}`}><i aria-hidden="true" />{factoryStatusLabels[status]}</span>;
}

export function FactorySetupNotice({ settings, config, canManage }: Pick<FactoryWorkspace, "settings" | "config" | "canManage">) {
  if (settings.researchEnabled && config.configured) return null;
  return <div className="factory-notice is-warning"><CircleAlert size={19} aria-hidden="true" /><div><strong>{!config.configured ? "Research setup needed" : "AI research is paused"}</strong><p>{!config.configured ? config.reason || "An administrator needs to finish the AI research setup." : "Research requests and your chat are saved. They will start when an administrator enables research."} {!config.configured ? "You can still open a planning workspace and add details. No AI research runs until setup is complete and research is enabled." : ""} {canManage ? <Link href="/dashboard/sales/factory#research-settings">Review research settings</Link> : null}</p></div></div>;
}

export function FactoryBuildNotice() {
  return <div className="factory-notice"><ShieldCheck size={19} aria-hidden="true" /><div><strong>Your team decides when to build</strong><p>Research and chat prepare the plan. A human approves the exact version before it enters the build queue. The builder checks the approved website before publishing its preview and downloadable source.</p></div></div>;
}

export function FactoryReadOnly({ canEdit }: { canEdit: boolean }) {
  return !canEdit ? <div className="factory-notice"><Info size={18} aria-hidden="true" /><div><strong>Read-only access</strong><p>You can review plans and discussion. A teammate with editing access can add instructions or approve a plan.</p></div></div> : null;
}

export function safeReference(value: string) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export function factoryMoney(micros: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(micros / 1_000_000);
}

export function FactoryPreviewStatus({ build }: { build: NonNullable<FactoryProjectSummary["latestBuild"]> }) {
  const label = build.status === "ready" ? build.previewUrl ? "Preview ready" : "Preview saved" : build.status === "running" ? "Building website" : build.status === "queued" ? "Build queued" : build.status === "failed" ? "Build needs attention" : "Build cancelled";
  const tone = build.status === "ready" && build.previewUrl ? "approved" : build.status === "failed" ? "error" : "working";
  return <span className={`factory-status is-${tone}`}><i aria-hidden="true" />{label}</span>;
}
