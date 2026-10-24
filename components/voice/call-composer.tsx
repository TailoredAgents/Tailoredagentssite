"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, Phone } from "lucide-react";
import type { ConversationRecord, ConversationRecipient } from "@/lib/conversations/types";
import { useBrowserPhone } from "./phone-provider";

function displayPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10 || (value.trim().startsWith("+") && !value.trim().startsWith("+1"))) return value;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export function VoiceCallComposer({ record, recipient }: { record?: ConversationRecord; recipient?: ConversationRecipient | null }) {
  const phone = useBrowserPhone();
  const targets = [...new Set([...(recipient?.phone ? [recipient.phone] : []), ...(record?.sources || []).flatMap((source) => source.externalAddresses)].filter((value) => /^\+?[\d\s().-]{7,}$/.test(value)))];
  const [to, setTo] = useState(displayPhone(targets[0] || ""));
  const line = phone.workspace.lines.find((item) => item.id === phone.lineId);
  const ready = phone.connection === "ready" && Boolean(line?.canCall) && line?.status === "active" && phone.workspace.state === "ready";
  const busy = phone.phase !== "idle";
  const canConnect = phone.workspace.state === "ready" && Boolean(line && (line.canCall || line.canReceive)) && !phone.readOnly && phone.supported !== false;
  const name = recipient?.name || record?.conversation.personName || "Customer";
  const title = /^\+?[\d\s().-]+$/.test(name) ? "Make a call" : `Call ${name}`;

  return <section className="voice-call-composer" aria-labelledby="voice-call-title">
    <div className="voice-call-content">
      <header className="voice-composer-heading">
        <h3 id="voice-call-title"><span className="voice-composer-icon"><Phone size={17} aria-hidden="true" /></span>{title}</h3>
        <span className={`voice-call-connection is-${phone.connection}`}><i aria-hidden="true" />{phone.connection === "ready" ? "Connected" : phone.connection === "connecting" ? "Connecting…" : "Not connected"}</span>
      </header>

      {phone.workspace.state !== "ready" ? <div className="voice-setup-notice"><p>{phone.workspace.message}</p><Link href="/dashboard/settings#calling">Review calling setup</Link></div> : <form aria-label="Start browser call" onSubmit={(event) => {
        event.preventDefault();
        if (ready && !busy && to.trim()) void phone.startCall({ lineId: phone.lineId, to: to.trim(), conversationId: record?.conversation.id, recipient: (recipient || record?.recipient) ? { kind: (recipient || record!.recipient)!.kind, id: (recipient || record!.recipient)!.id } : undefined, name });
      }}>
        {phone.workspace.lines.length > 1 ? <label className="voice-call-origin voice-call-line-picker"><span>Calling line</span><select aria-label="Calling line" value={phone.lineId} disabled={phone.readOnly || busy || phone.connection === "connecting"} onChange={(event) => phone.setLineId(event.target.value)}>{phone.workspace.lines.map((item) => <option key={item.id} value={item.id}>{displayPhone(item.phone)}{item.status === "paused" ? " · Paused" : ""}{!item.canCall ? " · Outbound access required" : ""}</option>)}</select></label> : <p className="voice-call-origin"><span>Calling from</span><strong>{line ? displayPhone(line.phone) : "No calling line"}</strong></p>}

        <fieldset className="voice-call-controls" disabled={phone.readOnly || phone.connection === "connecting"}>
          <label className="voice-field voice-call-destination"><span>Customer phone</span><input type="tel" aria-label="Customer phone *" required disabled={busy} value={to} onChange={(event) => setTo(event.target.value)} list="voice-customer-phones" maxLength={50} autoComplete="tel-national" placeholder="(678) 555-0123" /><datalist id="voice-customer-phones">{targets.map((target) => <option key={target} value={displayPhone(target)} />)}</datalist></label>
          <div className="voice-call-actions">
            {busy ? <button type="button" className="voice-button" onClick={() => phone.setExpanded(true)}><Phone size={16} aria-hidden="true" />Open active call</button> : phone.connection !== "ready" && canConnect ? <button type="button" className="voice-button is-primary" disabled={phone.connection === "connecting" || line?.status !== "active"} onClick={() => void phone.connectPhone(undefined, false)}>{phone.connection === "connecting" ? <LoaderCircle size={16} className="signin-spinner" aria-hidden="true" /> : <Phone size={16} aria-hidden="true" />}{phone.connection === "connecting" ? "Connecting…" : "Connect phone"}</button> : ready && !phone.readOnly ? <button type="submit" className="voice-button is-primary" disabled={!to.trim()}><Phone size={16} aria-hidden="true" />Call now</button> : null}
          </div>
        </fieldset>

        {phone.readOnly ? <p className="voice-phone-help">Your dashboard access is read-only.</p> : !line?.canCall ? <p className="voice-phone-help">Calling isn't enabled for your account on this line.</p> : null}
        {phone.supported === false ? <p className="voice-phone-help">Calling is unavailable in this browser. Use a supported desktop browser.</p> : null}
        {phone.error && !phone.expanded ? <p className="voice-feedback is-error" role="alert">{phone.error}</p> : null}
      </form>}
    </div>
  </section>;
}
