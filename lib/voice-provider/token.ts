import "server-only";
import { createHash } from "node:crypto";
import twilio from "twilio";
import {
  getVoiceConfiguration,
  VOICE_IDENTITY,
  VOICE_TOKEN_TTL,
} from "./config";

export function voiceIdentity(workspaceId: string, userId: string) {
  if (
    !workspaceId ||
    workspaceId.length > 200 ||
    !userId ||
    userId.length > 200
  )
    throw new Error("A workspace and actor are required for calling.");
  return (
    "ta_" +
    createHash("sha256")
      .update(JSON.stringify([workspaceId, userId]))
      .digest("hex")
      .slice(0, 48)
  );
}
/** The backend must authorize the actor and live number grants before calling. */
export function createVoiceAccessToken(
  identity: string,
  input: { canReceive?: boolean } = {},
) {
  const config = getVoiceConfiguration();
  if (!config.enabled || !VOICE_IDENTITY.test(identity))
    throw new Error("Browser calling is not enabled for this identity.");
  const token = new twilio.jwt.AccessToken(
    config.accountSid,
    config.apiKeySid,
    config.apiKeySecret,
    { identity, ttl: VOICE_TOKEN_TTL },
  );
  token.addGrant(
    new twilio.jwt.AccessToken.VoiceGrant({
      incomingAllow: input.canReceive === true,
      outgoingApplicationSid: config.appSid,
    }),
  );
  return {
    token: token.toJwt(),
    identity,
    expiresAt: new Date(
      (Math.floor(Date.now() / 1000) + VOICE_TOKEN_TTL) * 1000,
    ).toISOString(),
  };
}
