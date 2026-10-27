"use client";

import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, CircleAlert, Copy, Download, ExternalLink, Globe2, ImagePlus, LoaderCircle, Monitor, RefreshCw, Settings2, ShieldCheck, Smartphone, Trash2, Unplug } from "lucide-react";
import { LocalTime } from "@/components/sales/date-time-field";
import { retryFactoryBuildAction, revokeFactoryPreviewAction, restoreFactoryPreviewAction, saveFactoryBuildSettingsAction, deleteFactoryUploadAction } from "@/lib/factory/build-actions";
import type { FactoryActionState } from "@/lib/factory/types";
import type { FactoryBuildVersion, FactoryProjectBuilds, FactoryUpload } from "@/lib/factory/build-types";
import { factoryMoney } from "./shared";
import { BuildProgress } from "./build-progress";
import { FactoryDraftEditor } from "./draft-editor";
import { factoryBuildRecovery } from "@/lib/factory/workflow";

type SettingsView = Omit<FactoryProjectBuilds, "versions" | "uploads">;

export function FactoryBuildPanel({ data, actorId }: { data: FactoryProjectBuilds; actorId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const versions = [...data.versions].sort((a, b) => b.version - a.version);
  const selected = versions.find((v) => v.id === selectedId) || versions[0];
  if (!selected) return null;
  const ready = selected.status === "ready";
  const isLatestVersion = selected.id === versions[0].id;
  const canEditDraft = data.canEdit && isLatestVersion && Boolean(selected.draftAvailable) && (selected.status === "failed" || selected.status === "ready");
  const available = ready && Boolean(selected.previewUrl) && !selected.revokedAt && Date.parse(selected.expiresAt) > Date.now();
  const previous = versions.find((v) => v.id !== selected.id && v.status === "ready" && v.previewUrl && !v.revokedAt && Date.parse(v.expiresAt) > Date.now());
  return <section className="factory-panel factory-build-panel" aria-label="Website build"><header className="factory-panel-heading"><div><h2><Globe2 size={18} />Website preview</h2><p>Website v{selected.version} · approved plan v{selected.planVersion}</p></div>{versions.length > 1 ? <select aria-label="Website version" value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setCopied(""); }}>{versions.map((version) => <option key={version.id} value={version.id}>Website v{version.version} · {version.status}</option>)}</select> : <span className={`factory-status ${ready ? "is-approved" : selected.status === "failed" ? "is-error" : "is-working"}`}><i />{ready ? "Checked & ready" : selected.status === "running" ? "Building" : selected.status === "queued" ? "Queued" : selected.status === "failed" ? "Needs attention" : "Cancelled"}</span>}</header><div className="factory-build-content"><BuildProgress key={selected.id} version={selected} configured={data.config.configured} enabled={data.settings.enabled} editableDraft={canEditDraft} />
      {ready ? <><div className="factory-build-actions">{available ? <><a className="factory-button is-primary" href={selected.previewUrl!} target="_blank" rel="noreferrer">Open website<ExternalLink size={15}/></a><button type="button" className="factory-button" onClick={async()=>{try{await navigator.clipboard.writeText(selected.previewUrl!);setCopied("Preview link copied.");}catch{setCopied("Could not copy the link. Open the website and copy its address.");}}}><Copy size={15}/>Copy preview link</button></>:<div className="factory-preview-off"><Unplug size={17}/><span>{selected.revokedAt?"Preview sharing is turned off.":Date.parse(selected.expiresAt)<=Date.now()?"The preview sharing link has expired.":"Preview hosting is currently unavailable."}</span></div>}</div>{copied?<p className="factory-form-message" role="status">{copied}</p>:null}
      {selected.qaReport?<div className="factory-build-screenshots"><BuildScreenshot key={`${selected.id}-desktop`} id={selected.id} view="desktop"/><BuildScreenshot key={`${selected.id}-mobile`} id={selected.id} view="mobile"/></div>:null}
      <details className="factory-disclosure"><summary>Download source & sharing options</summary><div>{selected.sourceReady?<a className="factory-button" href={`/api/dashboard/factory/builds/${selected.id}/source`}><Download size={15}/>Download source ZIP</a>:null}<p className="factory-build-caption">{available?<>Anyone with the preview link can view this demo. Sharing expires <LocalTime value={selected.expiresAt} dateOnly/>.</>:"Turning off sharing keeps your saved website and source files."} Production forms and integrations are listed in the handoff notes.</p>{data.canEdit?<div className="factory-preview-controls">{available?<VersionAction version={selected} actorId={actorId} action={revokeFactoryPreviewAction} label="Turn off preview sharing"/>:selected.revokedAt||Date.parse(selected.expiresAt)<=Date.now()?<VersionAction version={selected} actorId={actorId} action={restoreFactoryPreviewAction} label="Renew preview sharing"/>:null}</div>:null}</div></details></>:null}
      {isLatestVersion && selected.status === "failed" && data.canEdit && factoryBuildRecovery(selected.error,selected.reviewAttempts).kind === "retry" ? <div className="factory-build-retry"><VersionAction version={selected} actorId={actorId} action={retryFactoryBuildAction} label="Retry website build" retry disabled={!data.settings.enabled || !data.config.configured} /><p>A retry can use more of the build allowance. Previous charges remain included.</p>{!data.settings.enabled || !data.config.configured ? <Link href="/dashboard/sales/factory/settings#build-settings">Review builder settings</Link> : null}</div> : null}
      {selected.status === "failed" && selected.failedQa ? <BuildFailureEvidence key={`${selected.id}-${selected.failedQa.checkedAt}`} version={selected} /> : null}
      {canEditDraft ? <FactoryDraftEditor key={`${selected.id}-${selected.updatedAt}`} versionId={selected.id} onQueued={() => setSelectedId(null)} /> : null}
      {isLatestVersion && selected.status === "failed" && data.canManage && factoryBuildRecovery(selected.error,selected.reviewAttempts).kind === "help" ? <details className="factory-disclosure"><summary>Administrator recovery</summary><div><p>Review the error and resolve its cause before retrying. The saved website is rechecked within its remaining review and spending limits; this does not reset earlier charges or add another correction.</p>{selected.retryCount>=3?<p>This version has used its three recovery attempts. Review and approve a revised plan to continue.</p>:<VersionAction version={selected} actorId={actorId} action={retryFactoryBuildAction} label="Retry after technical fix" retry disabled={!data.settings.enabled || !data.config.configured}/>}</div></details> : null}
      {!ready && previous ? <a className="factory-button" href={previous.previewUrl!} target="_blank" rel="noreferrer">Open last working preview<ExternalLink size={15} /></a> : null}
    </div>{selected.qaReport ? <details className="factory-disclosure"><summary><ShieldCheck size={15} />Quality checks & handoff notes</summary><div>{selected.qaReport.designReview ? <p className="factory-build-caption">{selected.qaReport.designReview.summary} Desktop and mobile designs reviewed across {selected.qaReport.designReview.reviewedPages.length} pages.</p> : null}<BuildQualitySummary version={selected} /><ul className="factory-list">{selected.qaReport.checks.map((check, index) => <li key={index}>{check}</li>)}</ul>{selected.qaReport.warnings.length ? <><h4>Review before delivery</h4><ul className="factory-list">{selected.qaReport.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></> : null}</div></details> : null}</section>;
}

function BuildQualitySummary({ version }: { version: FactoryBuildVersion }) {
  const review = version.qaReport?.designReview;
  if (!review?.scorecard || review.overallScore === undefined) return null;
  const dimensions = [["firstImpression", "First impression"], ["composition", "Layout & typography"], ["imagery", "Imagery"], ["copy", "Writing"], ["usefulness", "Business usefulness"], ["mobile", "Mobile presentation"]] as const;
  const weakest = [...dimensions].sort((a, b) => review.scorecard![a[0]].score - review.scorecard![b[0]].score)[0];
  return <div className="factory-quality-summary"><p><strong>AI design assessment · {review.overallScore}/100</strong></p><p className="factory-build-caption">A model's assessment of the rendered pages. Review the actual website before sharing it with a client.</p><ul className="factory-list">{dimensions.map(([key, label]) => <li key={key}>{label}: <strong>{review.scorecard![key].score}/100</strong></li>)}</ul><p className="factory-build-caption"><strong>Suggested refinement:</strong> {review.scorecard[weakest[0]].improvement}</p>{version.qaReport?.labPerformance?.length ? <p className="factory-build-caption">Performance was checked in an isolated local browser. These checks do not measure a customer's connection or real-world loading time.</p> : null}</div>;
}

function pageLabel(path: string) {
  if (path === "index.html" || path === "/") return "Home";
  return path.replace(/\/index\.html$|\.html$/g, "").split("/").filter(Boolean).map(part => part.replace(/[-_]/g, " ").replace(/^./, char => char.toUpperCase())).join(" / ") || "Home";
}

function BuildFailureEvidence({ version }: { version: FactoryBuildVersion }) {
  const evidence = version.failedQa!;
  const fieldId = useId();
  const shots = evidence.pageScreenshots || [];
  const availablePages = Array.from(new Set(shots.map(shot => shot.page)));
  const issuePages = evidence.issues.map(issue => issue.page).filter(page => availablePages.includes(page));
  const pages = Array.from(new Set([...issuePages, ...availablePages]));
  const [selectedPage, setSelectedPage] = useState(pages[0] || "index.html");
  const currentPage = pages.includes(selectedPage) ? selectedPage : pages[0] || "index.html";
  const currentIssues = evidence.issues.filter(issue => issue.page === currentPage);
  const otherIssues = evidence.issues.filter(issue => issue.page !== currentPage);
  return <details className="factory-disclosure"><summary>Failed quality checks & screenshots</summary><div>
    <p className="factory-build-caption">Private review evidence from <LocalTime value={evidence.checkedAt} />. This version has not been published.</p>
    {pages.length ? <div className="factory-field factory-evidence-page"><label htmlFor={`${fieldId}-page`}>Page to inspect</label><select id={`${fieldId}-page`} value={currentPage} onChange={event => setSelectedPage(event.target.value)}>{pages.map(page => <option key={page} value={page}>{pageLabel(page)}{evidence.issues.some(issue => issue.page === page) ? " · Needs attention" : ""}</option>)}</select></div> : null}
    {currentIssues.length ? <ul className="factory-list factory-evidence-issues">{currentIssues.map((issue, index) => <li key={index}><strong>{pageLabel(issue.page)}{issue.viewport ? ` · ${issue.viewport}` : ""}:</strong> {issue.message}</li>)}</ul> : pages.length ? <p className="factory-build-caption">No page-specific issues were recorded for this page.</p> : null}
    <div className="factory-build-screenshots">{(["desktop", "mobile"] as const).map(view => shots.some(shot => shot.page === currentPage && shot.viewport === view) ? <BuildScreenshot key={`${version.id}-${currentPage}-${view}-${evidence.checkedAt}`} id={version.id} view={view} page={currentPage} /> : !pages.length && evidence.screenshots[view] ? <BuildScreenshot key={`${version.id}-legacy-${view}-${evidence.checkedAt}`} id={version.id} view={view} pageTitle="Home" /> : <p className="factory-shot-fallback" key={view}>{view === "desktop" ? "Desktop" : "Mobile"} screenshot unavailable for this check.</p>)}</div>
    {!pages.length ? <p className="factory-build-caption">This older check saved Home screenshots only. The issues below may refer to other pages.</p> : null}
    {otherIssues.length ? <details className="factory-evidence-other" open={!pages.length}><summary>{pages.length ? "Issues on other pages" : "Other recorded issues"} ({otherIssues.length})</summary><ul className="factory-list">{otherIssues.map((issue, index) => <li key={index}><strong>{pageLabel(issue.page)}{issue.viewport ? ` · ${issue.viewport}` : ""}:</strong> {issue.message}</li>)}</ul></details> : null}
  </div></details>;
}

function BuildScreenshot({ id, view, page, pageTitle }: { id: string; view: "desktop" | "mobile"; page?: string; pageTitle?: string }) {
  const [failed, setFailed] = useState(false);
  const source = `/api/dashboard/factory/builds/${id}/screenshot?view=${view}${page ? `&page=${encodeURIComponent(page)}` : ""}`;
  const label = page ? pageLabel(page) : pageTitle;
  return <figure className={`factory-build-shot is-${view}`}><figcaption>{view === "desktop" ? <Monitor size={14} /> : <Smartphone size={14} />}{label ? `${label} · ` : ""}{view === "desktop" ? "Desktop check" : "Mobile check"}</figcaption>{failed ? <div className="factory-shot-fallback">Screenshot unavailable.</div> : <a href={source} target="_blank" rel="noreferrer"><img src={source} alt={`${label ? `${label} · ` : ""}${view === "desktop" ? "Desktop" : "Mobile"} preview of website version`} loading="lazy" onError={() => setFailed(true)} /></a>}</figure>;
}

function VersionAction({ version, actorId, action, label, retry = false, disabled = false }: { version: FactoryBuildVersion; actorId: string; action: (previous: FactoryActionState, form: FormData) => Promise<FactoryActionState>; label: string; retry?: boolean; disabled?: boolean }) {
  const [requestId, setRequestId] = useState("");
  useEffect(() => { const key = `factory-build-retry:${actorId}:${version.id}:${version.retryCount}`; let id = ""; try { id = sessionStorage.getItem(key) || ""; } catch {} if (!id) id = crypto.randomUUID(); try { sessionStorage.setItem(key, id); } catch {} setRequestId(id); }, [actorId, version.id, version.retryCount]);
  const [state, formAction, pending] = useActionState(async (previous: FactoryActionState, form: FormData) => { try { return await action(previous, form); } catch { return { status: "error", message: "The change could not be confirmed. Refresh to check the saved status before trying again." } as FactoryActionState; } }, { status: "idle" });
  return <form action={formAction}><input type="hidden" name="versionId" value={version.id} /><input type="hidden" name="requestId" value={requestId} /><button className="factory-button" disabled={disabled || pending || (retry && !requestId)}>{pending ? <LoaderCircle className="factory-spin" size={14} /> : retry ? <RefreshCw size={14} /> : null}{pending ? "Saving…" : label}</button>{state.message ? <p className={`factory-form-message is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}</form>;
}

export function FactoryBuildSettingsPanel({ data }: { data: SettingsView }) {
  return <section className="factory-panel" id="build-settings"><header className="factory-panel-heading"><h2><Settings2 size={17} />Website builder</h2></header>{data.canManage ? <BuildSettingsForm data={data} /> : <div className="factory-settings-copy"><p><strong>{data.settings.enabled && data.config.configured ? "Builder enabled" : "Builder paused or awaiting setup"}</strong></p><p>Only approved plans enter the build queue. An owner or administrator manages building and its spending limits.</p></div>}</section>;
}

function BuildSettingsForm({ data }: { data: SettingsView }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(async (previous: FactoryActionState, form: FormData) => { try { return await saveFactoryBuildSettingsAction(previous, form); } catch { return { status: "error", message: "Builder settings could not be saved. Please try again." } as FactoryActionState; } }, { status: "idle" });
  return <form className="factory-settings" action={action} aria-label="Website builder settings"><p>Enabling the builder processes waiting human-approved plans. These amounts are spending ceilings, not an estimate or a charge per website.</p>{!data.config.configured ? <div className="factory-builder-setup"><CircleAlert size={17} /><span>{data.config.reason || "Preview hosting and the build worker need to be configured before building can start."}</span></div> : null}<div className="factory-check"><input id={`${fieldId}-enabled`} aria-describedby={`${fieldId}-enabled-help`} type="checkbox" name="enabled" defaultChecked={data.settings.enabled && data.config.configured} disabled={pending || !data.config.configured} /><span><label htmlFor={`${fieldId}-enabled`}>Enable website building</label><small id={`${fieldId}-enabled-help`}>Approval is always required. Research alone never builds a site.</small></span></div><div className="factory-field"><label htmlFor={`${fieldId}-monthly`}>Monthly build limit (USD)</label><input id={`${fieldId}-monthly`} type="number" min={1} max={1000} step="0.01" name="monthlyBudgetDollars" required defaultValue={data.settings.monthlyBudgetMicros / 1_000_000} disabled={pending} /></div><div className="factory-field" style={{ marginTop: ".9rem" }}><label htmlFor={`${fieldId}-site`}>Per-website limit (USD)</label><input id={`${fieldId}-site`} aria-describedby={`${fieldId}-site-help`} type="number" min={1} max={100} step="0.01" name="perBuildBudgetDollars" required defaultValue={data.settings.perBuildBudgetMicros / 1_000_000} disabled={pending} /><small id={`${fieldId}-site-help`}>{factoryMoney(data.monthSpentMicros)} estimated or reserved this month. Research has its own limit above.</small></div><button className="factory-button is-primary" disabled={pending}>{pending ? <LoaderCircle size={15} className="factory-spin" /> : <Settings2 size={15} />}{pending ? "Saving…" : "Save builder settings"}</button>{state.message ? <p className={`factory-form-message is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}</form>;
}

export function FactoryAssetsPanel({ data, projectId }: { data: FactoryProjectBuilds; projectId: string }) {
  const fieldId = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [role, setRole] = useState<"photo" | "logo">("photo");
  const full = data.uploads.length >= 20;
  const hasLogo = data.uploads.some(upload => upload.role === "logo");
  return <section className="factory-panel"><header className="factory-panel-heading"><div><h2><ImagePlus size={17} />Logo & photos</h2><p>Optional assets help the website feel like this business.</p></div></header>
    <div className="factory-assets-content">
      {data.uploads.length ? <ul className="factory-upload-list">{data.uploads.map((upload) => <li key={upload.id}><ImagePlus size={17} /><div><strong>{upload.filename}</strong><small>{upload.role === "logo" ? "Business logo" : "Business photo"} · {Math.ceil(upload.byteSize / 1024).toLocaleString()} KB · <LocalTime value={upload.createdAt} dateOnly /></small>{upload.alt ? <small>{upload.alt}</small> : null}</div>{data.canEdit ? <RemoveUpload upload={upload} /> : <CheckCheck size={15} />}</li>)}</ul> : <p>No assets added yet. You can continue without them; the builder can create illustrative imagery.</p>}
      {data.canEdit ? <form aria-label="Upload logo or photo" onSubmit={async (event) => {
        event.preventDefault(); const form = event.currentTarget; const input = new FormData(form); const file = input.get("file");
        if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) { setFailed(true); setMessage("Choose a PNG, JPEG, or WebP image under 5 MB."); return; }
        setPending(true); setMessage(""); setFailed(false);
        try {
          const response = await fetch(`/api/dashboard/factory/projects/${projectId}/uploads`, { method: "POST", body: input });
          const result = await response.json().catch(() => null);
          if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "The image could not be saved. Please try again.");
          setMessage("Asset saved for the next approved website version."); form.reset(); setRole("photo"); router.refresh();
        } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "The image could not be saved."); } finally { setPending(false); }
      }}>
        <div className="factory-field"><label htmlFor={`${fieldId}-role`}>Image type</label><select id={`${fieldId}-role`} name="role" value={role} onChange={event => setRole(event.target.value as "photo" | "logo")} disabled={pending || full}><option value="photo">Business photo</option><option value="logo" disabled={hasLogo}>Business logo{hasLogo ? " — already added" : ""}</option></select></div>
        <div className="factory-field"><label htmlFor={`${fieldId}-image`}>{role === "logo" ? "Choose a logo" : "Choose a photo"}</label><input id={`${fieldId}-image`} type="file" accept="image/png,image/jpeg,image/webp" name="file" required disabled={pending || full} aria-describedby={`${fieldId}-image-help`} /><small id={`${fieldId}-image-help`}>PNG, JPEG, or WebP, up to 5 MB each. Transparent PNG works well for logos. Only add images you have permission to use. The first photo you upload supplies the main visual; the builder can select more photos for other sections.</small></div>
        <div className="factory-field"><label htmlFor={`${fieldId}-alt`}>What's in this image? <span>(optional)</span></label><input id={`${fieldId}-alt`} name="alt" maxLength={240} placeholder={role === "logo" ? "Company logo" : "Our team installing a cooling system"} disabled={pending || full} /><small>Helps the builder place it correctly and describe it accessibly.</small></div>
        <p className="factory-build-caption">Assets are saved with your next approval. Uploads do not change a website that is already approved or built.</p>
        <button className="factory-button" disabled={pending || full || (role === "logo" && hasLogo)}>{pending ? <LoaderCircle size={15} className="factory-spin" /> : <ImagePlus size={15} />}{pending ? "Uploading…" : full ? "Upload allowance reached" : "Add image"}</button>
      </form> : null}
      {message ? <p className={`factory-form-message ${failed ? "is-error" : ""}`} role={failed ? "alert" : "status"}>{message}</p> : null}
    </div>
  </section>;
}

function RemoveUpload({ upload }: { upload: FactoryUpload }) {
  const [state, action, pending] = useActionState(async (previous: FactoryActionState, form: FormData) => {
    try { return await deleteFactoryUploadAction(previous, form); }
    catch { return { status: "error", message: "The image could not be removed. Please refresh before trying again." } as FactoryActionState; }
  }, { status: "idle" });
  return <form action={action}><input type="hidden" name="uploadId" value={upload.id} /><button className="factory-button" disabled={pending} aria-label={`Remove ${upload.filename} from future builds`}>{pending ? <LoaderCircle size={14} className="factory-spin" /> : <Trash2 size={14} />}</button>{state.status === "error" ? <p className="factory-form-message is-error" role="alert">{state.message}</p> : null}</form>;
}
