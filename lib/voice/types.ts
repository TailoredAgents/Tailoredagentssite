export type VoiceLine = {
  callbackPhone?: string | null;
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
  inboundMode?: "browser" | "forward";
  forwardPhone?: string | null;
  forwardUserId?: string | null;
  forwardAlways?: boolean;
  recordCalls: boolean;
  recordingAnnouncement: boolean;
  autoTranscribe: boolean;
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
  usingPhone?: boolean;
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
  recording?: CallRecording | null;
  voicemail: {
    id: string;
    status: string;
    duration: number | null;
    expiresAt: string;
    canPlay: boolean;
    canDelete: boolean;
  } | null;
};
export type CallSummary = {
  summary: string;
  highlights: { text: string; quote: string }[];
  followUps: { text: string; quote: string }[];
};
export type CallRecording = {
  id: string; status: string; duration: number | null; expiresAt: string;
  canPlay: boolean; canDelete: boolean;
  analysisStatus: string; analysisError: string | null;
  analysisAvailable?: boolean;
  transcript: string | null; summary: CallSummary | null;
  followUpTasks?: {suggestionIndex:number;taskId:string;status:string}[];
};
