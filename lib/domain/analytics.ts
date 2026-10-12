import { churchIsoDate } from "./time";

/**
 * Shaping the dashboard's numbers. The database does the counting
 * (see the upload_analytics function); these pure functions turn its reply
 * into what the charts draw, so the fiddly parts can be tested.
 */

export type WeekBucket = {
  /** The Sunday the week starts on, "YYYY-MM-DD" in the church's time zone. */
  weekStart: string;
  /** "Oct 5" */
  label: string;
  files: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

/** The Sunday on or before a moment, on the church's calendar. */
export function churchWeekStart(now: Date): string {
  const day = new Date(`${churchIsoDate(now)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day.toISOString().slice(0, 10);
}

/**
 * The last `weeks` weeks, oldest first, with zero for weeks that had no
 * uploads. A chart with gaps removed would hide exactly the quiet weeks an
 * admin wants to notice.
 */
export function fillWeeks(
  rows: { week: string; files: number }[],
  now: Date,
  weeks: number = 8,
): WeekBucket[] {
  const counts = new Map(rows.map((row) => [row.week, row.files]));
  const start = new Date(`${churchWeekStart(now)}T12:00:00Z`);
  const buckets: WeekBucket[] = [];
  for (let back = weeks - 1; back >= 0; back--) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() - back * 7);
    const weekStart = day.toISOString().slice(0, 10);
    buckets.push({
      weekStart,
      label: shortDate(weekStart),
      files: counts.get(weekStart) ?? 0,
    });
  }
  return buckets;
}

/** When the analytics window starts: the Sunday `weeks` weeks ago, as an instant. */
export function analyticsSince(now: Date, weeks: number = 8): string {
  const start = new Date(`${churchWeekStart(now)}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7);
  // A day early, so the church's time-zone offset cannot clip the first week.
  start.setUTCDate(start.getUTCDate() - 1);
  return start.toISOString();
}

export type Change = {
  /** Whole percent, or null when there is nothing to compare against. */
  percent: number | null;
  direction: "up" | "down" | "flat";
};

export function compareToPrevious(current: number, previous: number): Change {
  if (previous === 0) {
    return { percent: null, direction: current > 0 ? "up" : "flat" };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    percent: Math.abs(percent),
    direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
  };
}

export type HandoffFact = {
  dueAt: string;
  receivedAt: string | null;
  /** When the service started, to measure how long delivery took. */
  serviceStartsAt: string;
};

export type HandoffSummary = {
  /** Handoffs whose deadline has passed or that were confirmed. */
  settled: number;
  onTime: number;
  late: number;
  /** 0 to 1, or null when nothing has settled yet. */
  onTimeRate: number | null;
  /** Median hours from service start to the team confirming, or null. */
  medianHoursToDeliver: number | null;
};

/**
 * How well handoffs are going. A handoff counts once its outcome is known:
 * confirmed (on time or late), or past its deadline unconfirmed (late).
 * Ones still inside their deadline are left out, because they are not late yet.
 */
export function summarizeHandoffs(handoffs: HandoffFact[], now: Date): HandoffSummary {
  let onTime = 0;
  let late = 0;
  const hours: number[] = [];

  for (const handoff of handoffs) {
    const due = new Date(handoff.dueAt).getTime();
    if (handoff.receivedAt) {
      const received = new Date(handoff.receivedAt).getTime();
      if (received <= due) onTime += 1;
      else late += 1;
      const taken = (received - new Date(handoff.serviceStartsAt).getTime()) / 3_600_000;
      if (taken >= 0) hours.push(taken);
    } else if (due < now.getTime()) {
      late += 1;
    }
  }

  const settled = onTime + late;
  hours.sort((a, b) => a - b);
  const middle = Math.floor(hours.length / 2);
  const median =
    hours.length === 0
      ? null
      : hours.length % 2 === 1
        ? hours[middle]
        : (hours[middle - 1] + hours[middle]) / 2;

  return {
    settled,
    onTime,
    late,
    onTimeRate: settled === 0 ? null : onTime / settled,
    medianHoursToDeliver: median === null ? null : Math.round(median),
  };
}

export type FocusCandidate = { id: string; startsAt: string };

export type Focus = { id: string; when: "now" | "upcoming" | "recent" };

const HOUR = 3_600_000;

/**
 * Which service the home page leads with. The one people are most likely
 * here for: a service from the last day and a half (uploads are happening),
 * otherwise the next one coming, otherwise the most recent one.
 */
export function pickFocusService(services: FocusCandidate[], now: Date): Focus | null {
  const time = now.getTime();
  const sorted = [...services].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const justHappened = sorted
    .filter((service) => {
      const start = new Date(service.startsAt).getTime();
      return start <= time && time - start <= 36 * HOUR;
    })
    .pop();
  if (justHappened) return { id: justHappened.id, when: "now" };

  const next = sorted.find((service) => new Date(service.startsAt).getTime() > time);
  if (next) return { id: next.id, when: "upcoming" };

  const last = sorted.pop();
  return last ? { id: last.id, when: "recent" } : null;
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", "3 days ago": by the church's calendar. */
export function relativeDay(instant: Date | string, now: Date): string {
  const target = new Date(`${churchIsoDate(instant)}T12:00:00Z`).getTime();
  const today = new Date(`${churchIsoDate(now)}T12:00:00Z`).getTime();
  const days = Math.round((target - today) / (24 * HOUR));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** "12.9K", "1,284", "8": compact numbers for stat tiles. */
export function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toLocaleString("en-US");
}

/** A round number at or above `max`, for the top of a chart's scale. */
export function niceCeiling(max: number): number {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 4, 5, 10]) {
    if (step * magnitude >= max) return step * magnitude;
  }
  return 10 * magnitude;
}
