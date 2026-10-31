"use client";

import { useId } from "react";
import { EasternDateTimeControl } from "@/components/eastern-date-time-control";
import { BUSINESS_TIME_LABEL, formatEasternTime } from "@/lib/time";

export function DateTimeField({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  const id = useId();
  return <div className="dashboard-field dashboard-field-full"><span><label htmlFor={id}>{label}</label></span>
    <EasternDateTimeControl id={id} name={name} defaultValue={defaultValue} required={required} describedBy={`${id}-hint`} />
    <small id={`${id}-hint`}>Time zone: {BUSINESS_TIME_LABEL}. EST/EDT adjusts automatically.</small>
  </div>;
}

export function LocalTime({ value, dateOnly = false }: { value: string; dateOnly?: boolean }) {
  return <time dateTime={value}>{formatEasternTime(value, { dateOnly })}</time>;
}
