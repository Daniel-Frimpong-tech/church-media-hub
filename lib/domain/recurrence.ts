import { churchIsoDate, churchLocalToUtc } from "./time";

/**
 * Working out when a recurring service next happens. Everything is in the
 * church's time zone: "Sunday 10:00" means 10am at church all year, whichever
 * side of a daylight-saving change it falls on.
 */

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** How far ahead the scheduled job creates services. */
export const CREATE_DAYS_AHEAD = 7;

export type Recurrence = {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** "HH:MM" or "HH:MM:SS", as Postgres returns a time. */
  localTime: string;
};

/**
 * The occurrences of a weekly service that start after `now` and within the
 * next `daysAhead` days.
 */
export function upcomingSlots(
  recurrence: Recurrence,
  now: Date,
  daysAhead: number = CREATE_DAYS_AHEAD,
): Date[] {
  const time = recurrence.localTime.slice(0, 5);
  const horizon = now.getTime() + daysAhead * 24 * 60 * 60 * 1000;

  // Walk the church's calendar days from today. Noon UTC is a safe anchor for
  // stepping whole days without daylight-saving surprises.
  const day = new Date(`${churchIsoDate(now)}T12:00:00Z`);
  const slots: Date[] = [];
  for (let step = 0; step <= daysAhead + 1; step++) {
    if (day.getUTCDay() === recurrence.weekday) {
      const slot = churchLocalToUtc(day.toISOString().slice(0, 10), time);
      if (slot && slot.getTime() > now.getTime() && slot.getTime() <= horizon) {
        slots.push(slot);
      }
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return slots;
}

/** "Every Sunday at 10:00 AM" */
export function describeRecurrence(recurrence: Recurrence): string {
  const [hour, minute] = recurrence.localTime.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `Every ${WEEKDAYS[recurrence.weekday] ?? "week"} at ${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}
