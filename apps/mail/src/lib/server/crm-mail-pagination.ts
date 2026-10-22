import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

export class CrmMailPageError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
type Cursor = {
  v: 1;
  kind: "index" | "history";
  owner: string;
  address: string;
  thread?: string;
  id: string;
  at?: string;
};
const identifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 200 &&
  !/[\x00-\x20\x7f]/.test(value);
export function pageLimit(value: unknown) {
  if (value === undefined) return 50;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 100)
    throw new CrmMailPageError(400, "invalid_page");
  return Number(value);
}
export function encodeCrmCursor(cursor: Cursor, secret: string) {
  const payload = Buffer.from(JSON.stringify(cursor)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret)
    .update("crm-mail-page:" + payload)
    .digest("base64url")}`;
}
export function decodeCrmCursor(
  value: unknown,
  expected: Pick<Cursor, "kind" | "owner" | "address" | "thread">,
  secret: string,
): Cursor | null {
  if (value === undefined) return null;
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]{43}$/.test(value)
  )
    throw new CrmMailPageError(400, "invalid_cursor");
  const [payload, signature] = value.split(".");
  const actual = Buffer.from(signature, "base64url"),
    wanted = createHmac("sha256", secret)
      .update("crm-mail-page:" + payload)
      .digest();
  if (
    actual.toString("base64url") !== signature ||
    actual.length !== wanted.length ||
    !timingSafeEqual(actual, wanted)
  )
    throw new CrmMailPageError(400, "invalid_cursor");
  let cursor: Cursor;
  try {
    cursor = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Cursor;
  } catch {
    throw new CrmMailPageError(400, "invalid_cursor");
  }
  if (
    !cursor ||
    cursor.v !== 1 ||
    cursor.kind !== expected.kind ||
    cursor.owner !== expected.owner ||
    cursor.address !== expected.address ||
    cursor.thread !== expected.thread ||
    !identifier(cursor.id) ||
    (cursor.kind === "history" &&
      (typeof cursor.at !== "string" ||
        !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)?$/.test(
          cursor.at,
        ) ||
        !Number.isFinite(Date.parse(cursor.at))))
  )
    throw new CrmMailPageError(400, "invalid_cursor");
  return cursor;
}
