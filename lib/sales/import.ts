export type ImportRow = {
  rowNumber: number;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  industry?: string;
  state?: string;
  websiteStatus?: string;
  score?: number;
  researchUrl?: string;
  notes?: string;
  externalId?: string;
  outcome?: string;
  occurredAt?: string;
  city?: string;
  facebookUrl?: string;
  sourceList?: string;
};

type ImportField =
  | Exclude<keyof ImportRow, "rowNumber">
  | "firstName"
  | "lastName";
export type ImportMapping = { header: string; field: ImportField };
export type CsvImportResult = {
  rows: ImportRow[];
  errors: { row: number; message: string }[];
  headers: string[];
  mapping: ImportMapping[];
  unmappedHeaders: string[];
};

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 80;
const MAX_FIELD_LENGTH = 20000;

const aliases: Record<ImportField, string[]> = {
  businessName: [
    "business",
    "business name",
    "company",
    "company name",
    "organization",
    "organization name",
    "account name",
  ],
  contactName: [
    "name",
    "contact",
    "contact name",
    "full name",
    "owner",
    "owner name",
    "primary contact",
  ],
  firstName: ["first name", "firstname", "contact first name"],
  lastName: ["last name", "lastname", "contact last name"],
  email: [
    "email",
    "email address",
    "business email",
    "contact email",
    "email 1",
    "email1",
  ],
  phone: [
    "phone",
    "phone number",
    "phone number 1",
    "telephone",
    "business phone",
    "mobile",
    "mobile phone",
    "primary phone",
    "phone 1",
    "phone1",
  ],
  websiteUrl: [
    "website",
    "website url",
    "web site",
    "web address",
    "domain",
    "url",
  ],
  industry: [
    "industry",
    "category",
    "business category",
    "business type",
    "niche",
  ],
  state: ["state", "province", "region", "state province"],
  websiteStatus: [
    "website status",
    "website condition",
    "web status",
    "site status",
    "has website",
  ],
  score: [
    "score",
    "lead score",
    "prospect score",
    "priority score",
    "research score",
    "qualification score",
  ],
  researchUrl: [
    "research url",
    "evidence",
    "evidence url",
    "source url",
    "source link",
    "research link",
    "google maps url",
    "google maps link",
    "maps url",
  ],
  notes: [
    "notes",
    "note",
    "research notes",
    "description",
    "comments",
    "comment",
    "call notes",
  ],
  externalId: [
    "external id",
    "lead id",
    "vendor contact id",
    "batchdialer id",
    "batch dialer id",
    "call id",
    "record id",
  ],
  outcome: [
    "outcome",
    "disposition",
    "call result",
    "call outcome",
    "result",
    "call disposition",
  ],
  occurredAt: [
    "occurred at",
    "last call date",
    "last called",
    "call date",
    "call time",
    "call timestamp",
    "last call timestamp",
    "date called",
  ],
  city: ["city", "town"],
  facebookUrl: ["facebook", "facebook url", "facebook link", "fb url"],
  sourceList: [
    "source list",
    "list name",
    "campaign",
    "campaign name",
    "calling list",
    "list",
  ],
};

function headerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ");
}

const headerFields = new Map<string, ImportField>(
  Object.entries(aliases).flatMap(([field, values]) =>
    values.map((value) => [headerKey(value), field as ImportField] as const),
  ),
);

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || /\s/.test(email)) return null;
  const parts = email.split("@");
  if (parts.length !== 2 || parts[0].length > 64 || !parts[0] || !parts[1])
    return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(parts[0])) return null;
  if (
    parts[0].startsWith(".") ||
    parts[0].endsWith(".") ||
    parts[0].includes("..")
  )
    return null;
  return validHostname(parts[1]) ? email : null;
}

/** Normalize US numbers and explicitly international numbers; never guess a country. */
export function normalizePhone(value: string): string | null {
  const phone = value.trim().replace(/\s*(?:ext\.?|x|#)\s*\d+$/i, "");
  if (!phone || !/^\+?[\d\s().-]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+"))
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function validHostname(hostname: string): boolean {
  if (hostname.length > 253 || !hostname.includes(".")) return false;
  const labels = hostname.split(".");
  return (
    labels.every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
    ) && !/^\d+$/.test(labels.at(-1) ?? "")
  );
}

function normalizeUrl(value: string): string | null {
  const input = value.trim();
  if (!input || input.length > 2000 || /\s/.test(input)) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input))
    return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(input) ? input : `https://${input}`,
    );
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      !validHostname(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeDomain(value: string): string | null {
  const url = normalizeUrl(value);
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : null;
}

type CsvRecord = { line: number; cells: string[] };

function readCsv(text: string): {
  records: CsvRecord[];
  error?: { row: number; message: string };
} {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let recordLine = 1;

  function endCell() {
    cells.push(cell);
    cell = "";
    closedQuote = false;
  }

  function endRecord() {
    endCell();
    if (cells.some((value) => value.trim()))
      records.push({ line: recordLine, cells });
    cells = [];
  }

  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        cell += "\n";
        line += 1;
      } else cell += character;
    } else if (character === ",") {
      endCell();
      if (cells.length >= MAX_COLUMNS)
        return {
          records: [],
          error: {
            row: recordLine,
            message: `CSV supports at most ${MAX_COLUMNS} columns.`,
          },
        };
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      endRecord();
      line += 1;
      recordLine = line;
      if (records.length > MAX_ROWS + 1)
        return {
          records: [],
          error: {
            row: recordLine,
            message: `CSV supports at most ${MAX_ROWS} data rows.`,
          },
        };
    } else if (character === '"') {
      if (cell.length || closedQuote)
        return {
          records: [],
          error: {
            row: recordLine,
            message: "Unexpected quote in an unquoted CSV field.",
          },
        };
      quoted = true;
    } else if (closedQuote) {
      if (!/[ \t]/.test(character))
        return {
          records: [],
          error: {
            row: recordLine,
            message: "Unexpected text after a quoted CSV field.",
          },
        };
    } else cell += character;

    if (cell.length > MAX_FIELD_LENGTH)
      return {
        records: [],
        error: {
          row: recordLine,
          message: `A CSV field exceeds ${MAX_FIELD_LENGTH} characters.`,
        },
      };
  }
  if (quoted)
    return {
      records: [],
      error: { row: recordLine, message: "Unclosed quoted CSV field." },
    };
  if (cell.length || cells.length || closedQuote) endRecord();
  if (records.length > MAX_ROWS + 1)
    return {
      records: [],
      error: {
        row: recordLine,
        message: `CSV supports at most ${MAX_ROWS} data rows.`,
      },
    };
  return { records };
}

function websiteStatus(value: string): string | null {
  const key = headerKey(value);
  if (["unknown", "unverified", "not researched"].includes(key))
    return "unknown";
  if (
    [
      "none",
      "no",
      "false",
      "no website",
      "no site",
      "missing",
      "does not have website",
    ].includes(key)
  )
    return "none";
  if (
    [
      "needs redesign",
      "redesign",
      "outdated",
      "poor",
      "weak",
      "broken",
      "needs improvement",
    ].includes(key)
  )
    return "needs_redesign";
  if (
    [
      "has website",
      "yes",
      "true",
      "active",
      "existing",
      "good",
      "website",
      "live",
    ].includes(key)
  )
    return "has_website";
  return null;
}

function normalizedDate(value: string): string | null {
  // Timestamp imports need an explicit timezone. Machine-local timezone guessing
  // would change outcome identities when importing the same file elsewhere.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isoTimestamp =
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
      value,
    );
  if (!dateOnly && !isoTimestamp) return null;
  const parsed = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(parsed.getTime())) return null;
  // JavaScript silently rolls invalid days into the next month.
  if (dateOnly && parsed.toISOString().slice(0, 10) !== value) return null;
  if (isoTimestamp) {
    const calendarDate = value.slice(0, 10);
    const calendarCheck = new Date(`${calendarDate}T00:00:00Z`);
    if (
      !Number.isFinite(calendarCheck.getTime()) ||
      calendarCheck.toISOString().slice(0, 10) !== calendarDate
    )
      return null;
  }
  return parsed.toISOString();
}

export function parseProspectCsv(
  text: string,
  options: { mode?: "prospects" | "dialer" } = {},
): CsvImportResult {
  const result: CsvImportResult = {
    rows: [],
    errors: [],
    headers: [],
    mapping: [],
    unmappedHeaders: [],
  };
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) {
    result.errors.push({ row: 1, message: "CSV exceeds the 2 MB limit." });
    return result;
  }
  const parsed = readCsv(text);
  if (parsed.error) {
    result.errors.push(parsed.error);
    return result;
  }
  if (!parsed.records.length) {
    result.errors.push({ row: 1, message: "CSV is empty." });
    return result;
  }
  result.headers = parsed.records[0].cells.map((header) => header.trim());
  const fields = result.headers.map((header) =>
    headerFields.get(headerKey(header)),
  );
  // A generic Name column denotes the business only when no explicit company
  // column exists; otherwise it is the person's name.
  if (!fields.includes("businessName"))
    result.headers.forEach((header, index) => {
      if (headerKey(header) === "name") fields[index] = "businessName";
    });
  result.mapping = result.headers.flatMap((header, index) =>
    fields[index] ? [{ header, field: fields[index]! }] : [],
  );
  result.unmappedHeaders = result.headers.filter((_, index) => !fields[index]);
  if (result.headers.some((header) => !header))
    result.errors.push({
      row: parsed.records[0].line,
      message: "Every CSV column needs a header.",
    });
  if (new Set(result.headers.map(headerKey)).size !== result.headers.length)
    result.errors.push({
      row: parsed.records[0].line,
      message: "CSV headers must be unique.",
    });
  const mode = options.mode ?? "prospects";
  if (mode === "prospects" && !fields.includes("businessName"))
    result.errors.push({
      row: 1,
      message: "Include a Business Name or Company column.",
    });
  if (
    mode === "dialer" &&
    (!fields.includes("outcome") ||
      (!fields.includes("phone") && !fields.includes("email")))
  )
    result.errors.push({
      row: 1,
      message:
        "Dialer results need Phone or Email and a Disposition/Call Result column.",
    });
  if (result.errors.length) return result;
  if (parsed.records.length === 1) {
    result.errors.push({
      row: 1,
      message: "CSV contains headers but no data rows.",
    });
    return result;
  }

  for (const record of parsed.records.slice(1)) {
    const errors: string[] = [];
    if (record.cells.length !== result.headers.length) {
      result.errors.push({
        row: record.line,
        message: `Expected ${result.headers.length} columns; found ${record.cells.length}.`,
      });
      continue;
    }
    const values: Partial<Record<ImportField, string>> = {};
    const extraNotes: string[] = [];
    record.cells.forEach((raw, index) => {
      const value = raw.trim();
      if (!value) return;
      const field = fields[index];
      if (!field || (values[field] && values[field] !== value))
        extraNotes.push(`${result.headers[index]}: ${value}`);
      else values[field] = value;
    });
    const row: ImportRow = {
      rowNumber: record.line,
      businessName: values.businessName ?? "",
    };
    if (mode === "prospects" && !row.businessName)
      errors.push("Business name is required.");
    if (row.businessName.length > 300)
      errors.push("Business name exceeds 300 characters.");
    const contactName =
      values.contactName ??
      [values.firstName, values.lastName].filter(Boolean).join(" ");
    if (contactName) {
      if (contactName.length > 300)
        errors.push("Contact name exceeds 300 characters.");
      else row.contactName = contactName;
    }
    if (values.email) {
      const email = normalizeEmail(values.email);
      if (!email) errors.push("Invalid email address.");
      else row.email = email;
    }
    if (values.phone) {
      const phone = normalizePhone(values.phone);
      if (!phone)
        errors.push(
          "Invalid phone; use a US number or an international number beginning with +.",
        );
      else row.phone = phone;
    }
    for (const field of ["websiteUrl", "researchUrl", "facebookUrl"] as const) {
      if (!values[field]) continue;
      const url = normalizeUrl(values[field]);
      if (!url)
        errors.push(
          `Invalid ${field === "websiteUrl" ? "website" : field === "researchUrl" ? "research" : "Facebook"} URL; use HTTP(S) or a domain.`,
        );
      else row[field] = url;
    }
    if (mode === "prospects" && !row.phone && !row.email && !row.websiteUrl)
      errors.push(
        "Provide a phone, email, or website to identify this business.",
      );
    for (const field of [
      "industry",
      "state",
      "city",
      "externalId",
      "outcome",
      "sourceList",
    ] as const) {
      const maximum =
        field === "externalId" ? 500 : field === "state" ? 100 : 200;
      if (values[field] && values[field]!.length > maximum)
        errors.push(`${field} exceeds ${maximum} characters.`);
      else if (values[field]) row[field] = values[field];
    }
    if (values.websiteStatus) {
      const status = websiteStatus(values.websiteStatus);
      row.websiteStatus = status ?? "unknown";
      if (!status) extraNotes.push(`Website Status: ${values.websiteStatus}`);
    }
    if (values.score) {
      const score = Number(values.score);
      if (
        !/^\d+(?:\.\d+)?$/.test(values.score) ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > 100
      )
        errors.push("Score must be a number between 0 and 100.");
      else row.score = score;
    }
    if (values.occurredAt) {
      const occurredAt = normalizedDate(values.occurredAt);
      if (!occurredAt)
        errors.push(
          "Call date must be YYYY-MM-DD or an ISO timestamp with timezone (for example 2026-10-21T14:30:00-04:00).",
        );
      else row.occurredAt = occurredAt;
    }
    if (mode === "dialer") {
      if (!row.phone && !row.email)
        errors.push("Dialer result requires phone or email.");
      if (!row.outcome)
        errors.push("Dialer result requires a disposition or call result.");
      if (!row.externalId && !row.occurredAt)
        errors.push(
          "Dialer result needs a Lead ID/Call ID or a dated call to prevent duplicate activity.",
        );
    }
    const notes = [values.notes, ...extraNotes].filter(Boolean).join("\n");
    if (notes.length > MAX_FIELD_LENGTH)
      errors.push("Combined research notes exceed 20000 characters.");
    else if (notes) row.notes = notes;
    if (errors.length)
      result.errors.push({ row: record.line, message: errors.join(" ") });
    else result.rows.push(row);
  }
  return result;
}
