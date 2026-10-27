"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, CircleAlert, Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import { LocalTime } from "@/components/sales/date-time-field";
import { buildActivities } from "@/lib/factory/build-progress";
import { factoryBuildRecovery } from "@/lib/factory/workflow";
import type { FactoryBuildStage, FactoryBuildVersion } from "@/lib/factory/build-types";

const stages: Array<{ value: FactoryBuildStage; label: string; detail: string }> = [
  { value: "generate", label: "Design & code", detail: "Creating the pages from the approved plan." },
  { value: "images", label: "Images", detail: "Preparing the website’s imagery and business assets." },
  { value: "qa", label: "Quality checks", detail: "Reviewing the design, content and mobile experience." },
  { value: "publish", label: "Publishing", detail: "Saving the checked website to preview hosting." },
  { value: "verify", label: "Final verification", detail: "Confirming the hosted preview is reachable." },
];

function elapsed(since: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  if (seconds < 60) return "less than a minute";
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export function BuildProgress({ version, configured, enabled }: { version: FactoryBuildVersion; configured: boolean; enabled: boolean }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const active = version.status === "queued" || version.status === "running";
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, [active, version.id]);
  const index = stages.findIndex(stage => stage.value === version.stage);
  const ready = version.status === "ready", failed = version.status === "failed", queued = version.status === "queued";
  const activity = version.activity?.stage === version.stage ? version.activity : null;
  const headline = ready ? "Your website preview is ready" : failed ? "This build needs attention" : version.status === "cancelled" ? "This build was cancelled" : queued ? index === 0 ? "Approved and in the build queue" : `Next: ${stages[index].label}` : stages[index].label;
  const detail = failed ? version.error || "The build could not finish. Your plan and previous completed websites are preserved." : version.status === "cancelled" ? "The saved plan is still available for review." : queued ? !configured ? "The approved plan is saved. Building waits until preview hosting and the website builder are configured." : !enabled ? "The builder is paused. An administrator can enable it to process approved plans within the spending limits." : index === 0 ? "Waiting for the next worker run. Starting can take a few minutes." : "The previous stage is saved. Waiting for the worker to continue with this step." : activity ? buildActivities[activity.step].label : stages[index].detail;
  return <>
    <div className={`factory-build-headline ${ready ? "is-ready" : ""}`} role="status" aria-live="polite" aria-atomic="true">
      {ready ? <CheckCheck size={23} /> : failed ? <CircleAlert size={23} /> : queued || version.status === "cancelled" ? <Clock3 size={23} /> : <LoaderCircle size={23} className="factory-spin" />}
      <div><h3>{headline}</h3><p>{ready ? <>Checked <LocalTime value={version.readyAt || version.createdAt} />. Open the site or copy its link to share.</> : failed ? factoryBuildRecovery(version.error).summary : detail}</p>{failed && activity ? <p>Stopped during: {buildActivities[activity.step].label.toLowerCase()}.</p> : null}{failed?<details className="factory-error-details"><summary>Error details</summary><p>{detail}</p></details>:null}</div>
    </div>
    {!ready && version.status !== "cancelled" ? <ol className="factory-build-stages" aria-label="Build progress">
      {stages.map((stage, step) => {
        const current = step === index, complete = step < index;
        const state = complete ? "Done" : current ? failed ? "Stopped here" : queued ? "Waiting" : "Working" : "Upcoming";
        return <li key={stage.value} aria-current={current ? "step" : undefined} className={complete ? "is-complete" : current ? `is-current${queued ? " is-waiting" : failed ? " is-failed" : ""}` : ""}>
          <span aria-hidden="true">{complete ? <CheckCheck size={14} /> : current && !queued && !failed ? <LoaderCircle size={14} className="factory-spin" /> : current && failed ? <CircleAlert size={14} /> : step + 1}</span>
          <strong>{stage.label}</strong><small>{state}</small>
        </li>;
      })}
    </ol> : null}
    {active ? <div className="factory-build-updates">
      <div><span><i />Updates automatically</span><small>{now ? <>Since approval: {elapsed(version.createdAt, now)}{version.status === "running" && activity ? <> · Current activity: {elapsed(activity.startedAt, now)}</> : null}</> : "Loading elapsed time…"}</small><small>Last progress saved <LocalTime value={version.updatedAt} />. You can leave this page; progress is saved.</small></div>
      <button type="button" className="factory-button" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "factory-spin" : ""} />{refreshing ? "Refreshing…" : "Refresh status"}</button>
    </div> : null}
  </>;
}
