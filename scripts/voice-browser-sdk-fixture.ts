// Browser-only alias enabled exclusively by the guarded local Playwright config.
// This deliberately models signaling, not WebRTC or microphone/audio quality.
type Listener = (...args: unknown[]) => void;
class Events {
  private listeners = new Map<string, Listener[]>();
  on(name: string, listener: Listener) { this.listeners.set(name, [...(this.listeners.get(name) || []), listener]); return this; }
  emit(name: string, ...args: unknown[]) { for (const listener of this.listeners.get(name) || []) listener(...args); }
}
async function fixture(action: string, data: Record<string, unknown> = {}) {
  const response = await fetch("http://127.0.0.1:3161/browser", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer voice-synthetic-control" }, body: JSON.stringify({ action, ...data }) });
  if (!response.ok) throw new Error("Synthetic browser phone unavailable");
  return response.json();
}
export class Call extends Events {
  readonly customParameters: Map<string, string>;
  readonly parameters: Record<string, string>;
  private state = "pending";
  private muted = false;
  constructor(private record: { id: string; callId: string; from: string; to: string; direction: string }) {
    super(); this.customParameters = new Map([["CallId", record.callId]]); this.parameters = { CallSid: record.id, From: record.from, To: record.to };
  }
  status() { return this.state; }
  async accept() {
    const result = await fixture("accept", { id: this.record.id });
    if (result.denied) { this.emit("error", { code: 31401 }); return; }
    this.state = "open"; this.emit("accept");
  }
  reject() { this.state = "closed"; void fixture("reject", { id: this.record.id }); this.emit("reject"); }
  disconnect() { if (this.state === "closed" || this.state === "pending") return; this.state = "closed"; void fixture("disconnect", { id: this.record.id }); this.emit("disconnect"); }
  mute(value: boolean) { this.muted = value; this.emit("mute", value); }
  isMuted() { return this.muted; }
  connecting() { this.state = "connecting"; }
  open() { if (this.state === "closed") return; this.state = "open"; this.emit("accept"); }
}
export class Device extends Events {
  static get isSupported() { return !sessionStorage.getItem("voice-fixture-unsupported"); }
  state = "unregistered";
  private identity: string;
  private timer?: ReturnType<typeof setInterval>;
  private calls: Call[] = [];
  constructor(token: string) { super(); this.identity = JSON.parse(atob(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/"))).grants.identity; }
  async register() {
    await fixture("register", { identity: this.identity }); this.state = "registered"; this.emit("registered");
    this.timer = setInterval(() => { void fixture("poll", { identity: this.identity }).then((result) => {
      for (const record of result.events) { const call = new Call(record); this.calls.push(call); this.emit("incoming", call); }
    }); }, 300);
  }
  async unregister() { clearInterval(this.timer); this.state = "unregistered"; await fixture("unregister", { identity: this.identity }); this.emit("unregistered"); }
  destroy() { clearInterval(this.timer); this.disconnectAll(); void fixture("unregister", { identity: this.identity }); this.state = "destroyed"; }
  updateToken() { /* short local tests do not expire tokens */ }
  disconnectAll() { for (const call of this.calls) call.disconnect(); }
  async connect({ params }: { params: Record<string, string> }) {
    if (sessionStorage.getItem("voice-fixture-deny-microphone")) throw Object.assign(new Error("Microphone denied"), { code: 31401 });
    const result = await fixture("connect", { identity: this.identity, params });
    const call = new Call(result); call.connecting(); this.calls.push(call); setTimeout(() => call.open(), 200); return call;
  }
}
