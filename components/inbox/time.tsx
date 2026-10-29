"use client";

import { useEffect, useState } from "react";

function format(value: string, local = false, short = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  // Intl punctuation differs between Node/Chromium and Safari. Keep the
  // server and first client render identical, then show the local time.
  if (!local) {
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()];
    const day = `${month} ${date.getUTCDate()}`;
    const hour = date.getUTCHours();
    return short ? day : `${day}, ${hour % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"} UTC`;
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(short ? {} : { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const) }).format(date);
}

export function InboxTime({ value, short = false }: { value: string; short?: boolean }) {
  const [label, setLabel] = useState(() => format(value, false, short));
  useEffect(() => setLabel(format(value, true, short)), [value, short]);
  return <time dateTime={value}>{label}</time>;
}
