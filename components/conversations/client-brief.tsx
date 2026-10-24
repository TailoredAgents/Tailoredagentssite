"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Brain, Check, Pencil, Plus, X } from "lucide-react";
import { InboxTime } from "@/components/inbox/time";
import type { ConversationRecord } from "@/lib/conversations/types";
import { memoryLabels, type ClientMemory } from "@/lib/conversations/memory-types";
import { saveClientMemoryAction } from "@/lib/conversations/memory-actions";

export function ClientBrief({ record, readOnly }: { record: ConversationRecord; readOnly: boolean }) {
  const items = record.clientMemory || [];
  const [editing, setEditing] = useState<ClientMemory | "new" | null>(null);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ClientMemory["category"]>("context");
  const [sourceId, setSourceId] = useState(record.sources[0]?.id || "");
  const [useInDrafts, setUseInDrafts] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function edit(item: ClientMemory | "new") {
    setEditing(item); setError("");
    setText(item === "new" ? "" : item.text);
    setCategory(item === "new" ? "context" : item.category);
    setSourceId(item === "new" ? record.sources[0]?.id || "" : item.sourceId);
    setUseInDrafts(item === "new" ? false : item.useInDrafts);
  }
  function save(dismiss = false) {
    if (!editing || pending) return;
    const item = editing;
    setError("");
    startTransition(async () => {
      try {
        const result = await saveClientMemoryAction({ sourceId, category, text, useInDrafts, dismiss,
          ...(item === "new" ? {} : { id: item.id, revision: item.revision }),
        });
        if ("error" in result) setError(result.error!);
        else { setEditing(null); }
      } catch { setError("Could not save the brief. Your edit is still here."); }
    });
  }
  return <section className="conversation-context-section client-brief" aria-label="Client brief" aria-busy={pending}>
    <div className="client-brief-heading"><h3><Brain size={16} aria-hidden="true" />Client brief</h3>{!readOnly && !editing ? <button type="button" className="conversation-icon-button" aria-label="Add client fact" onClick={() => edit("new")}><Plus size={15} aria-hidden="true" /></button> : null}</div>
    <p className="conversation-muted">Useful details remembered from analyzed calls and AI message suggestions. Review them as plans change.</p>
    {!items.length ? <p className="client-brief-empty">No saved facts yet. Add a preference or project detail to help the team prepare.</p> : <ul className="client-brief-list">{(expanded ? items : items.slice(0, 5)).map(item => <li key={item.id}>
      <div className="client-brief-label"><span>{memoryLabels[item.category]}</span>{!readOnly ? <button type="button" aria-label={`Edit fact: ${item.text.slice(0, 50)}`} disabled={pending} onClick={() => edit(item)}><Pencil size={13} aria-hidden="true" /></button> : null}</div>
      <p>{item.text}</p>
      <div className="client-brief-meta"><span>{item.origin === "team" ? "Team note" : item.channel === "call" ? "Call takeaway" : "AI suggested"}{item.edited ? " · Edited" : ""}</span><InboxTime value={item.occurredAt} short /></div>
      <span className="client-brief-visibility">{item.useInDrafts ? "Used in message suggestions" : "Internal only"}</span>
      {item.quote ? <details className="client-brief-evidence"><summary>Source evidence</summary><blockquote>{item.quote}</blockquote><Link href={`/dashboard/inbox?view=team&conversation=${item.conversationId}`}>Open conversation</Link></details> : null}
    </li>)}</ul>}
    {items.length > 5 ? <button className="conversation-text-link" type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : `Show all ${items.length} facts`}</button> : null}
    {editing ? <form className="client-brief-editor" onSubmit={event => { event.preventDefault(); save(); }}>
      <div className="client-brief-heading"><strong>{editing === "new" ? "Add a fact" : "Edit remembered fact"}</strong><button className="conversation-icon-button" type="button" aria-label="Cancel fact edit" disabled={pending} onClick={() => setEditing(null)}><X size={15} aria-hidden="true" /></button></div>
      <fieldset disabled={pending}>
        {editing === "new" && record.sources.length > 1 ? <label className="conversation-field"><span>Share with readers of</span><select aria-label="Fact audience" value={sourceId} onChange={e => setSourceId(e.target.value)}>{record.sources.map(source => <option key={source.id} value={source.id}>{source.channel.toUpperCase()} · {source.label}</option>)}</select></label> : null}
        <label className="conversation-field"><span>Type</span><select value={category} onChange={e => setCategory(e.target.value as ClientMemory["category"])}>{Object.entries(memoryLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="conversation-field"><span>Remembered detail</span><textarea aria-label="Remembered detail" autoFocus rows={4} maxLength={1200} required value={text} onChange={e => setText(e.target.value)} placeholder="Prefers a short text before scheduling a call…" /></label>
        <label className="conversation-checkbox"><input type="checkbox" checked={useInDrafts} onChange={e => setUseInDrafts(e.target.checked)} /><span>Use in client message suggestions</span></label>
        <div className="client-brief-buttons"><button className="conversation-button" type="submit"><Check size={14} aria-hidden="true" />{pending ? "Saving…" : "Save fact"}</button>{editing !== "new" ? <button className="conversation-text-link" type="button" onClick={() => save(true)}>Remove fact</button> : null}</div>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
    </form> : null}
  </section>;
}
