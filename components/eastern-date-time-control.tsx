"use client";

import { useEffect, useRef, useState } from "react";
import { easternInputCandidates, easternInputValue, formatEasternTime } from "@/lib/time";

function initial(defaultValue?: string | null) {
  const value = defaultValue ? easternInputValue(defaultValue) : "";
  return { value, iso: value ? defaultValue! : "", choices: value ? easternInputCandidates(value) : [], error: "" };
}

/** One conversion path for appointments, task dates and Inbox reminders. */
export function EasternDateTimeControl({ name, defaultValue, required = false, id, describedBy }: {
  name: string; defaultValue?: string | null; required?: boolean; id: string; describedBy?: string;
}) {
  const [state, setState] = useState(() => initial(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const reset = () => { setState(initial(defaultValue)); inputRef.current?.setCustomValidity(""); };
    reset();
    const form = inputRef.current?.form;
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);
  const selected = state.choices.find(iso => Math.abs(Date.parse(iso) - Date.parse(state.iso)) < 60000) || "";
  return <>
    <input ref={inputRef} id={id} type="datetime-local" name={`${name}Local`} value={state.value} required={required}
      aria-invalid={state.error ? true : undefined} aria-describedby={[describedBy, state.error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
      onChange={event => {
        const value = event.target.value;
        const choices = easternInputCandidates(value);
        const error = value && !choices.length ? "This time does not exist in US Eastern time. Choose another time (the spring clock change skips 2:00–2:59 AM)." : "";
        event.currentTarget.setCustomValidity(error);
        setState({ value, choices, iso: choices[0] || "", error });
      }} />
    <input type="hidden" name={name} value={state.iso} />
    {state.error ? <small id={`${id}-error`} role="alert">{state.error}</small> : null}
    {state.choices.length > 1 ? <label>That hour occurs twice. Choose which time:
      <select aria-label="Daylight saving time occurrence" value={selected} onChange={event => setState(current => ({ ...current, iso: event.target.value }))}>
        {state.choices.map((iso, index) => <option key={iso} value={iso}>{index === 0 ? "First" : "Second"} occurrence — {formatEasternTime(iso)}</option>)}
      </select>
    </label> : null}
  </>;
}
