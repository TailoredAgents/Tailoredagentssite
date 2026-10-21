import "server-only";
import { createHash } from "node:crypto";

/** Stable across BOM and line-ending differences; never a person identity. */
export function importFingerprint(text: string): string {
  return createHash("sha256")
    .update(text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"))
    .digest("hex");
}
