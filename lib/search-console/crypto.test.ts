import { describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential } from "./crypto";

describe("integration credential encryption", () => {
  it("round trips an encrypted credential without embedding plaintext", () => {
    const secret = "dashboard-secret-with-at-least-thirty-two-characters";
    const encrypted = encryptCredential("refresh-token-value", secret);
    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptCredential(encrypted, secret)).toBe("refresh-token-value");
  });

  it("rejects tampered ciphertext", () => {
    const secret = "dashboard-secret-with-at-least-thirty-two-characters";
    const encrypted = encryptCredential("refresh-token-value", secret);
    const parts = encrypted.split(".");
    parts[2] = `${parts[2]?.startsWith("A") ? "B" : "A"}${parts[2]?.slice(1)}`;
    expect(() => decryptCredential(parts.join("."), secret)).toThrow();
  });
});
