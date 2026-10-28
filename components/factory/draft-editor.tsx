"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { CheckCheck, LoaderCircle, PencilLine, Plus, RefreshCw, Sparkles, Trash2, Undo2 } from "lucide-react";
import { reviseFactoryDraftAction } from "@/lib/factory/draft-actions";
import type { FactoryActionState } from "@/lib/factory/types";
import type { FactoryDraftDocument } from "@/lib/factory/draft-types";
import type { SiteDraftContent, SiteDraftPatch } from "@/lib/factory/site/draft";
import { sectionLayouts } from "@/lib/factory/site/types";
import { factoryMoney } from "./shared";

const layoutNames: Record<typeof sectionLayouts[number], string> = {
  grid: "Card grid", rows: "Simple rows", split: "Side by side", editorial: "Editorial", timeline: "Steps along a line", band: "Full-width band", showcase: "Showcase", checklist: "Checklist", spotlight: "Spotlight", "feature-list": "Feature list", comparison: "Comparison", "image-grid": "Image grid", alternating: "Alternating sections", "service-tabs": "Service tabs",
};

export function FactoryDraftEditor({ versionId, onQueued, onDirtyChange }: { versionId: string; onQueued: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FactoryDraftDocument | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!open || data) return;
    const abort = new AbortController();
    setError("");
    setData(null);
    void (async () => {
      try {
        const response = await fetch(`/api/dashboard/factory/builds/${versionId}/draft`, { cache: "no-store", signal: abort.signal });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "The saved draft could not be loaded. Please try again.");
        if (!result?.pages?.length || result.versionId !== versionId || typeof result.fingerprint !== "string") throw new Error("The saved draft is unavailable. Refresh the page to check its status.");
        if (!abort.signal.aborted) setData(result);
      } catch (cause) {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "The saved draft could not be loaded.");
      }
    })();
    return () => abort.abort();
  }, [open, reload, versionId, data]);
  return <details className="factory-disclosure factory-draft-editor" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><PencilLine size={15} />Edit this draft</summary>
    {open || data ? <div>
      <p className="factory-build-caption">Refine this website, then check all your changes together. Your approved plan and saved images carry forward.</p>
      {error ? <div role="alert"><p className="factory-form-message is-error">{error}</p><button type="button" className="factory-button" onClick={() => setReload(value => value + 1)}><RefreshCw size={14} />Load draft again</button></div> : !data ? <p className="factory-draft-loading" role="status"><LoaderCircle className="factory-spin" size={15} />Loading saved draft…</p> : <DraftForm key={`${data.versionId}-${data.fingerprint}`} data={data} onQueued={onQueued} onDirtyChange={onDirtyChange} />}
    </div> : null}
  </details>;
}

function DraftForm({ data, onQueued, onDirtyChange }: { data: FactoryDraftDocument; onQueued: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const fieldId = useId();
  const [pagePath, setPagePath] = useState(data.pages[0].path);
  const [sectionId, setSectionId] = useState("__intro__");
  const page = data.pages.find(item => item.path === pagePath) || data.pages[0];
  const section = sectionId === "__intro__" ? undefined : page.sections.find(item => item.id === sectionId);
  const original = section || { title: page.hero.headline, body: page.hero.body, layout: null, items: [] };
  const [headline, setHeadline] = useState(original.title);
  const [body, setBody] = useState(original.body);
  const [layout, setLayout] = useState<string>(original.layout || "");
  const [items, setItems] = useState(original.items.map(item => ({ ...item })));
  const [staged, setStaged] = useState<SiteDraftPatch[]>([]);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [instruction, setInstruction] = useState("");
  const [requestId, setRequestId] = useState("");
  useEffect(() => setRequestId(crypto.randomUUID()), []);
  const sameTarget = (patch: SiteDraftPatch) => patch.target.pagePath === pagePath && patch.target.sectionId === sectionId;
  const savedContent: SiteDraftContent = { headline: original.title, body: original.body, layout: section?.layout ?? null, items: section ? original.items : null };
  const content: SiteDraftContent = { headline, body, layout: section ? layout as NonNullable<SiteDraftContent["layout"]> : null, items: section ? items : null };
  const stagedHere = staged.find(sameTarget);
  const changed = JSON.stringify(content) !== JSON.stringify(savedContent);
  const currentDirty = JSON.stringify(content) !== JSON.stringify(stagedHere?.content ?? savedContent);
  const dirty = currentDirty || Boolean(instruction.trim());
  const patches = staged.filter(patch => !sameTarget(patch));
  if (changed) patches.push({ target: { pagePath, sectionId }, content });
  const batchFull = patches.length > 12;
  const anyEdits = dirty || staged.length > 0;
  useEffect(() => {
    onDirtyChange(anyEdits);
    return () => onDirtyChange(false);
  }, [anyEdits, onDirtyChange]);
  useEffect(() => {
    if (!anyEdits) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyEdits]);
  const [state, action, pending] = useActionState(async (_: FactoryActionState, form: FormData): Promise<FactoryActionState> => {
    try {
      const result = await reviseFactoryDraftAction(_, form);
      if (result.status === "success") onQueued();
      return result;
    } catch {
      return { status: "error", message: "The change could not be confirmed. Refresh to check for a new website version before trying again." };
    }
  }, { status: "idle" });
  function reset(nextPage = page, nextSectionId = sectionId, nextStaged = staged) {
    const nextSection = nextSectionId === "__intro__" ? undefined : nextPage.sections.find(item => item.id === nextSectionId);
    const held = nextStaged.find(patch => patch.target.pagePath === nextPage.path && patch.target.sectionId === nextSectionId)?.content;
    setHeadline(held?.headline ?? nextSection?.title ?? nextPage.hero.headline);
    setBody(held?.body ?? nextSection?.body ?? nextPage.hero.body);
    setLayout(held?.layout ?? nextSection?.layout ?? "");
    setItems((held?.items ?? nextSection?.items ?? []).map(item => ({ ...item })));
    setInstruction("");
    setRequestId(crypto.randomUUID());
  }
  function changeItem(index: number, key: "title" | "body", value: string) {
    setItems(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }
  function patchLabel(patch: SiteDraftPatch) {
    const selectedPage = data.pages.find(item => item.path === patch.target.pagePath)!;
    const part = patch.target.sectionId === "__intro__" ? "Page introduction" : selectedPage.sections.find(item => item.id === patch.target.sectionId)!.title;
    return `${selectedPage.title} · ${part}`;
  }
  function keepChange(form: HTMLFormElement | null) {
    if (!form?.reportValidity() || batchFull) return;
    setStaged(patches);
    setRequestId(crypto.randomUUID());
  }
  function removeChange(patch: SiteDraftPatch) {
    const remaining = staged.filter(item => item !== patch);
    setStaged(remaining);
    if (sameTarget(patch)) reset(page, sectionId, remaining);
    setRequestId(crypto.randomUUID());
  }
  return <>
    <form action={action} aria-label="Edit saved website draft">
      <input type="hidden" name="versionId" value={data.versionId} />
      <input type="hidden" name="fingerprint" value={data.fingerprint} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="pagePath" value={pagePath} />
      <input type="hidden" name="sectionId" value={sectionId} />
      {mode === "manual" ? <input type="hidden" name="patches" value={JSON.stringify(patches)} /> : null}
      {staged.length ? <section className="factory-draft-staged" aria-label="Changes ready to apply">
        <div><strong>{staged.length} {staged.length === 1 ? "part" : "parts"} ready to apply</strong><p>Kept in this editor until you apply. All changes go through one quality review.</p></div>
        <ul>{staged.map(patch => <li key={`${patch.target.pagePath}:${patch.target.sectionId}`}><span>{patchLabel(patch)}</span><div><button type="button" className="factory-button" aria-label={`Edit ${patchLabel(patch)}`} disabled={pending || dirty} onClick={() => { const nextPage = data.pages.find(item => item.path === patch.target.pagePath)!; setPagePath(nextPage.path); setSectionId(patch.target.sectionId); reset(nextPage, patch.target.sectionId); }}><PencilLine size={13} />Edit</button><button type="button" className="factory-button" aria-label={`Remove ${patchLabel(patch)}`} disabled={pending || (sameTarget(patch) && dirty)} onClick={() => removeChange(patch)}><Trash2 size={13} />Remove</button></div></li>)}</ul>
      </section> : null}
      <div className="factory-draft-selection">
        <div className="factory-field"><label htmlFor={`${fieldId}-page`}>Page</label><select id={`${fieldId}-page`} value={pagePath} disabled={pending || dirty} onChange={event => { const next = data.pages.find(item => item.path === event.target.value)!; setPagePath(next.path); setSectionId("__intro__"); reset(next, "__intro__"); }}>{data.pages.map(item => <option key={item.path} value={item.path}>{item.title}</option>)}</select></div>
        <div className="factory-field"><label htmlFor={`${fieldId}-section`}>Part of the page</label><select id={`${fieldId}-section`} value={sectionId} disabled={pending || dirty} onChange={event => { setSectionId(event.target.value); reset(page, event.target.value); }}><option value="__intro__">Page introduction</option>{page.sections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
      </div>
      <div className="factory-draft-mode" aria-label="Editing method">
        <button type="button" aria-pressed={mode === "manual"} disabled={pending || Boolean(instruction.trim())} onClick={() => setMode("manual")}><PencilLine size={14} />Edit text & layout</button>
        <button type="button" aria-pressed={mode === "ai"} disabled={pending || changed || staged.length > 0} onClick={() => setMode("ai")}><Sparkles size={14} />Ask AI to refine</button>
      </div>
      {mode === "manual" ? <div className="factory-draft-fields">
        <div className="factory-field"><label htmlFor={`${fieldId}-headline`}>Headline</label><input id={`${fieldId}-headline`} name="headline" value={headline} onChange={event => setHeadline(event.target.value)} required maxLength={240} disabled={pending} /></div>
        <div className="factory-field"><label htmlFor={`${fieldId}-body`}>Description</label><textarea id={`${fieldId}-body`} name="body" value={body} onChange={event => setBody(event.target.value)} maxLength={1400} rows={3} disabled={pending} /></div>
        {section ? <>
          <div className="factory-field"><label htmlFor={`${fieldId}-layout`}>Section layout</label><select id={`${fieldId}-layout`} name="layout" value={layout} onChange={event => setLayout(event.target.value)} disabled={pending}>{sectionLayouts.map(option => <option key={option} value={option}>{layoutNames[option]}</option>)}</select><small>The new version will be checked on desktop and mobile.</small></div>
          <details className="factory-draft-items"><summary>Section details ({items.length})</summary><div>
            <input type="hidden" name="items" value={JSON.stringify(items)} />
            {items.map((item, index) => <fieldset key={index} className="factory-draft-item"><legend>Detail {index + 1}</legend><div className="factory-field"><label htmlFor={`${fieldId}-item-${index}-title`}>Detail {index + 1} title</label><input id={`${fieldId}-item-${index}-title`} value={item.title} onChange={event => changeItem(index, "title", event.target.value)} required maxLength={180} disabled={pending} /></div><div className="factory-field"><label htmlFor={`${fieldId}-item-${index}-body`}>Detail {index + 1} description</label><textarea id={`${fieldId}-item-${index}-body`} value={item.body} onChange={event => changeItem(index, "body", event.target.value)} rows={2} maxLength={1400} disabled={pending} /></div><button type="button" className="factory-button" onClick={() => setItems(previous => previous.filter((_, itemIndex) => itemIndex !== index))} disabled={pending}><Trash2 size={14} />Remove detail {index + 1}</button></fieldset>)}
            {items.length < 8 ? <button type="button" className="factory-button" onClick={() => setItems(previous => [...previous, { title: "", body: "" }])} disabled={pending}><Plus size={14} />Add detail</button> : null}
          </div></details>
        </> : null}
        {changed ? <details className="factory-draft-diff" open><summary>Review your changes</summary><div className="factory-draft-comparison"><DraftCopy title="Saved draft" headline={original.title} body={original.body} layout={original.layout} items={original.items} /><DraftCopy title="Your changes" headline={headline} body={body} layout={layout} items={items} /></div></details> : null}
      </div> : <div className="factory-field"><label htmlFor={`${fieldId}-instruction`}>What should change in this part?</label><textarea id={`${fieldId}-instruction`} name="instruction" value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="Make this introduction shorter and more inviting. Keep the contact details and existing form." required maxLength={2000} rows={3} disabled={pending} /><small>AI refines this selected part using the saved design and review evidence.</small></div>}
      <p className="factory-draft-cost">Saved images are reused. AI refinements and quality checks use the remaining {factoryMoney(Math.max(0, data.remainingMicros))} build allowance.</p>
      <div className="factory-draft-actions"><button className="factory-button is-primary" disabled={pending || !requestId || (mode === "manual" ? !patches.length || batchFull : !instruction.trim())}>{pending ? <LoaderCircle size={15} className="factory-spin" /> : <CheckCheck size={15} />}{pending ? "Queuing changes…" : "Apply changes & check"}</button>{mode === "manual" && currentDirty ? <button type="button" className="factory-button" onClick={event => keepChange(event.currentTarget.form)} disabled={pending || batchFull}><Plus size={14} />Keep this change</button> : null}{dirty ? <button type="button" className="factory-button" onClick={() => reset()} disabled={pending}><Undo2 size={14} />Discard edits</button> : null}</div>
      {batchFull ? <p className="factory-form-message is-error" role="alert">You can apply up to 12 parts together. Remove a kept change or discard this edit to continue.</p> : mode === "manual" && dirty ? <p className="factory-build-caption">Apply now, or keep this change to edit another part first. Apply includes this part and any kept changes.</p> : mode === "ai" && dirty ? <p className="factory-build-caption">Apply or discard your request before choosing another part.</p> : null}
      {mode === "manual" && staged.length > 0 ? <p className="factory-build-caption">{patches.length} {patches.length === 1 ? "part" : "parts"} will be applied together. Keeping changes does not use AI or start a build.</p> : null}
      {state.message ? <p className={`factory-form-message is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </form>
    {data.parentVersionId ? <RestoreDraft data={data} disabled={pending || anyEdits} onQueued={onQueued} /> : null}
    <p className="factory-build-caption">Previous versions stay in Website version above. A revision must pass the checks before its sharing link becomes available.</p>
  </>;
}

function DraftCopy({ title, headline, body, layout, items }: { title: string; headline: string; body: string; layout: string | null; items: Array<{ title: string; body: string }> }) {
  return <section className="factory-draft-copy" aria-label={title}><h4>{title}</h4><strong>{headline || "(Empty headline)"}</strong><p>{body || "(No description)"}</p>{layout ? <small>Layout: {layoutNames[layout as keyof typeof layoutNames] || layout}</small> : null}{items.length ? <ul>{items.map((item, index) => <li key={index}><strong>{item.title || "(Empty title)"}</strong>{item.body ? <p>{item.body}</p> : null}</li>)}</ul> : null}</section>;
}

function RestoreDraft({ data, disabled, onQueued }: { data: FactoryDraftDocument; disabled: boolean; onQueued: () => void }) {
  const [requestId, setRequestId] = useState("");
  useEffect(() => setRequestId(crypto.randomUUID()), []);
  const [state, action, pending] = useActionState(async (_: FactoryActionState, form: FormData): Promise<FactoryActionState> => {
    try { const result = await reviseFactoryDraftAction(_, form); if (result.status === "success") onQueued(); return result; }
    catch { return { status: "error", message: "The restore could not be confirmed. Refresh to check the website versions before trying again." }; }
  }, { status: "idle" });
  return <details className="factory-draft-restore"><summary>Undo the last saved revision</summary><div><p className="factory-build-caption">Restore the previous saved draft as a new version and run its checks. Earlier charges remain in the build allowance.</p><form action={action}><input type="hidden" name="versionId" value={data.versionId} /><input type="hidden" name="fingerprint" value={data.fingerprint} /><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="mode" value="restore" /><button className="factory-button" disabled={disabled || pending || !requestId}>{pending ? <LoaderCircle size={14} className="factory-spin" /> : <Undo2 size={14} />}{pending ? "Restoring…" : "Restore previous draft"}</button>{state.message ? <p className={`factory-form-message is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}</form></div></details>;
}
