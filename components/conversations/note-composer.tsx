"use client";

import { LockKeyhole } from "lucide-react";
import { addConversationNoteAction } from "@/lib/conversations/actions";
import type { ConversationSource } from "@/lib/conversations/types";
import { ConversationActionForm } from "./action-form";
import { sourceChannelLabels } from "./shared";

export function ConversationNoteComposer({ conversationId, sources, readOnly }: { conversationId: string; sources: ConversationSource[]; readOnly: boolean }) {
  return <section className="conversation-note-composer" aria-labelledby="conversation-note-title"><div className="conversation-composer-heading"><h3 id="conversation-note-title">Internal note</h3><span><LockKeyhole size={14} aria-hidden="true" />Never sent to the customer</span></div>
    <ConversationActionForm action={addConversationNoteAction} label="Add internal note" disabled={readOnly || sources.length === 0} resetOnSuccess>
      <input type="hidden" name="conversationId" value={conversationId} />
      <label className="conversation-field"><span>Visible to teammates with access to</span><select name="audienceSourceId" required defaultValue={sources[0]?.id || ""}>{sources.map((source) => <option key={source.id} value={source.id}>{sourceChannelLabels[source.channel]} · {source.label}</option>)}</select><small>Notes keep the same access boundary as the selected email address, SMS number or calling line.</small></label>
      <label className="conversation-field"><span>Note *</span><textarea name="body" required maxLength={20000} placeholder="Add useful context, a handoff, or the agreed next step…" rows={3} /></label>
    </ConversationActionForm>{readOnly ? <p className="conversation-muted">Your dashboard access is read-only.</p> : null}
  </section>;
}
