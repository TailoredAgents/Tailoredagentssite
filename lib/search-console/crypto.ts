import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey(keyMaterial: string) {
  if (keyMaterial.length < 32) {
    throw new Error("Credential encryption requires the configured application secret.");
  }
  return createHash("sha256")
    .update(`tailored-agents:integration-credentials:v1:${keyMaterial}`)
    .digest();
}

export function encryptCredential(value: string, keyMaterial: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptCredential(value: string, keyMaterial: string) {
  const [version, ivValue, tagValue, encryptedValue, extra] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue || extra) {
    throw new Error("Encrypted credential format is invalid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(keyMaterial),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
