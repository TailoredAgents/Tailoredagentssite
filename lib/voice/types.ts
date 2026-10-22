export type VoiceLine = {
  id: string;
  phone: string;
  status: "active" | "paused";
  canRead: boolean;
  canCall: boolean;
  canReceive: boolean;
  canManageVoicemail: boolean;
  greeting: string;
  timezone: string;
  businessHours: { start: string; end: string; days: number[] };
  ringSeconds: number;
};
export type VoiceGrant = {
  userId: string;
  name: string;
  email: string;
  canRead: boolean;
  canCall: boolean;
  canReceive: boolean;
  canManageVoicemail: boolean;
};
export type VoiceWorkspace = {
  state: "ready" | "setup" | "grant_required" | "unavailable";
  message: string;
  canManage: boolean;
  lines: VoiceLine[];
  configuredPhone: string | null;
  grants: (VoiceGrant & { lineId: string })[];
  members: { id: string; name: string; email: string }[];
};
export type VoiceActionState = {
  status: "idle" | "success" | "error";
  message: string;
  callId?: string;
  conversationId?: string;
};
export type VoiceToken = { token: string; identity: string; expiresAt: string };
export type VoiceIntent = {
  intentId: string;
  intentToken: string;
  callId: string;
  conversationId: string;
  expiresAt: string;
  to: string;
  from: string;
};
export type VoiceCall = {
  id: string;
  lineId: string;
  conversationId: string;
  sourceId: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  duration: number | null;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  voicemail: {
    id: string;
    status: string;
    duration: number | null;
    expiresAt: string;
    canPlay: boolean;
    canDelete: boolean;
  } | null;
};
