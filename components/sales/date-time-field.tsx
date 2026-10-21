"use client";

import { useEffect, useRef, useState } from "react";

function localInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateTimeField({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  const [value, setValue] = useState("");
  const [iso, setIso] = useState(defaultValue || "");
  const [zone, setZone] = useState("your device timezone");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setValue(defaultValue ? localInput(defaultValue) : "");
    setIso(defaultValue || "");
    const form = inputRef.current?.form;
    const reset = () => { setValue(defaultValue ? localInput(defaultValue) : ""); setIso(defaultValue || ""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);
  return <label className="dashboard-field dashboard-field-full"><span>{label}</span><input ref={inputRef} type="datetime-local" name={`${name}Local`} value={value} required={required} onChange={(event) => {
    const next = event.target.value;
    setValue(next);
    const parsed = new Date(next);
    setIso(next && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "");
  }} /><input type="hidden" name={name} value={iso} /><small>Time zone: {zone}</small></label>;
}

export function LocalTime({ value, dateOnly = false }: { value: string; dateOnly?: boolean }) {
  const [formatted, setFormatted] = useState(() => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC", ...(!dateOnly ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const : {}) }).format(new Date(value)));
  useEffect(() => { setFormatted(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(!dateOnly ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const : {}) }).format(new Date(value))); }, [value, dateOnly]);
  return <time dateTime={value}>{formatted}</time>;
}
