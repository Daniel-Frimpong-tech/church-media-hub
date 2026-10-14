/**
 * When upload reminders go out. Pure, so the schedule can be tested and
 * changed in one place.
 */

import { churchIsoDate, churchLocalToUtc } from "./time";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Hours after a service starts that each reminder is due. The first gives
 * people time to get home; the second lands before the usual 24-hour handoff
 * deadline.
 */
export const REMINDER_HOURS = [3, 20] as const;

/** Stop chasing a week after the service. */
const REMINDER_WINDOW_HOURS = 7 * 24;

/**
 * Which reminder is due for a service: 0 for none yet, 1 for the first, 2 for
 * the second. Past the reminder window it is 0 again.
 */
export function dueReminderStage(startsAt: Date, now: Date): number {
  const hoursSince = (now.getTime() - startsAt.getTime()) / HOUR_MS;
  if (hoursSince > REMINDER_WINDOW_HOURS) return 0;
  let stage = 0;
  for (const [index, hours] of REMINDER_HOURS.entries()) {
    if (hoursSince >= hours) stage = index + 1;
  }
  return stage;
}

/** When a given reminder stage (1-based) falls due. */
export function reminderDueAt(startsAt: Date, stage: number): Date {
  const hours = REMINDER_HOURS[stage - 1];
  if (hours === undefined) throw new RangeError("unknown reminder stage");
  return new Date(startsAt.getTime() + hours * HOUR_MS);
}

/** Morning post time on the day of a service, church time. */
export const SERVICE_DAY_POST_TIME = "07:00";

/**
 * When the "today's service" post goes out: 7:00 AM on the day, church time,
 * or two hours before the start if the service is earlier than 9:00 AM.
 */
export function serviceDayPostAt(startsAt: Date): Date {
  const morning =
    churchLocalToUtc(churchIsoDate(startsAt), SERVICE_DAY_POST_TIME) ?? startsAt;
  const twoHoursBefore = new Date(startsAt.getTime() - 2 * HOUR_MS);
  return morning < twoHoursBefore ? morning : twoHoursBefore;
}

/**
 * Whether the day's post should go out now: its time has come and it is still
 * the service's day. A service created later that day is announced at once;
 * one whose day has passed never is.
 */
export function isServiceDayPostDue(startsAt: Date, now: Date): boolean {
  return (
    churchIsoDate(now) === churchIsoDate(startsAt) &&
    now.getTime() >= serviceDayPostAt(startsAt).getTime()
  );
}
