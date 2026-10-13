/**
 * Service times are entered and shown in the church's time zone, whatever
 * zone the server or the person's phone is in. They are stored as UTC instants.
 */

export const CHURCH_TIME_ZONE = "America/Los_Angeles";

/** How far ahead of UTC the zone is at a given instant, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Turns a wall-clock date ("2025-10-12") and time ("10:00") in the church's
 * zone into the UTC instant it refers to. Returns null if either is malformed.
 */
export function churchLocalToUtc(
  date: string,
  time: string,
  timeZone: string = CHURCH_TIME_ZONE,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [year, month, day] = dateMatch.slice(1).map(Number);
  const [hour, minute] = timeMatch.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }

  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  // Reject dates that do not exist, such as 31 February.
  if (new Date(wallClock).getUTCDate() !== day) return null;

  // The offset depends on the instant, which is what we are solving for, so
  // estimate once and correct once. That is enough to cross a DST change.
  const firstGuess = wallClock - zoneOffsetMs(new Date(wallClock), timeZone);
  const corrected = wallClock - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(corrected);
}

/** "Sun, Oct 12, 2025" */
export function formatChurchDate(instant: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(instant));
}

/** "10:00 AM" */
export function formatChurchTime(instant: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}

/** "2025-10-12", the service's calendar date in the church's zone. */
export function churchIsoDate(instant: Date | string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHURCH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

/** Drive folder name for a service: "2025-10-12 Sunday Service". */
export function serviceFolderName(name: string, startsAt: Date | string): string {
  // Drive allows most characters, but slashes read as paths elsewhere.
  const safeName = name.trim().replace(/[\\/]+/g, "-").replace(/\s+/g, " ");
  return `${churchIsoDate(startsAt)} ${safeName}`;
}

/** Lowercase, hyphenated identifier for a category name: "Kids Church" → "kids-church". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const UPCOMING_GRACE_MS = 4 * 60 * 60 * 1000;

/**
 * Services starting after this instant count as "upcoming". A service stays
 * upcoming for a few hours after it starts, while people are still uploading.
 */
export function upcomingCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - UPCOMING_GRACE_MS).toISOString();
}

/** The current time. Server Components call this rather than `new Date()` directly. */
export function currentTime(): Date {
  return new Date();
}

/** "10:00", the 24-hour clock time in the church's zone, for time inputs. */
export function churchClockTime(instant: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CHURCH_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** "Mon, Oct 13, 10:00 AM", for deadlines. */
export function formatChurchDateTime(instant: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Services from the last two weeks onward are "current" for tasks and handoffs. */
export function recentCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - RECENT_WINDOW_MS).toISOString();
}

/** "Good morning" / "Good afternoon" / "Good evening", by the church's clock. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(churchClockTime(now).slice(0, 2));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Wednesday, October 15" */
export function formatChurchLongDate(instant: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(instant));
}

/** The pieces of a date for a calendar-style tile: "19", "OCT", "SUN". */
export function churchDateParts(instant: Date | string): {
  day: string;
  month: string;
  weekday: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHURCH_TIME_ZONE,
    day: "numeric",
    month: "short",
    weekday: "short",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: get("day"),
    month: get("month").toUpperCase(),
    weekday: get("weekday").toUpperCase(),
  };
}
