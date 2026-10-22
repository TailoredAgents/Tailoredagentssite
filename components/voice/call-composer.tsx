"use client";

import Link from "next/link";
import { useState } from "react";
import { Headphones, LoaderCircle, Phone, ShieldCheck } from "lucide-react";
import type { ConversationRecord } from "@/lib/conversations/types";
import { useBrowserPhone } from "./phone-provider";

export function VoiceCallComposer({ record }: { record: ConversationRecord }) {
  const phone = useBrowserPhone();
  const targets = [...new Set(record.sources.flatMap((source) => source.externalAddresses).filter((value) => /^\+?[\d\s().-]{7,}$/.test(value)))];
  const [to, setTo] = useState(targets[0] || "");
  const line = phone.workspace.lines.find((item) => item.id === phone.lineId);
  const ready = phone.connection === "ready" && Boolean(line?.canCall) && line?.status === "active" && phone.workspace.state === "ready";
  const busy = phone.phase !== "idle";
  const canConnect = phone.workspace.state === "ready" && Boolean(line && (line.canCall || line.canReceive)) && !phone.readOnly && phone.supported !== false;
  return <section className="voice-call-composer" aria-labelledby="voice-call-title"><div className="voice-composer-heading"><h3 id="voice-call-title"><Headphones size={16} aria-hidden="true" />Call {record.conversation.personName}</h3><span>Browser audio</span></div>
    {phone.workspace.state !== "ready" ? <div className="voice-setup-notice"><p>{phone.workspace.message}</p><Link href="/dashboard/settings#calling">Review calling setup</Link></div> : <form aria-label="Start browser call" onSubmit={(event) => { event.preventDefault(); if (ready && !busy && to.trim()) void phone.startCall({ lineId: phone.lineId, to: to.trim(), conversationId: record.conversation.id, name: record.conversation.personName }); }}>
      <fieldset disabled={phone.readOnly || busy || phone.connection === "connecting"}><div className="voice-call-from"><span>From</span><strong>{line?.phone || "No approved line"}</strong>{phone.workspace.lines.length > 1 ? <button type="button" className="voice-text-button" onClick={() => phone.setExpanded(true)}>Change calling line</button> : null}</div><label className="voice-field voice-call-line-field"><span>Calling line</span><select value={phone.lineId} onChange={(event) => phone.setLineId(event.target.value)}>{phone.workspace.lines.map((item) => <option key={item.id} value={item.id}>{item.phone}{item.status === "paused" ? " · Paused" : ""}{!item.canCall ? " · Outbound access required" : ""}</option>)}</select></label><label className="voice-field"><span>Customer phone *</span><input type="tel" required value={to} onChange={(event) => setTo(event.target.value)} list="voice-customer-phones" maxLength={50} autoComplete="tel" placeholder="+1 678 555 0123" /><datalist id="voice-customer-phones">{targets.map((target) => <option key={target} value={target} />)}</datalist></label></fieldset>
      {phone.readOnly ? <p className="voice-phone-help">Your dashboard access is read-only.</p> : !line?.canCall ? <p className="voice-phone-help">Outbound calling requires an explicit call grant for this line.</p> : null}
      {phone.supported === false ? <p className="voice-phone-help">Browser calling is unavailable in this browser. Call history and voicemail remain available.</p> : null}
      {phone.error && !phone.expanded ? <p className="voice-feedback is-error" role="alert">{phone.error}</p> : null}
      <div className="voice-call-actions">{phone.connection !== "ready" && canConnect ? <button type="button" className="voice-button" disabled={phone.connection === "connecting" || busy || line?.status !== "active"} onClick={() => void phone.connectPhone(undefined, false)}>{phone.connection === "connecting" ? <LoaderCircle size={16} className="signin-spinner" aria-hidden="true" /> : <Phone size={16} aria-hidden="true" />}{phone.connection === "connecting" ? "Connecting…" : "Connect phone"}</button> : null}{ready && !phone.readOnly ? <button type="submit" className="voice-button is-primary" disabled={busy || !to.trim()}><Phone size={16} aria-hidden="true" />Start browser call</button> : null}{busy ? <button type="button" className="voice-button" onClick={() => phone.setExpanded(true)}>Open active phone</button> : null}</div>
      {phone.mobile ? <p className="voice-mobile-notice">Keep this browser open during calls. Background calling is not supported reliably.</p> : null}<p className="voice-phone-help"><ShieldCheck size={14} aria-hidden="true" />The call uses your approved business number. Microphone access begins when you start the call.</p>
    </form>}
  </section>;
}
