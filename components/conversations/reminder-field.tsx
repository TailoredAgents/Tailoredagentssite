"use client";

import { useEffect, useId, useState } from "react";

function localInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ConversationReminderField({ defaultValue }: { defaultValue: string | null }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [iso, setIso] = useState(defaultValue || "");
  const [zone, setZone] = useState("your device timezone");
  useEffect(() => { setValue(defaultValue ? localInput(defaultValue) : ""); setIso(defaultValue || ""); setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, [defaultValue]);
  return <div className="conversation-field"><label htmlFor={id}>Remind at</label><input id={id} type="datetime-local" name="remindAtLocal" value={value} aria-describedby={`${id}-hint`} onChange={(event) => {
    const next = event.target.value; setValue(next);
    const date = new Date(next); setIso(next && !Number.isNaN(date.getTime()) ? date.toISOString() : "");
  }} /><input type="hidden" name="remindAt" value={iso} /><small id={`${id}-hint`}>Time zone: {zone}. To schedule a reminder, set Work status to Needs reply.</small></div>;
}
