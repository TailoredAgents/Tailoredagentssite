"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Call, Device } from "@twilio/voice-sdk";
import { acceptVoiceCallAction, createVoiceIntentAction, endVoiceCallAction, getVoiceCallAction, issueVoiceTokenAction, updateVoicePresenceAction } from "@/lib/voice/actions";
import type { VoiceCall, VoiceWorkspace } from "@/lib/voice/types";
import { loadVoiceSdk } from "./sdk";
import { BrowserPhonePanel } from "./phone-panel";

type Phase = "idle" | "incoming" | "connecting" | "ringing" | "active" | "reconnecting" | "ending" | "uncertain";
type CallTarget = { lineId: string; to: string; conversationId?: string; name?: string };
type PhoneContext = {
  workspace: VoiceWorkspace; readOnly: boolean; lineId: string; setLineId: (id: string) => void;
  connection: "disconnected" | "connecting" | "ready"; receiving: boolean; phase: Phase; error: string;
  activeCall: VoiceCall | null; callerName: string; muted: boolean; elapsed: number;
  expanded: boolean; setExpanded: (open: boolean) => void; supported: boolean | null; mobile: boolean;
  connectPhone: (id?: string, showPanel?: boolean) => Promise<void>; disconnectPhone: () => Promise<void>;
  startCall: (target: CallTarget) => Promise<void>; acceptCall: () => Promise<void>;
  rejectCall: () => void; endCall: () => Promise<void>; toggleMute: () => void;
};
const Context = createContext<PhoneContext | null>(null);
export function useBrowserPhone() {
  const value = useContext(Context);
  if (!value) throw new Error("Browser phone must be inside the dashboard phone provider.");
  return value;
}

function friendlyError(error: unknown, fallback: string) {
  const value = error as { code?: number; name?: string };
  if (value?.code === 31401 || value?.name === "NotAllowedError" || value?.name === "PermissionDeniedError") return "Microphone access was denied. Allow the microphone in your browser settings, then start a new call.";
  if (value?.code === 31402 || value?.name === "NotFoundError") return "A working microphone could not be found. Connect a microphone and try again.";
  return fallback;
}

export function VoicePhoneProvider({ workspace, readOnly, children }: { workspace: VoiceWorkspace; readOnly: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [lineId, updateLineId] = useState(workspace.lines.find((line) => line.canCall || line.canReceive)?.id || workspace.lines[0]?.id || "");
  const [connection, setConnection] = useState<PhoneContext["connection"]>("disconnected");
  const [receiving, setReceiving] = useState(false);
  const [phase, updatePhase] = useState<Phase>("idle");
  const [activeCall, setActiveCall] = useState<VoiceCall | null>(null);
  const [callerName, setCallerName] = useState("");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const callDirectionRef = useRef<"inbound" | "outbound" | null>(null);
  const callIdRef = useRef<string | null>(null);
  const deviceLineRef = useRef("");
  const registeredRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const generation = useRef(0);
  const alive = useRef(true);
  const intentRequest = useRef<{ key: string; requestId: string } | null>(null);
  const acceptedAt = useRef<number | null>(null);

  function setPhase(next: Phase) { phaseRef.current = next; updatePhase(next); }
  function clearCall() {
    callRef.current = null; callDirectionRef.current = null; callIdRef.current = null; acceptedAt.current = null;
    intentRequest.current = null; setMuted(false); setElapsed(0); setActiveCall(null); setCallerName(""); setPhase("idle");
  }
  async function releaseDevice() {
    const device = deviceRef.current, id = deviceLineRef.current;
    deviceRef.current = null; deviceLineRef.current = ""; registeredRef.current = false; setReceiving(false);
    device?.destroy(); setConnection("disconnected");
    if (id) await updateVoicePresenceAction({ lineId: id, available: false }).catch(() => undefined);
  }
  async function endCall() {
    generation.current++;
    const id = callIdRef.current;
    if (phaseRef.current === "incoming" || (callDirectionRef.current === "inbound" && acceptedAt.current === null)) {
      if (callRef.current?.status() === "pending") callRef.current.reject();
      else callRef.current?.disconnect();
      clearCall(); router.refresh(); return;
    }
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
    if (!id) { clearCall(); return; }
    setPhase("ending");
    try {
      const result = await endVoiceCallAction({ callId: id });
      if (result.status !== "success") throw new Error("End not confirmed");
      clearCall(); router.refresh();
    } catch {
      callIdRef.current = id; setPhase("uncertain"); setError("The call end could not be confirmed. Check the connection and use End call again before starting another call.");
    }
  }
  async function failConnection(message: string) {
    setError(message); setExpanded(true);
    if (phaseRef.current === "incoming" || (callDirectionRef.current === "inbound" && acceptedAt.current === null)) { if (callRef.current?.status() === "pending") callRef.current.reject(); else callRef.current?.disconnect(); clearCall(); }
    else if (callIdRef.current) await endCall();
    await releaseDevice();
  }
  function wireCall(call: Call, direction: "inbound" | "outbound") {
    callRef.current = call; callDirectionRef.current = direction;
    const current = () => callRef.current === call && alive.current;
    call.on("ringing", () => { if (current()) setPhase("ringing"); });
    call.on("accept", () => { if (current()) { acceptedAt.current = Date.now(); setElapsed(0); setPhase("active"); } });
    call.on("mute", (value: boolean) => { if (current()) setMuted(value); });
    call.on("reconnecting", () => { if (current()) setPhase("reconnecting"); });
    call.on("reconnected", () => { if (current()) setPhase("active"); });
    const finished = () => { if (current()) { clearCall(); router.refresh(); } };
    call.on("disconnect", finished); call.on("cancel", finished); call.on("reject", finished);
    call.on("error", (reason: unknown) => {
      if (!current()) return;
      setError(friendlyError(reason, "The call connection failed. Review the call status before trying again."));
      void endCall();
    });
  }
  async function connectPhone(id = lineId, showPanel = true) {
    if (phaseRef.current !== "idle" || connection === "connecting") return;
    setExpanded(showPanel); setError("");
    const line = workspace.lines.find((item) => item.id === id);
    if (readOnly || !line || line.status !== "active" || (!line.canCall && !line.canReceive) || workspace.state !== "ready") { setError("An active calling line and an explicit teammate grant are required. Review calling in Settings."); return; }
    if (!window.isSecureContext || typeof navigator.mediaDevices?.getUserMedia !== "function" || typeof window.RTCPeerConnection !== "function") { setSupported(false); setError("Browser calling requires a supported browser, microphone access, and HTTPS. You can still review call history and voicemail."); return; }
    if (deviceRef.current && deviceLineRef.current === id && connection === "ready") return;
    await releaseDevice(); setConnection("connecting"); updateLineId(id);
    const attempt = ++generation.current;
    try {
      const { Device: TwilioDevice } = await loadVoiceSdk();
      if (!TwilioDevice.isSupported) { setSupported(false); throw new Error("Unsupported browser"); }
      const token = await issueVoiceTokenAction(id);
      if (!alive.current || generation.current !== attempt) return;
      const device = new TwilioDevice(token.token, { logLevel: "error", closeProtection: true, tokenRefreshMs: 60000, enableImprovedSignalingErrorPrecision: true });
      deviceRef.current = device; deviceLineRef.current = id;
      device.on("registered", () => {
        if (deviceRef.current !== device) return;
        registeredRef.current = true; setReceiving(true); setConnection("ready");
        void updateVoicePresenceAction({ lineId: id, available: true }).catch(() => failConnection("Your incoming-call access could not be verified. Reconnect your phone to try again."));
      });
      device.on("unregistered", () => {
        if (deviceRef.current !== device) return;
        registeredRef.current = false; setReceiving(false); setConnection("disconnected");
        void updateVoicePresenceAction({ lineId: id, available: false }).catch(() => undefined);
      });
      device.on("error", (reason: unknown) => { if (deviceRef.current === device) void failConnection(friendlyError(reason, "The phone connection failed. Check your network and reconnect.")); });
      device.on("tokenWillExpire", async () => {
        try { const refreshed = await issueVoiceTokenAction(id); if (deviceRef.current === device) device.updateToken(refreshed.token); }
        catch { if (deviceRef.current === device) await failConnection("Your phone access could not be renewed. Reconnect to verify your current access."); }
      });
      device.on("incoming", async (call: Call) => {
        if (deviceRef.current !== device || phaseRef.current !== "idle" || !registeredRef.current) { call.reject(); return; }
        const callId = call.customParameters.get("CallId");
        if (!callId) { call.reject(); setError("This incoming call could not be verified."); return; }
        wireCall(call, "inbound"); callIdRef.current = callId; setPhase("incoming"); setExpanded(true); setError("");
        try {
          const detail = await getVoiceCallAction(callId);
          if (callRef.current !== call) return;
          if (detail.lineId !== id || detail.direction !== "inbound") throw new Error("Wrong line");
          setActiveCall(detail); setCallerName(detail.from);
        } catch { if (callRef.current === call) { call.reject(); clearCall(); setError("This incoming call is no longer available or your access has changed."); } }
      });
      if (line.canReceive) await device.register();
      else setConnection("ready");
    } catch (reason) {
      if (generation.current === attempt) { await releaseDevice(); setError(friendlyError(reason, "Your phone could not connect. Check your calling access, browser support and network, then try again.")); }
    }
  }
  async function startCall(target: CallTarget) {
    if (phaseRef.current !== "idle") return;
    setExpanded(true); setError("");
    const line = workspace.lines.find((item) => item.id === target.lineId);
    const device = deviceRef.current;
    if (readOnly || !line?.canCall || line.status !== "active" || !device || deviceLineRef.current !== target.lineId || connection !== "ready") { setError("Connect an approved calling line before starting a call."); return; }
    const key = JSON.stringify([target.lineId, target.to, target.conversationId]);
    if (!intentRequest.current || intentRequest.current.key !== key) intentRequest.current = { key, requestId: crypto.randomUUID() };
    const attempt = ++generation.current;
    let ownCallId: string | null = null;
    setPhase("connecting"); setCallerName(target.name || target.to);
    try {
      const intent = await createVoiceIntentAction({ lineId: target.lineId, to: target.to, conversationId: target.conversationId, requestId: intentRequest.current.requestId });
      ownCallId = intent.callId;
      if (generation.current !== attempt || deviceRef.current !== device) { await endVoiceCallAction({ callId: intent.callId }); return; }
      callIdRef.current = intent.callId;
      const detail = await getVoiceCallAction(intent.callId);
      if (generation.current !== attempt || deviceRef.current !== device) { await endVoiceCallAction({ callId: intent.callId }); return; }
      setActiveCall(detail);
      const call = await device.connect({ params: { IntentToken: intent.intentToken } });
      if (generation.current !== attempt || deviceRef.current !== device) { call.disconnect(); await endVoiceCallAction({ callId: intent.callId }); return; }
      wireCall(call, "outbound"); setPhase(call.status() === "open" ? "active" : "ringing");
      if (call.status() === "open") acceptedAt.current = Date.now();
    } catch (reason) {
      if (generation.current !== attempt || deviceRef.current !== device) { if (ownCallId) await endVoiceCallAction({ callId: ownCallId }).catch(() => undefined); return; }
      setError(friendlyError(reason, "The call could not be connected. No new call will start automatically."));
      if (callIdRef.current) await endCall();
      else setPhase("idle");
    }
  }
  async function acceptCall() {
    const call = callRef.current, id = callIdRef.current;
    if (!call || !id || phaseRef.current !== "incoming" || !activeCall || readOnly) return;
    const attempt = ++generation.current;
    setError(""); setPhase("connecting");
    try { await acceptVoiceCallAction({ callId: id }); if (generation.current === attempt && callRef.current === call && call.status() === "pending") call.accept(); }
    catch (reason) { if (generation.current !== attempt || callRef.current !== call) return; call.reject(); clearCall(); setError(friendlyError(reason, "This call could not be accepted. Your incoming-call access may have changed.")); }
  }
  function rejectCall() { if (phaseRef.current === "incoming") { callRef.current?.reject(); clearCall(); } }
  function toggleMute() { const call = callRef.current; if (call && ["active", "reconnecting"].includes(phaseRef.current)) { const next = !call.isMuted(); call.mute(next); setMuted(next); } }
  async function disconnectPhone() { if (phaseRef.current !== "idle") return; generation.current++; await releaseDevice(); }
  function setLineId(id: string) { if (phaseRef.current !== "idle") return; if (deviceRef.current) void disconnectPhone(); updateLineId(id); }

  useEffect(() => {
    alive.current = true;
    setSupported(window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function" && typeof window.RTCPeerConnection === "function");
    setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    const heartbeat = window.setInterval(() => {
      const id = deviceLineRef.current;
      if (!id || !registeredRef.current || !deviceRef.current) return;
      void updateVoicePresenceAction({ lineId: id, available: true }).catch(() => failConnection("Your phone presence could not be renewed. Reconnect before receiving more calls."));
    }, 30000);
    const offline = () => { if (deviceRef.current) void failConnection("Your network is offline. Reconnect your phone after the connection returns."); };
    window.addEventListener("offline", offline);
    return () => {
      alive.current = false; generation.current++; window.clearInterval(heartbeat); window.removeEventListener("offline", offline);
      const id = deviceLineRef.current, callId = callIdRef.current;
      const localInvitation = callDirectionRef.current === "inbound" && acceptedAt.current === null;
      deviceRef.current?.destroy(); deviceRef.current = null;
      if (id) void updateVoicePresenceAction({ lineId: id, available: false }).catch(() => undefined);
      if (callId && !localInvitation) void endVoiceCallAction({ callId }).catch(() => undefined);
    };
  // The dashboard layout keeps this provider mounted across route changes.
  // Its one heartbeat reads current device/call refs; it must not reconnect on renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!["active", "reconnecting"].includes(phase)) return; const timer = window.setInterval(() => setElapsed(acceptedAt.current ? Math.floor((Date.now() - acceptedAt.current) / 1000) : 0), 1000); return () => window.clearInterval(timer); }, [phase]);
  useEffect(() => {
    if (!workspace.lines.some((line) => line.id === lineId) && !deviceRef.current && phaseRef.current === "idle") updateLineId(workspace.lines.find((line) => line.canCall || line.canReceive)?.id || workspace.lines[0]?.id || "");
    const device = deviceRef.current, id = deviceLineRef.current;
    if (!device || !id) return;
    const line = workspace.lines.find((item) => item.id === id);
    if (readOnly || workspace.state !== "ready" || !line || line.status !== "active" || (!line.canCall && !line.canReceive)) {
      void failConnection("This phone's calling access or line status has changed. Review your current access before reconnecting.");
      return;
    }
    if (registeredRef.current && !line.canReceive) {
      registeredRef.current = false; setReceiving(false);
      void updateVoicePresenceAction({ lineId: id, available: false }).catch(() => undefined);
      void device.unregister().then(() => { if (deviceRef.current === device && line.canCall) setConnection("ready"); }).catch(() => failConnection("Incoming calling access changed. Reconnect to use your current permissions."));
    }
  // Configuration refreshes update permissions without automatically registering
  // a new device or replacing the active phone on dashboard navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, readOnly, lineId]);

  return <Context.Provider value={{ workspace, readOnly, lineId, setLineId, connection, receiving, phase, error, activeCall, callerName, muted, elapsed, expanded, setExpanded, supported, mobile, connectPhone, disconnectPhone, startCall, acceptCall, rejectCall, endCall, toggleMute }}>{children}<BrowserPhonePanel /></Context.Provider>;
}
