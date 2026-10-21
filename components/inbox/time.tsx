"use client";

import { useEffect, useState } from "react";

function format(value: string, local = false, short = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(short ? {} : { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const), ...(local ? {} : { timeZone: "UTC" }) }).format(date);
}

export function InboxTime({ value, short = false }: { value: string; short?: boolean }) {
  const [label, setLabel] = useState(() => format(value, false, short));
  useEffect(() => setLabel(format(value, true, short)), [value, short]);
  return <time dateTime={value}>{label}</time>;
}
