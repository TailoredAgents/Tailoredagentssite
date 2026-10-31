"use client";

import { useId } from "react";
import { EasternDateTimeControl } from "@/components/eastern-date-time-control";
import { BUSINESS_TIME_LABEL } from "@/lib/time";

export function ConversationReminderField({ defaultValue }: { defaultValue: string | null }) {
  const id = useId();
  return <div className="conversation-field"><label htmlFor={id}>Remind at</label>
    <EasternDateTimeControl id={id} name="remindAt" defaultValue={defaultValue} describedBy={`${id}-hint`} />
    <small id={`${id}-hint`}>Time zone: {BUSINESS_TIME_LABEL}. EST/EDT adjusts automatically. To schedule a reminder, set Work status to Needs reply.</small>
  </div>;
}
