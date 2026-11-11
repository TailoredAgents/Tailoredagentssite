"use client";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Clock3, X } from "lucide-react";
import { saveCalendar } from "@/lib/booking/actions";
import type { getBookingCalendar } from "@/lib/booking/calendar";
import { DateTimeField } from "@/components/sales/date-time-field";
import { easternInputCandidates, easternInputValue } from "@/lib/time";
import { eventKinds, shiftDay } from "@/lib/booking/display";
export type CalendarData = Awaited<ReturnType<typeof getBookingCalendar>>;
export type CalendarSlot = CalendarData["slots"][number];
export type CalendarDraft = {
  day: string;
  minute: number;
  slot?: CalendarSlot;
  kind?: keyof typeof eventKinds;
  allDay?: boolean;
  lastDay?: string;
  start?: string;
  end?: string;
};
function localInstant(day: string, minute: number) {
  return easternInputCandidates(
    `${day}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
  )[0];
}
export function CalendarForm({
  children,
  label,
  onSaved,
}: {
  children: ReactNode;
  label: string;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(saveCalendar, {
    ok: false,
    message: "",
  });
  useEffect(() => {
    if (state.ok) onSaved();
  }, [state, onSaved]);
  return (
    <form action={action} className="tc-form">
      <fieldset disabled={pending}>
        {children}
        <button type="submit" className="dashboard-primary-button">
          {pending ? "Saving…" : label}
        </button>
      </fieldset>
      {state.message && !state.ok ? (
        <p role="alert" className="tc-error">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
export function CalendarModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      className="tc-dialog"
      ref={ref}
      onCancel={onClose}
      aria-labelledby="calendar-dialog-title"
    >
      <header>
        <div>
          <span>TEAM CALENDAR</span>
          <h2 id="calendar-dialog-title">{title}</h2>
        </div>
        <button
          type="button"
          className="tc-icon"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function CalendarEditor({
  draft,
  data,
  defaultProfile,
  onClose,
  onSaved,
}: {
  draft: CalendarDraft;
  data: CalendarData;
  defaultProfile: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const event = draft.slot,
    [allDay, setAllDay] = useState(event?.allDay ?? draft.allDay ?? false),
    [remove, setRemove] = useState(false);
  const timeHintId = useId();
  const start =
      event?.startsAt ?? draft.start ?? localInstant(draft.day, draft.minute),
    end =
      event?.endsAt ??
      draft.end ??
      localInstant(
        draft.minute >= 1410 ? shiftDay(draft.day, 1) : draft.day,
        draft.minute >= 1410 ? 0 : draft.minute + 30,
      );
  const editable = data.profiles.filter((p) => p.editable);
  return (
    <CalendarModal
      title={
        event
          ? "Edit event"
          : draft.kind === "busy"
            ? "Block time"
            : "New appointment"
      }
      onClose={onClose}
    >
      <CalendarForm label="Save event" onSaved={onSaved}>
        <input
          type="hidden"
          name="operation"
          value={event ? "update_event" : "create_event"}
        />
        {event ? (
          <>
            <input type="hidden" name="id" value={event.id} />
            <input
              type="hidden"
              name="expectedUpdatedAt"
              value={event.updatedAt}
            />
          </>
        ) : null}
        <label>
          Event title
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Client meeting, networking breakfast, busy…"
            defaultValue={event?.title ?? (draft.kind === "busy" ? "Busy" : "")}
            autoFocus
          />
        </label>
        <div className="tc-two">
          <label>
            Team member
            <select
              name="profile"
              defaultValue={event?.profile ?? defaultProfile}
            >
              {editable.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Event type
            <select
              name="kind"
              defaultValue={event?.kind ?? draft.kind ?? "appointment"}
            >
              {Object.entries(eventKinds).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="tc-check">
          <input
            name="allDay"
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          All day
        </label>
        {allDay ? (
          <div className="tc-two">
            <label>
              First day
              <input
                type="date"
                name="allDayStart"
                required
                defaultValue={
                  start ? easternInputValue(start).slice(0, 10) : draft.day
                }
              />
            </label>
            <label>
              Last day
              <input
                type="date"
                name="allDayEnd"
                required
                defaultValue={
                  event?.allDay
                    ? easternInputValue(
                        new Date(Date.parse(event.endsAt) - 1).toISOString(),
                      ).slice(0, 10)
                    : (draft.lastDay ?? draft.day)
                }
              />
            </label>
          </div>
        ) : (
          <div className="tc-two">
            <DateTimeField
              name="startsAt"
              label="Starts"
              hintId={timeHintId}
              defaultValue={start}
              required
            />
            <DateTimeField
              name="endsAt"
              label="Ends"
              hintId={timeHintId}
              defaultValue={end}
              required
            />
          </div>
        )}
        <details
          className="tc-optional"
          open={event && !!(event.location || event.notes)}
        >
          <summary>
            Location & notes <span>Optional</span>
          </summary>
          <label>
            Location or meeting link
            <input
              name="location"
              maxLength={200}
              defaultValue={event?.location ?? ""}
              placeholder="Office, coffee shop, or video meeting URL"
            />
          </label>
          <label>
            Notes
            <textarea
              name="notes"
              maxLength={2000}
              rows={3}
              defaultValue={event?.notes ?? ""}
              placeholder="Client name, agenda, or details for the team"
            />
          </label>
        </details>
        <p className="tc-hint" id={timeHintId}>
          <Clock3 size={15} />
          US Eastern (EST/EDT adjusts automatically). This time will be unavailable for online bookings.
          Details are visible to the team. No invitations are sent.
        </p>
      </CalendarForm>
      {event ? (
        <div className="tc-remove">
          <button type="button" onClick={() => setRemove(!remove)}>
            Remove event…
          </button>
          {remove ? (
            <CalendarForm label="Remove event" onSaved={onSaved}>
              <input type="hidden" name="operation" value="remove_event" />
              <input type="hidden" name="id" value={event.id} />
              <input
                type="hidden"
                name="expectedUpdatedAt"
                value={event.updatedAt}
              />
              <label className="tc-check">
                <input type="checkbox" name="confirmed" required />
                Remove this event and reopen the time for bookings.
              </label>
            </CalendarForm>
          ) : null}
        </div>
      ) : null}
    </CalendarModal>
  );
}
