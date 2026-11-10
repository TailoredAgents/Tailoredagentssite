"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  RefreshCw,
  Clock3,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { easternInputValue, formatEasternTime } from "@/lib/time";
import {
  shiftDay,
  shiftMonth,
  viewDays,
  touchesDay,
  type CalendarEvent,
  type CalendarView,
} from "@/lib/booking/display";
import { DateTimeField } from "@/components/sales/date-time-field";
import {
  CalendarEditor,
  CalendarForm,
  CalendarModal,
  type CalendarData,
  type CalendarDraft,
} from "./calendar-editor";
import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/classic";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import interactionPlugin from "@fullcalendar/react/interaction";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
const plugins = [
  themePlugin,
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin,
];
const colors: Record<string, { ink: string; bg: string }> = {
  austin: { ink: "#2459bd", bg: "#e5edff" },
  jeffrey: { ink: "#6941a5", bg: "#f0e8fc" },
  devon: { ink: "#146653", bg: "#def3ea" },
  conner: { ink: "#895215", bg: "#fff0d8" },
};
function color(profile: string | null) {
  const c = colors[profile ?? ""] ?? { ink: "#52637d", bg: "#e8edf5" };
  return { "--event-color": c.ink, "--event-bg": c.bg } as CSSProperties;
}
function dateLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(day + "T12:00:00Z"));
}
function clock(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function BookingCalendar({
  data,
  today,
  anchor,
  view,
}: {
  data: CalendarData;
  today: string;
  anchor: string;
  view: CalendarView;
}) {
  const router = useRouter(),
    [pending, startTransition] = useTransition(),
    [selected, setSelected] = useState<string[]>(() =>
      data.profiles.map((p) => p.slug).concat("unassigned"),
    ),
    [draft, setDraft] = useState<CalendarDraft | null>(null),
    [detail, setDetail] = useState<CalendarEvent | null>(null),
    [notice, setNotice] = useState(""),
    [opening, setOpening] = useState(false),
    [sidebar, setSidebar] = useState(false),
    [mobile, setMobile] = useState(false),
    [workweek, setWorkweek] = useState(false),
    [peek, setPeek] = useState<{
      event: CalendarEvent;
      left: number;
      top: number;
    } | null>(null);
  const days = viewDays(anchor, view),
    miniDays = viewDays(anchor, "month");
  // Revalidation can remove a cancelled entry (and its form) before the form's
  // success effect runs. Close the detail dialog from the authoritative data too.
  useEffect(() => {
    if (!detail) return;
    const exists =
      detail.source === "slot"
        ? data.slots.some(
            (s) =>
              s.id === detail.id && !["closed", "cancelled"].includes(s.status),
          )
        : data.tasks.some((t) => t.id === detail.id);
    if (!exists) {
      setDetail(null);
      setNotice("Calendar updated.");
    }
  }, [detail, data.slots, data.tasks]);
  useEffect(() => {
    if (
      !new URLSearchParams(window.location.search).has("view") &&
      window.matchMedia("(max-width:760px)").matches
    )
      router.replace(`/dashboard/calendar?date=${anchor}&view=day`, {
        scroll: false,
      });
  }, [anchor, router]);
  useEffect(() => {
    const query = window.matchMedia("(max-width:760px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (draft || detail || opening) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [router, draft, detail, opening]);
  const profiles = data.profiles,
    editable = profiles.filter((p) => p.editable),
    defaultProfile =
      editable.find((p) => selected.includes(p.slug))?.slug ??
      editable[0]?.slug ??
      "";
  const events: CalendarEvent[] = [
    ...data.slots
      .filter((s) => s.status !== "cancelled")
      .map((s) => ({
        id: s.id,
        source: "slot" as const,
        profile: s.profile,
        person: s.person,
        title:
          s.title ??
          (s.status === "booked"
            ? `Call · ${s.name ?? "Client"}`
            : s.status === "open"
              ? "Extra availability"
              : "Busy"),
        start: s.startsAt,
        end: s.endsAt,
        allDay: s.allDay,
        status: s.status,
      })),
    ...data.tasks.map((t) => ({
      id: t.id,
      source: "task" as const,
      profile: t.profile_slug,
      person: t.owner_name ?? "Unassigned",
      title: t.title,
      start: t.due_at,
      end:
        t.end_at && Date.parse(t.end_at) > Date.parse(t.due_at)
          ? t.end_at
          : new Date(Date.parse(t.due_at) + 1800000).toISOString(),
      allDay: false,
      status: "appointment",
    })),
  ].filter((e) => selected.includes(e.profile ?? "unassigned"));
  const weekendEvents =
    view === "week" && workweek
      ? events.filter((e) => touchesDay(e, days[0]) || touchesDay(e, days[6]))
          .length
      : 0;
  const dayEvents = [...events].sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start),
  );
  function navigate(date: string, nextView = view) {
    setPeek(null);
    setNotice("");
    startTransition(() =>
      router.replace(`/dashboard/calendar?date=${date}&view=${nextView}`, {
        scroll: false,
      }),
    );
  }
  function move(n: number) {
    navigate(
      view === "month"
        ? shiftMonth(anchor, n)
        : shiftDay(anchor, n * (view === "week" ? 7 : 1)),
    );
  }
  function saved() {
    setOpening(false);
    setDraft(null);
    setDetail(null);
    setNotice("Calendar saved. Online availability is updated.");
    router.refresh();
  }
  function showPeek(event: CalendarEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    setPeek({
      event,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)),
      top:
        rect.bottom + 160 > window.innerHeight
          ? Math.max(12, rect.top - 150)
          : rect.bottom + 8,
    });
  }
  function openEvent(event: CalendarEvent) {
    setPeek(null);
    const s =
      event.source === "slot"
        ? data.slots.find((s) => s.id === event.id)
        : undefined;
    if (
      s?.isBlock &&
      s.status === "blocked" &&
      profiles.find((p) => p.slug === s.profile)?.editable
    )
      setDraft({
        day: easternInputValue(s.startsAt).slice(0, 10),
        minute: 540,
        slot: s,
      });
    else setDetail(event);
  }
  function newEvent(
    day = anchor,
    minute = 540,
    kind: CalendarDraft["kind"] = "appointment",
  ) {
    if (editable.length) setDraft({ day, minute, kind });
  }
  const detailSlot =
      detail?.source === "slot"
        ? data.slots.find((s) => s.id === detail.id)
        : undefined,
    detailTask =
      detail?.source === "task"
        ? data.tasks.find((t) => t.id === detail.id)
        : undefined;
  return (
    <div className={`tc-workspace ${sidebar ? "tc-with-sidebar" : ""}`}>
      <header className="tc-page-heading">
        <div>
          <h1>Team calendar</h1>
          <p>Appointments, meetings, and time for everything else.</p>
        </div>
        <div className="tc-create-actions">
          <button
            className="tc-secondary"
            disabled={!editable.length}
            onClick={() => newEvent(anchor, 540, "busy")}
          >
            <Clock3 size={18} />
            Block time
          </button>
          <button
            className="dashboard-primary-button"
            disabled={!editable.length}
            onClick={() => newEvent()}
          >
            <Plus size={19} />
            New appointment
          </button>
        </div>
      </header>
      <div className="tc-team-strip" aria-label="Choose whose calendar to show">
        <span>Show calendar</span>
        <button
          aria-pressed={profiles.every((p) => selected.includes(p.slug))}
          onClick={() =>
            setSelected(profiles.map((p) => p.slug).concat("unassigned"))
          }
        >
          Everyone
        </button>
        {profiles.map((p) => (
          <button
            key={p.slug}
            style={color(p.slug)}
            aria-pressed={selected.length === 1 && selected[0] === p.slug}
            onClick={() => setSelected([p.slug])}
          >
            <i />
            {p.display_name.split(" ")[0]}
          </button>
        ))}
        <span className="tc-zone-label">US Eastern · EST / EDT</span>
      </div>
      {sidebar ? (
        <aside className="tc-sidebar" aria-label="Calendar options">
          <section className="tc-mini" aria-label="Date picker">
            <header>
              <strong>
                {dateLabel(anchor, { month: "long", year: "numeric" })}
              </strong>
              <div>
                <button
                  className="tc-icon"
                  aria-label="Previous month in date picker"
                  onClick={() => navigate(shiftMonth(anchor, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="tc-icon"
                  aria-label="Next month in date picker"
                  onClick={() => navigate(shiftMonth(anchor, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </header>
            <div className="tc-mini-grid">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
              {miniDays.map((day) => (
                <button
                  key={day}
                  aria-label={dateLabel(day, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  aria-pressed={day === anchor}
                  className={day === today ? "is-today" : ""}
                  onClick={() => navigate(day)}
                >
                  {Number(day.slice(8))}
                </button>
              ))}
            </div>
          </section>
          <section className="tc-calendars">
            <h2>Overlay calendars</h2>
            <p>Choose any combination.</p>
            {profiles.map((p) => (
              <label key={p.slug} style={color(p.slug)}>
                <input
                  type="checkbox"
                  checked={selected.includes(p.slug)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, p.slug]
                        : s.filter((v) => v !== p.slug),
                    )
                  }
                />
                {p.display_name}
              </label>
            ))}
            {data.tasks.some((t) => !t.profile_slug) ? (
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes("unassigned")}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, "unassigned"]
                        : s.filter((v) => v !== "unassigned"),
                    )
                  }
                />
                Unassigned appointments
              </label>
            ) : null}
          </section>
          <details className="tc-hours">
            <summary>Booking hours & details</summary>
            <p>
              Online consultations use your regular hours, with two hours’
              notice and up to 90 days ahead.
            </p>
            {profiles
              .filter((p) => p.opens_minute !== null)
              .map((p) => (
                <p key={p.slug}>
                  <strong>{p.display_name.split(" ")[0]}</strong> ·{" "}
                  {Math.floor(p.opens_minute! / 60) % 12 || 12}
                  {p.opens_minute! >= 720 ? " PM" : " AM"}–
                  {Math.floor(p.closes_minute! / 60) % 12 || 12}
                  {p.closes_minute! >= 720 ? " PM" : " AM"} daily
                </p>
              ))}
            <p>
              Events block online availability. Google calendars and automatic
              invitations are not connected.
            </p>
            <Link href="/dashboard/sales/today">Open My day →</Link>
            {data.canEdit ? (
              <button
                type="button"
                className="tc-extra-opening"
                onClick={() => setOpening(true)}
              >
                Add an extra consultation opening
              </button>
            ) : null}
          </details>
        </aside>
      ) : null}
      <section
        className="tc-main"
        aria-label="Team calendar events"
        aria-busy={pending}
      >
        <header className="tc-toolbar">
          <div className="tc-navigation">
            <button
              className="tc-icon"
              aria-label={
                sidebar ? "Hide calendar options" : "Show calendar options"
              }
              aria-expanded={sidebar}
              onClick={() => setSidebar(!sidebar)}
            >
              {sidebar ? (
                <PanelLeftClose size={20} />
              ) : (
                <PanelLeftOpen size={20} />
              )}
            </button>
            <button className="tc-secondary" onClick={() => navigate(today)}>
              Today
            </button>
            <button
              className="tc-icon"
              aria-label={`Previous ${view}`}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="tc-icon"
              aria-label={`Next ${view}`}
              onClick={() => move(1)}
            >
              <ChevronRight size={20} />
            </button>
            <h2>
              {view === "day"
                ? dateLabel(anchor, {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                  })
                : view === "week"
                  ? `${dateLabel(days[workweek ? 1 : 0], { month: "short", day: "numeric" })} – ${dateLabel(days[workweek ? 5 : 6], { month: "short", day: "numeric", year: "numeric" })}`
                  : dateLabel(anchor, { month: "long", year: "numeric" })}
            </h2>
          </div>
          <div className="tc-view-controls">
            <button
              className="tc-icon"
              aria-label="Refresh calendar"
              disabled={pending}
              onClick={() => startTransition(() => router.refresh())}
            >
              <RefreshCw size={18} />
            </button>
            {view === "week" ? (
              <button
                className="tc-workweek"
                aria-pressed={workweek}
                onClick={() => setWorkweek(!workweek)}
              >
                Workweek
              </button>
            ) : null}
            <div
              className="tc-view-switch"
              role="group"
              aria-label="Calendar view"
            >
              {(["day", "week", "month"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={view === value}
                  onClick={() => navigate(anchor, value)}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </header>
        {notice ? (
          <p role="status" className="tc-notice">
            {notice}
          </p>
        ) : null}
        {data.truncated ? (
          <p role="alert" className="tc-error">
            There are more events than can be shown. Switch to a shorter date
            range to see all entries.
          </p>
        ) : null}
        {!events.length ? (
          <div className="tc-empty">
            <CalendarDays size={22} />
            <div>
              <strong>
                {selected.length
                  ? "Your schedule is clear"
                  : "No calendars selected"}
              </strong>
              <span>
                {selected.length
                  ? "Add an appointment or block time using the buttons above."
                  : "Choose a person above or select calendars in Calendar options."}
              </span>
            </div>
          </div>
        ) : null}
        {weekendEvents > 0 ? (
          <div className="tc-weekend-notice">
            {weekendEvents} event{weekendEvents === 1 ? "" : "s"} touch the
            weekend.{" "}
            <button onClick={() => setWorkweek(false)}>Show full week</button>
          </div>
        ) : null}
        <div className={`tc-view-body tc-view-${view}`}>
          <div
            className={`tc-calendar-surface ${view === "week" || view === "month" ? "tc-wide-grid" : ""}`}
          >
            <FullCalendar
              key={`${anchor}-${view}-${mobile}-${workweek}`}
              plugins={plugins}
              initialDate={anchor}
              initialView={
                view === "month"
                  ? "dayGridMonth"
                  : view === "week"
                    ? "timeGridWeek"
                    : mobile
                      ? "listDay"
                      : "timeGridDay"
              }
              headerToolbar={false}
              timeZone="America/New_York"
              firstDay={0}
              weekends={view !== "week" || !workweek}
              expandRows={view === "month"}
              dayRowClass={view === "month" ? "tc-month-row" : undefined}
              fixedWeekCount={true}
              height={
                mobile && view === "day"
                  ? "auto"
                  : view === "month"
                    ? "auto"
                    : "clamp(480px, calc(100dvh - 350px), 1050px)"
              }
              scrollTime="08:00:00"
              scrollTimeReset={true}
              slotDuration="00:30:00"
              slotHeaderInterval="01:00:00"
              slotMinHeight={34}
              nowIndicator={true}
              slotEventOverlap={false}
              allDaySlot={true}
              dayMaxEvents={2}
              eventMaxStack={view === "week" ? 2 : undefined}
              eventMinHeight={28}
              eventDisplay="block"
              eventInteractive={true}
              dayHeaders={view !== "day"}
              dayHeaderFormat={
                view === "month"
                  ? { weekday: "short" }
                  : { weekday: "short", day: "numeric" }
              }
              dayHeaderContent={(info) =>
                view === "month" ? (
                  <span className="tc-weekday-name">{info.weekdayText}</span>
                ) : (
                  <button
                    type="button"
                    aria-label={`View ${formatEasternTime(info.date.toISOString(), { dateOnly: true })}`}
                    onClick={() =>
                      navigate(
                        easternInputValue(info.date.toISOString()).slice(0, 10),
                        "day",
                      )
                    }
                    className={`tc-day-heading ${info.isToday ? "tc-today-heading" : ""}`}
                  >
                    <span>{info.weekdayText}</span>
                    <strong>{info.dayNumberText}</strong>
                    {info.isToday ? <small>Today</small> : null}
                  </button>
                )
              }
              dayCellTopContent={(info) => (
                <span
                  className={`tc-month-date ${info.isToday ? "tc-today-date" : ""}`}
                >
                  {info.dayNumberText}
                </span>
              )}
              dayCellTopClass="tc-date-top"
              dayCellClass={(info) =>
                `tc-grid-cell ${info.isToday ? "tc-today-cell" : ""} ${info.isOther ? "tc-other-month" : ""}`
              }
              moreLinkContent={(info) => (
                <span className="tc-more-label">+{info.num} more</span>
              )}
              moreLinkClick={(info) => {
                if (view === "month")
                  navigate(
                    easternInputValue(info.date.toISOString()).slice(0, 10),
                    "day",
                  );
                else return "popover";
              }}
              slotHeaderFormat={{
                hour: "numeric",
                minute: "2-digit",
                omitZeroMinute: true,
                meridiem: "short",
              }}
              dayHeaderClass="tc-grid-day"
              slotHeaderClass="tc-grid-hour"
              slotLaneClass="tc-grid-slot"
              selectable={editable.length > 0}
              editable={false}
              selectMirror={true}
              selectMinDistance={5}
              longPressDelay={250}
              dateClick={(info) => {
                if (editable.length) {
                  const local = info.dateStr;
                  setDraft({
                    day: local.slice(0, 10),
                    minute: info.allDay
                      ? 540
                      : Number(local.slice(11, 13)) * 60 +
                        Number(local.slice(14, 16)),
                    allDay: info.allDay,
                    kind: "appointment",
                  });
                }
              }}
              select={(info) => {
                if (editable.length)
                  setDraft({
                    day: info.startStr.slice(0, 10),
                    minute: 540,
                    start: info.allDay ? undefined : info.start.toISOString(),
                    end: info.allDay ? undefined : info.end.toISOString(),
                    allDay: info.allDay,
                    lastDay: info.allDay
                      ? shiftDay(info.endStr.slice(0, 10), -1)
                      : undefined,
                    kind: "appointment",
                  });
              }}
              events={events.map((e) => ({
                id: `${e.source}-${e.id}`,
                title: e.title,
                start: e.allDay
                  ? easternInputValue(e.start).slice(0, 10)
                  : e.start,
                end: e.allDay ? easternInputValue(e.end).slice(0, 10) : e.end,
                allDay: e.allDay,
                color:
                  view === "month"
                    ? (colors[e.profile ?? ""]?.bg ?? "#e8edf5")
                    : (colors[e.profile ?? ""]?.ink ?? "#52637d"),
                contrastColor:
                  view === "month"
                    ? (colors[e.profile ?? ""]?.ink ?? "#52637d")
                    : "#fff",
                extendedProps: { entry: e },
              }))}
              eventClass={(info) =>
                `tc-event ${view === "month" ? "tc-compact-event" : ""} ${info.event.allDay ? "tc-all-day-event" : "tc-timed-event"}`
              }
              eventDidMount={(info) => {
                const e = info.event.extendedProps.entry as
                  | CalendarEvent
                  | undefined;
                if (!e) return;
                info.el.onfocus = () => showPeek(e, info.el);
                info.el.onblur = () => setPeek(null);
                info.el.setAttribute(
                  "aria-label",
                  `${e.title} · ${e.person} · ${e.allDay ? "All day" : clock(e.start) + " – " + clock(e.end)}`,
                );
              }}
              eventWillUnmount={(info) => {
                info.el.onfocus = null;
                info.el.onblur = null;
              }}
              eventMouseEnter={(info) => {
                const e = info.event.extendedProps.entry as
                  | CalendarEvent
                  | undefined;
                if (e && !mobile) showPeek(e, info.el);
              }}
              eventMouseLeave={() => setPeek(null)}
              eventContent={(info) => {
                const event = info.event.extendedProps.entry as
                  | CalendarEvent
                  | undefined;
                if (!event)
                  return (
                    <div className="tc-event-copy">
                      <strong>New appointment</strong>
                    </div>
                  );
                if (view === "month")
                  return (
                    <div className="tc-month-event">
                      <span>
                        {event.allDay ? "All day" : clock(event.start)}
                      </span>
                      <strong>{event.title}</strong>
                    </div>
                  );
                return (
                  <div className="tc-event-copy">
                    <strong>{event.title}</strong>
                    <span>
                      {event.allDay ? "All day" : clock(event.start)} ·{" "}
                      {event.person.split(" ")[0]}
                    </span>
                  </div>
                );
              }}
              eventClick={(info) =>
                openEvent(info.event.extendedProps.entry as CalendarEvent)
              }
              noEventsContent={
                <span className="tc-agenda-empty">
                  Nothing scheduled. Your next appointment will appear here.
                </span>
              }
            />
          </div>
          {view === "day" && !mobile ? (
            <aside className="tc-day-agenda" aria-label="Daily agenda">
              <div className="tc-agenda-heading">
                <span>THE DAY AT A GLANCE</span>
                <h3>{dateLabel(anchor, { weekday: "long" })}</h3>
                <p>
                  {dateLabel(anchor, { month: "long", day: "numeric" })} ·{" "}
                  {dayEvents.length} scheduled
                </p>
              </div>
              {dayEvents.length ? (
                <div className="tc-agenda-items">
                  {dayEvents.map((event) => (
                    <button
                      key={`${event.source}-${event.id}`}
                      style={color(event.profile)}
                      onClick={() => openEvent(event)}
                    >
                      <span className="tc-agenda-time">
                        {event.allDay
                          ? "All day"
                          : `${clock(event.start)} – ${clock(event.end)}`}
                      </span>
                      <strong>{event.title}</strong>
                      <span className="tc-agenda-person">
                        <i />
                        {event.person}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="tc-agenda-clear">
                  <CalendarDays size={30} />
                  <strong>Room in your day</strong>
                  <p>
                    Add a client appointment, a meeting, or time to focus. It
                    will appear here with the details.
                  </p>
                </div>
              )}
              <div className="tc-agenda-tip">
                <Clock3 size={17} />
                <p>
                  Everything is shown in Eastern time. Scheduled events block
                  online availability.
                </p>
              </div>
            </aside>
          ) : null}
        </div>
        <footer className="tc-footer">
          <span>
            {pending
              ? "Loading calendar…"
              : `${events.length} event${events.length === 1 ? "" : "s"} · ${selected.length === 1 ? (profiles.find((p) => p.slug === selected[0])?.display_name ?? "Unassigned") : "Team view"}`}
          </span>
          <span>
            {mobile
              ? "Tap an event to view or edit"
              : "Click or drag on the calendar to schedule · Click an event to edit"}
          </span>
        </footer>
      </section>
      {peek ? (
        <div
          className="tc-event-peek"
          role="tooltip"
          style={{
            ...color(peek.event.profile),
            left: peek.left,
            top: peek.top,
          }}
        >
          <span>
            <i />
            {peek.event.person}
          </span>
          <strong>{peek.event.title}</strong>
          <p>
            {peek.event.allDay
              ? "All day"
              : `${clock(peek.event.start)} – ${clock(peek.event.end)}`}{" "}
            · Eastern
          </p>
          <small>Click to view or edit</small>
        </div>
      ) : null}
      {opening ? (
        <CalendarModal
          title="Extra consultation opening"
          onClose={() => setOpening(false)}
        >
          <CalendarForm label="Add opening" onSaved={saved}>
            <input type="hidden" name="operation" value="publish" />
            <input type="hidden" name="mode" value="open" />
            <label>
              Calendar
              <select name="profile" defaultValue={defaultProfile}>
                {profiles.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </label>
            <DateTimeField name="startsAt" label="Starts" required />
            <label>
              Duration
              <select name="minutes" defaultValue="30">
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </label>
            <p className="tc-hint">
              Choose a time outside existing openings, appointments and blocks.
              Online bookings need two hours’ notice and are available up to 90
              days ahead.
            </p>
          </CalendarForm>
        </CalendarModal>
      ) : null}
      {draft ? (
        <CalendarEditor
          key={draft.slot?.id ?? `${draft.day}-${draft.minute}`}
          draft={draft}
          data={data}
          defaultProfile={defaultProfile}
          onClose={() => setDraft(null)}
          onSaved={saved}
        />
      ) : null}
      {detail ? (
        <CalendarModal title={detail.title} onClose={() => setDetail(null)}>
          <div className="tc-detail">
            <p style={color(detail.profile)} className="tc-person">
              {detail.person}
            </p>
            <p>
              {formatEasternTime(detail.start)}
              <br />
              to {formatEasternTime(detail.end)}
            </p>
            {detailSlot?.location ? (
              <p>
                <MapPin size={16} />
                {detailSlot.location}
              </p>
            ) : null}
            {detailSlot?.notes ? (
              <p className="tc-notes">{detailSlot.notes}</p>
            ) : null}
            {detailSlot?.phone ? (
              <a href={`tel:${detailSlot.phone.replace(/[^+\d]/g, "")}`}>
                {detailSlot.phone}
              </a>
            ) : null}
            {detailSlot?.leadId ? (
              <Link href={`/dashboard/leads/${detailSlot.leadId}`}>
                Open client lead →
              </Link>
            ) : null}
            {detailTask ? (
              <Link
                href={
                  detailTask.opportunity_id
                    ? `/dashboard/sales/${detailTask.opportunity_id}`
                    : `/dashboard/tasks/${detailTask.id}`
                }
              >
                Open sales appointment to manage →
              </Link>
            ) : null}
            {detailSlot &&
            data.canEdit &&
            ["open", "booked"].includes(detailSlot.status) ? (
              <details>
                <summary>
                  {detailSlot.status === "booked"
                    ? "Cancel consultation…"
                    : "Remove extra opening…"}
                </summary>
                <CalendarForm
                  label={
                    detailSlot.status === "booked"
                      ? "Cancel consultation"
                      : "Remove opening"
                  }
                  onSaved={saved}
                >
                  <input
                    type="hidden"
                    name="operation"
                    value={detailSlot.status === "booked" ? "cancel" : "close"}
                  />
                  <input type="hidden" name="id" value={detailSlot.id} />
                  <input
                    type="hidden"
                    name="expectedUpdatedAt"
                    value={detailSlot.updatedAt}
                  />
                  {detailSlot.status === "booked" ? (
                    <label className="tc-check">
                      <input name="contacted" type="checkbox" required />I have
                      contacted the client about cancelling. No notification
                      will be sent automatically.
                    </label>
                  ) : null}
                </CalendarForm>
              </details>
            ) : null}
          </div>
        </CalendarModal>
      ) : null}
    </div>
  );
}
