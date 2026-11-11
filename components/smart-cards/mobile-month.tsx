"use client";

import {useRef} from "react";
import {CalendarDays, Plus} from "lucide-react";
import {touchesDay, type CalendarEvent} from "@/lib/booking/display";
import styles from "./mobile-month.module.css";

function dateLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {timeZone: "UTC", ...options}).format(new Date(day + "T12:00:00Z"));
}

export function MobileMonth({days, anchor, today, selectedDay, events, canCreate, onSelect, onOpen, onCreate}: {
  days: string[];
  anchor: string;
  today: string;
  selectedDay: string;
  events: CalendarEvent[];
  canCreate: boolean;
  onSelect: (day: string) => void;
  onOpen: (event: CalendarEvent) => void;
  onCreate: (day: string) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const agenda = events.filter(event => touchesDay(event, selectedDay)).sort((a,b) => Number(b.allDay)-Number(a.allDay) || a.start.localeCompare(b.start));
  const time = (event: CalendarEvent) => event.allDay ? "All day" : new Intl.DateTimeFormat("en-US", {timeZone: "America/New_York", hour: "numeric", minute: "2-digit"}).format(new Date(event.start));

  return <div className={styles.month}>
    <table aria-label={dateLabel(anchor, {month: "long", year: "numeric"})}>
      <thead><tr>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
      <tbody>{Array.from({length: days.length / 7}, (_,week) => <tr key={week}>{days.slice(week*7, week*7+7).map((day, offset) => {
        const index = week*7 + offset;
        const count = events.filter(event => touchesDay(event, day)).length;
        return <td key={day}><button
          ref={node => {buttons.current[index] = node;}}
          type="button"
          className={`${day.slice(0,7) !== anchor.slice(0,7) ? styles.otherMonth : ""} ${day === today ? styles.today : ""}`}
          aria-label={`${dateLabel(day, {weekday: "long", month: "long", day: "numeric"})}, ${count} event${count === 1 ? "" : "s"}`}
          aria-pressed={day === selectedDay}
          aria-current={day === today ? "date" : undefined}
          tabIndex={day === selectedDay ? 0 : -1}
          onClick={() => onSelect(day)}
          onKeyDown={event => {
            const next = event.key === "ArrowRight" ? index+1 : event.key === "ArrowLeft" ? index-1 : event.key === "ArrowDown" ? index+7 : event.key === "ArrowUp" ? index-7 : event.key === "Home" ? week*7 : event.key === "End" ? week*7+6 : null;
            if (next === null) return;
            event.preventDefault();
            if (days[next]) {onSelect(days[next]); buttons.current[next]?.focus();}
          }}
        ><span>{Number(day.slice(8))}</span><span className={styles.eventMark} aria-hidden="true">{count > 0 ? <i/> : null}</span></button></td>;
      })}</tr>)}</tbody>
    </table>
    <section className={styles.agenda} aria-label="Selected day agenda">
      <header><div><h3>{dateLabel(selectedDay, {weekday: "short", month: "short", day: "numeric"})}</h3><p>{agenda.length} scheduled · Eastern time</p></div>{canCreate && <button type="button" onClick={() => onCreate(selectedDay)} aria-label={`Add appointment on ${dateLabel(selectedDay, {month: "long", day: "numeric"})}`}><Plus size={18} aria-hidden="true"/></button>}</header>
      {agenda.length ? <ul>{agenda.map(event => <li key={`${event.source}-${event.id}`}><button type="button" onClick={() => onOpen(event)}><time dateTime={event.start}>{time(event)}</time><span><strong>{event.title}</strong><small>{event.person}</small></span></button></li>)}</ul> : <div className={styles.empty}><CalendarDays size={20} aria-hidden="true"/><p>No events on this day.</p></div>}
    </section>
  </div>;
}
