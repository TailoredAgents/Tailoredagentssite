"use client";

import { formatEasternTime } from "@/lib/time";

export function InboxTime({ value, short = false }: { value: string; short?: boolean }) {
  return <time dateTime={value}>{formatEasternTime(value, { dateOnly: short, year: false })}</time>;
}
