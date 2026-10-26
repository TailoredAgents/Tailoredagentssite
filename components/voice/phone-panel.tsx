"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Headphones, LoaderCircle, Mic, MicOff, Minus, Phone, PhoneIncoming, PhoneOff, Settings2, ShieldCheck } from "lucide-react";
import { useBrowserPhone } from "./phone-provider";

export function voiceDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function BrowserPhonePanel() {
  const phone = useBrowserPhone();
  const pathname = usePathname();
  const line = phone.workspace.lines.find((item) => item.id === phone.lineId);
  const usingPhone = Boolean(phone.activeCall?.usingPhone);
  const busy = phone.phase !== "idle";
  const phaseLabels = { idle: phone.connection === "ready" ? "Phone connected" : phone.connection === "connecting" ? "Connecting phone…" : "Phone disconnected", incoming: "Incoming call", connecting: "Connecting call…", ringing: "Ringing…", active: "Call in progress", reconnecting: "Reconnecting audio…", ending: "Ending call…", uncertain: "Call end unconfirmed" };
  if (!phone.expanded) return <button className={`voice-launcher ${pathname === "/dashboard/inbox" && !busy ? "is-inbox-idle" : ""} ${busy ? "has-call" : ""}`} type="button" onClick={() => phone.setExpanded(true)} aria-label={`Open browser phone · ${phaseLabels[phone.phase]}`}><Phone size={18} aria-hidden="true" /><span>{busy ? phaseLabels[phone.phase] : phone.connection === "ready" ? "Phone connected" : "Phone"}</span>{phone.phase === "active" ? <strong>{voiceDuration(phone.elapsed)}</strong> : null}</button>;
  return <section className={`voice-phone-panel ${busy ? "has-call" : ""}`} aria-label="Browser phone"><header><span><Headphones size={18} aria-hidden="true" /><h2>{usingPhone ? "Call using my phone" : "Browser phone"}</h2></span><button className="voice-icon-button" type="button" aria-label="Minimize browser phone" onClick={() => phone.setExpanded(false)}><Minus size={18} aria-hidden="true" /></button></header>
    <div className="voice-phone-body"><div className={`voice-connection-state is-${usingPhone && phone.phase === "active" ? "ready" : phone.connection}`}><i aria-hidden="true" />{phaseLabels[phone.phase]}{phone.phase === "active" || phone.phase === "reconnecting" ? <strong>{voiceDuration(phone.elapsed)}</strong> : null}</div>
      {busy ? <div className="voice-current-call">{phone.phase === "incoming" ? <span className="voice-caller-icon"><PhoneIncoming size={23} aria-hidden="true" /></span> : null}<strong>{phone.callerName || "Checking caller…"}</strong>{phone.activeCall ? <><span>{phone.activeCall.direction === "inbound" ? `To ${phone.activeCall.to}` : `From ${phone.activeCall.from}`}</span><Link href={`/dashboard/inbox?conversation=${phone.activeCall.conversationId}`}>Open customer conversation<ArrowUpRight size={14} aria-hidden="true" /></Link></> : null}</div> : <>
        <p className="voice-phone-description">{phone.workspace.message}</p>
        {phone.workspace.lines.length ? <label className="voice-field"><span>Calling line</span><select value={phone.lineId} onChange={(event) => phone.setLineId(event.target.value)} disabled={phone.connection === "connecting"}>{phone.workspace.lines.map((item) => <option key={item.id} value={item.id}>{item.phone}{item.status === "paused" ? " · Paused" : ""}</option>)}</select></label> : null}
        {phone.connection === "ready" ? <p className="voice-phone-help">{phone.receiving ? "Approved incoming calls ring here while this dashboard stays open." : line?.canReceive ? "Reconnect your phone to begin receiving calls after access changes." : "Connected for outbound calls. Your grant does not enable incoming ringing."}</p> : null}
      </>}
      {usingPhone ? <p className="voice-phone-help">{phone.phase === "active" ? "Audio is on your phone. Use your phone’s mute control. You can leave this page without ending the call." : "Answer your phone and press 1. The customer is called only after you accept."}</p> : null}
      {phone.error ? <p className="voice-feedback is-error" role="alert">{phone.error}</p> : null}
      {!usingPhone && phone.supported === false ? <p className="voice-phone-help">This browser cannot provide supported calling. Open a current desktop Chrome, Edge, Firefox or Safari browser over HTTPS.</p> : null}
      {!usingPhone && phone.mobile ? <p className="voice-mobile-notice">Keep this browser in the foreground. Mobile browsers cannot reliably receive or maintain calls when backgrounded or locked.</p> : null}
      <div className="voice-phone-controls">
        {phone.phase === "incoming" ? <><button type="button" className="voice-button is-answer" disabled={!phone.activeCall || phone.readOnly} onClick={() => void phone.acceptCall()}><Phone size={17} aria-hidden="true" />Accept call</button><button type="button" className="voice-button is-hangup" onClick={phone.rejectCall}><PhoneOff size={17} aria-hidden="true" />Decline call</button></> : busy ? <>{!usingPhone && ["active", "reconnecting"].includes(phone.phase) ? <button type="button" className="voice-button" aria-pressed={phone.muted} onClick={phone.toggleMute}>{phone.muted ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}{phone.muted ? "Unmute microphone" : "Mute microphone"}</button> : null}<button type="button" className="voice-button is-hangup" disabled={phone.phase === "ending"} onClick={() => void phone.endCall()}><PhoneOff size={17} aria-hidden="true" />{phone.phase === "ending" ? "Ending…" : "End call"}</button></> : phone.connection === "ready" ? <button type="button" className="voice-button" onClick={() => void phone.disconnectPhone()}><PhoneOff size={16} aria-hidden="true" />Disconnect phone</button> : phone.workspace.state === "ready" && line && (line.canCall || line.canReceive) && !phone.readOnly && phone.supported !== false ? <button type="button" className="voice-button is-primary" disabled={phone.connection === "connecting" || line.status !== "active"} onClick={() => void phone.connectPhone()}>{phone.connection === "connecting" ? <LoaderCircle size={16} className="signin-spinner" aria-hidden="true" /> : <Phone size={16} aria-hidden="true" />}{phone.connection === "connecting" ? "Connecting…" : "Connect phone"}</button> : null}
      </div>
      {!busy ? <><p className="voice-phone-help"><ShieldCheck size={14} aria-hidden="true" />Microphone access is requested only when you start or accept a call.</p><Link className="voice-settings-link" href="/dashboard/settings#calling"><Settings2 size={15} aria-hidden="true" />Calling settings</Link></> : null}
    </div>
  </section>;
}
