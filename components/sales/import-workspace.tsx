"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { importDialerResultsAction, importProspectsAction } from "@/lib/sales/actions";
import { parseProspectCsv, type CsvImportResult } from "@/lib/sales/import";
import type { SalesMember } from "@/lib/sales/types";

const fieldLabels: Record<string, string> = { businessName: "Business name", contactName: "Contact name", firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", websiteUrl: "Website", industry: "Industry", state: "State / region", websiteStatus: "Website status", score: "Research score", researchUrl: "Evidence URL", notes: "Notes", externalId: "BatchDialer / external ID", outcome: "Call outcome", occurredAt: "Call date / time", city: "City", facebookUrl: "Facebook URL", sourceList: "Source list / campaign" };

export function ImportWorkspace({ members, disabled, currentUserId }: { members: SalesMember[]; disabled: boolean; currentUserId: string }) {
  const [mode, setMode] = useState<"prospects" | "dialer">("prospects");
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [revision, setRevision] = useState(0);
  const hasErrors = !!error || !!preview?.errors.length || !preview?.rows.length;
  return <div className="sales-import-body">
    <div className="sales-import-steps" aria-label="Import steps"><div className={!preview ? "is-active" : ""}><i>1</i>Choose CSV</div><div className={preview ? "is-active" : ""}><i>2</i>Review columns</div><div><i>3</i>Confirm import</div></div>
    <div className="dashboard-form-grid" style={{ marginBottom: "1rem" }}><label className="dashboard-field dashboard-field-full"><span>What are you importing?</span><select value={mode} disabled={disabled || reading} onChange={(event) => { setMode(event.target.value as "prospects" | "dialer"); setCsv(""); setFilename(""); setPreview(null); setError(""); setRevision((value) => value + 1); }}><option value="prospects">Researched prospect calling list</option><option value="dialer">BatchDialer call results</option></select><small>{mode === "prospects" ? "Create connected businesses and sales opportunities. Matching businesses are reused." : "Add outcomes to existing opportunities using an exact phone or email match. Unmatched results never create prospects."}</small></label></div>
    <label className="sales-upload-zone"><FileSpreadsheet size={30} /><strong>{filename || "Choose your CSV export"}</strong><small>UTF-8 CSV · up to 750 KB and 1,000 rows per reviewed import<br />For an Excel list, save the sheet as CSV first.</small><input key={`${mode}-${revision}`} type="file" accept=".csv,text/csv" aria-label="Choose CSV to review" disabled={disabled || reading} onChange={async (event) => {
      const file = event.target.files?.[0];
      setError(""); setCsv(""); setPreview(null); setFilename(file?.name || "");
      if (!file) return;
      if (file.size > 750000) { setError("This file exceeds 750 KB. Split it into smaller lists before importing."); return; }
      setReading(true);
      try { const source = await file.text(); const result = parseProspectCsv(source, { mode }); setCsv(source); setPreview(result); if (result.rows.length > 1000) setError("This file has more than 1,000 valid rows. Split it into smaller lists before importing."); }
      catch { setError("This file could not be read. Please use a UTF-8 CSV export."); }
      finally { setReading(false); }
    }} /></label>
    {reading ? <p className="sales-panel-copy" role="status">Reading your CSV…</p> : null}
    {error ? <p className="sales-import-error" role="alert">{error}</p> : null}
    {preview ? <>
      <div className="sales-section-title" style={{ marginTop: "1.5rem" }}><div><h2>Review the detected columns</h2><p>{preview.rows.length.toLocaleString()} valid rows · {preview.headers.length} source columns</p></div></div>
      <div className="sales-mapping-chips">{preview.mapping.map((mapping) => <div key={mapping.header}><span>{mapping.header}</span><strong>{fieldLabels[mapping.field] || mapping.field}</strong></div>)}</div>
      {preview.unmappedHeaders.length ? <p className="sales-import-warning"><strong>Additional columns:</strong> {preview.unmappedHeaders.join(", ")}. Extra research fields are retained in notes where present. Rename a column in your source CSV if it should populate a specific CRM field.</p> : null}
      {preview.errors.length ? <div className="sales-import-error" role="alert"><strong>Fix these rows before importing.</strong><ul>{preview.errors.slice(0, 30).map((issue, index) => <li key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</li>)}</ul>{preview.errors.length > 30 ? <p>Plus {preview.errors.length - 30} more validation issues. Correct and upload the file again.</p> : null}</div> : null}
      {preview.rows.length ? <><div className="sales-section-title" style={{ marginTop: "1.5rem" }}><div><h2>Check your records</h2><p>{preview.rows.length > 100 ? "Showing the first 100 rows. The full reviewed file will be imported." : "Every valid row is shown below."}</p></div></div><div className="sales-review-scroll"><table className="sales-table"><thead><tr><th>Row</th><th>{mode === "dialer" ? "Match to existing contact" : "Business / contact"}</th><th>{mode === "dialer" ? "Outcome" : "Industry / region"}</th><th>{mode === "dialer" ? "Call identity / time" : "Website / score"}</th><th>Notes</th></tr></thead><tbody>{preview.rows.slice(0, 100).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td><strong>{row.businessName || row.contactName || "Existing business match"}</strong><small>{[row.contactName, row.email, row.phone].filter(Boolean).join(" · ") || "No identity provided"}</small></td><td>{mode === "dialer" ? row.outcome : [row.industry, row.state].filter(Boolean).join(" · ") || "—"}</td><td>{mode === "dialer" ? <><strong>{row.externalId || "Timestamp identity"}</strong><small>{row.occurredAt || "Not provided"}</small></> : <><strong>{row.websiteUrl || row.websiteStatus?.replaceAll("_", " ") || "Not researched"}</strong><small>{row.score !== undefined ? `Score ${row.score}` : "No score"}</small></>}</td><td><span className="sales-preview-note">{row.notes || "—"}</span></td></tr>)}</tbody></table></div></> : null}
      <p className="sales-import-warning">Existing identities are checked again on the server. Exact phone, email, or website matches reuse the business; ambiguous matches are skipped. Existing details are preserved. {mode === "dialer" ? "Repeated call-result imports are deduplicated." : "List membership is retained for reporting."}</p>
      <OperationForm key={`${mode}-${filename}-${csv.length}`} action={mode === "prospects" ? importProspectsAction : importDialerResultsAction} submitLabel={mode === "prospects" ? `Import ${preview.rows.length.toLocaleString()} reviewed prospects` : `Import ${preview.rows.length.toLocaleString()} reviewed results`} pendingLabel="Validating & importing" disabled={disabled || hasErrors} className="sales-import-confirm"><input name="csv" type="hidden" value={csv} /><div className="dashboard-form-grid"><label className="dashboard-field"><span>{mode === "prospects" ? "Calling list name *" : "Results batch name *"}</span><input name="listName" required minLength={2} maxLength={160} placeholder={mode === "prospects" ? "e.g. Georgia home services — October" : "e.g. Devon — October 21 call results"} defaultValue={filename.replace(/\.csv$/i, "")} /></label><label className="dashboard-field"><span>{mode === "prospects" ? "Assign opportunities to" : "Import owner"}</span><select name="ownerUserId" defaultValue={currentUserId}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="dashboard-check"><input type="checkbox" name="reviewed" required /><span>I reviewed the column mapping and records. Import this file into our sales workspace.</span></label></div></OperationForm>
    </> : <div className="sales-import-guide"><strong>Expected columns</strong><p>{mode === "prospects" ? "Business Name, Contact Name, Phone, Email, Website, Industry, State, Website Status, Score, Research URL, Notes. Common BatchDialer headers are recognized, including Company Name and Phone Number 1." : "Phone or Email, Outcome / Disposition, and an External ID or Call Date. Timestamps require an explicit timezone (for example 2026-10-21T14:30:00-04:00); date-only values use UTC."}</p></div>}
  </div>;
}
