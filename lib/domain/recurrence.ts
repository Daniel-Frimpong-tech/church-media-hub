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
  /** 1 = every week (the default), 2 = every other week, up to 4. */
  intervalWeeks?: number;
  /**
   * "YYYY-MM-DD": the first occurrence. Needed when it is not every week, to
   * say which weeks it falls on. Nothing is created before it.
   */
  anchorDate?: string | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether a church-calendar day ("YYYY-MM-DD", already the right weekday) is
 * one this series runs on.
 */
export function runsOnDay(recurrence: Recurrence, isoDay: string): boolean {
  const interval = recurrence.intervalWeeks ?? 1;
  if (!recurrence.anchorDate) return interval === 1;
  const weeks = Math.round(
    (Date.parse(`${isoDay}T12:00:00Z`) - Date.parse(`${recurrence.anchorDate}T12:00:00Z`)) /
      WEEK_MS,
  );
  return weeks >= 0 && weeks % interval === 0;
}

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
    const isoDay = day.toISOString().slice(0, 10);
    if (day.getUTCDay() === recurrence.weekday && runsOnDay(recurrence, isoDay)) {
      const slot = churchLocalToUtc(isoDay, time);
      if (slot && slot.getTime() > now.getTime() && slot.getTime() <= horizon) {
        slots.push(slot);
      }
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return slots;
}

/** "Every Sunday at 10:00 AM", "Every other Wednesday at 7:30 PM" */
export function describeRecurrence(recurrence: Recurrence): string {
  const [hour, minute] = recurrence.localTime.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const day = WEEKDAYS[recurrence.weekday] ?? "week";
  return `${repeatPhrase(recurrence.intervalWeeks ?? 1, day)} at ${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

/** "Every Wednesday", "Every other Wednesday", "Every 3 weeks on Wednesday" */
export function repeatPhrase(intervalWeeks: number, day: string): string {
  if (intervalWeeks <= 1) return `Every ${day}`;
  if (intervalWeeks === 2) return `Every other ${day}`;
  return `Every ${intervalWeeks} weeks on ${day}`;
}

export const REPEAT_CHOICES = [
  { value: "1", label: "Every week" },
  { value: "2", label: "Every other week" },
  { value: "3", label: "Every 3 weeks" },
  { value: "4", label: "Every 4 weeks" },
] as const;
