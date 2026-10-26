"use client";
import { Phone, Plus } from "lucide-react";
import { OperationForm } from "@/components/dashboard/operation-form";
import { savePhoneNumberAction } from "@/lib/conversations/phone-actions";
import { displayPhone, recipientPhones } from "@/lib/conversations/phone-options";
import type { ConversationRecipient } from "@/lib/conversations/types";

export function PhoneNumbers({ recipient, readOnly }: { recipient: ConversationRecipient; readOnly: boolean }) {
  const fields = <><input type="hidden" name="kind" value={recipient.kind}/><input type="hidden" name="id" value={recipient.id}/></>;
  return <section className="crm-phone-numbers" aria-label="Phone numbers">
    <h3><Phone size={16} aria-hidden="true"/>Phone numbers</h3>
    <ul>{recipientPhones(recipient).map(item => <li key={item.phone}>
      <div><strong>{displayPhone(item.phone)}</strong><span>{item.label}{item.primary ? " · Original" : ""}</span>{!item.primary && item.source ? <small>{item.source}</small> : null}</div>
      {!item.primary && !readOnly ? <details><summary>Edit</summary>
        <OperationForm action={savePhoneNumberAction} submitLabel="Save number">{fields}<input type="hidden" name="operation" value="save"/><input type="hidden" name="phone" value={item.phone}/><label className="dashboard-field"><span>Label</span><input name="label" required maxLength={50} defaultValue={item.label}/></label><label className="dashboard-field"><span>Source / note</span><input name="source" maxLength={300} defaultValue={item.source}/></label></OperationForm>
        <OperationForm action={savePhoneNumberAction} submitLabel="Remove number">{fields}<input type="hidden" name="operation" value="remove"/><input type="hidden" name="phone" value={item.phone}/></OperationForm>
      </details> : null}
    </li>)}</ul>
    {!readOnly ? <details className="crm-phone-add"><summary><Plus size={14} aria-hidden="true"/>Add another number</summary>
      <OperationForm action={savePhoneNumberAction} submitLabel="Add number" resetOnSuccess>{fields}<input type="hidden" name="operation" value="save"/>
        <label className="dashboard-field"><span>Phone number</span><input name="phone" type="tel" required maxLength={50} placeholder="(678) 555-0123" autoComplete="off"/></label>
        <label className="dashboard-field"><span>Label</span><input name="label" required maxLength={50} placeholder="Website, Mobile, Office…"/></label>
        <label className="dashboard-field"><span>Source / note (optional)</span><input name="source" maxLength={300} placeholder="Found on their contact page"/></label>
      </OperationForm>
    </details> : null}
  </section>;
}
