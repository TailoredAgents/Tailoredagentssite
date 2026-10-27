/** SQL fragments only: callers supply trusted SQL expressions, never user input.
 * Matching an address admits a thread to the CRM; it does not merge histories or
 * choose between duplicate customer records. Explicit links remain authoritative.
 */
export function emailRelationshipSql(workspace: string, addresses: string, links: {
  contactId?: string; leadId?: string; businessId?: string;
} = {}) {
  const normalized = `ARRAY(SELECT lower(btrim(address)) FROM unnest(${addresses}) AS address WHERE btrim(address)<>'')`;
  return `(
    EXISTS(SELECT 1 FROM contacts ep LEFT JOIN crm_businesses eb ON eb.id=ep.business_id AND eb.workspace_id=ep.workspace_id
      WHERE ep.workspace_id=${workspace} AND eb.anonymized_at IS NULL
        AND (ep.id=${links.contactId || "NULL::uuid"} OR lower(btrim(ep.email))=ANY(${normalized})))
    OR EXISTS(SELECT 1 FROM leads el LEFT JOIN crm_businesses eb ON eb.id=el.business_id AND eb.workspace_id=el.workspace_id
      WHERE el.workspace_id=${workspace} AND el.anonymized_at IS NULL AND eb.anonymized_at IS NULL
        AND (el.id=${links.leadId || "NULL::uuid"} OR lower(btrim(el.email))=ANY(${normalized})))
    OR EXISTS(SELECT 1 FROM crm_businesses eb WHERE eb.workspace_id=${workspace} AND eb.anonymized_at IS NULL
        AND (eb.id=${links.businessId || "NULL::uuid"} OR lower(btrim(eb.normalized_email))=ANY(${normalized})))
  )`;
}
