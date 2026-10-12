import { describe, expect, it } from "vitest";
import {
  analyticsSince,
  churchWeekStart,
  compactNumber,
  compareToPrevious,
  fillWeeks,
  niceCeiling,
  pickFocusService,
  relativeDay,
  summarizeHandoffs,
} from "@/lib/domain/analytics";

// Wednesday 15 Oct 2025, noon Pacific.
const now = new Date("2025-10-15T19:00:00Z");

describe("churchWeekStart", () => {
  it("is the Sunday on or before the day, on the church's calendar", () => {
    expect(churchWeekStart(now)).toBe("2025-10-12");
    // Sunday itself.
    expect(churchWeekStart(new Date("2025-10-12T17:00:00Z"))).toBe("2025-10-12");
    // Saturday evening Pacific is already Sunday in UTC: still last week.
    expect(churchWeekStart(new Date("2025-10-12T02:00:00Z"))).toBe("2025-10-05");
  });
});

describe("fillWeeks", () => {
  it("returns every week, oldest first, with zero for quiet weeks", () => {
    const weeks = fillWeeks(
      [
        { week: "2025-10-12", files: 40 },
        { week: "2025-09-28", files: 12 },
      ],
      now,
      4,
    );
    expect(weeks).toEqual([
      { weekStart: "2025-09-21", label: "Sep 21", files: 0 },
      { weekStart: "2025-09-28", label: "Sep 28", files: 12 },
      { weekStart: "2025-10-05", label: "Oct 5", files: 0 },
      { weekStart: "2025-10-12", label: "Oct 12", files: 40 },
    ]);
  });

  it("ignores weeks outside the window", () => {
    const weeks = fillWeeks([{ week: "2024-01-07", files: 99 }], now, 2);
    expect(weeks.map((week) => week.files)).toEqual([0, 0]);
  });

  it("asks the database for a window that covers the first week", () => {
    const since = new Date(analyticsSince(now, 8)).getTime();
    const firstWeek = new Date("2025-08-24T07:00:00Z").getTime(); // Sunday 00:00 Pacific
    expect(since).toBeLessThanOrEqual(firstWeek);
  });
});

describe("compareToPrevious", () => {
  it.each([
    [150, 100, { percent: 50, direction: "up" }],
    [50, 100, { percent: 50, direction: "down" }],
    [100, 100, { percent: 0, direction: "flat" }],
    [10, 0, { percent: null, direction: "up" }],
    [0, 0, { percent: null, direction: "flat" }],
  ])("%d vs %d", (current, previous, expected) => {
    expect(compareToPrevious(current, previous)).toEqual(expected);
  });
});

describe("summarizeHandoffs", () => {
  const start = "2025-10-12T17:00:00Z";
  const due = "2025-10-13T17:00:00Z";

  it("counts confirmed-in-time as on time and measures how long it took", () => {
    const summary = summarizeHandoffs(
      [{ dueAt: due, receivedAt: "2025-10-12T23:00:00Z", serviceStartsAt: start }],
      now,
    );
    expect(summary).toEqual({
      settled: 1,
      onTime: 1,
      late: 0,
      onTimeRate: 1,
      medianHoursToDeliver: 6,
    });
  });

  it("counts both late confirmations and overdue unconfirmed ones as late", () => {
    const summary = summarizeHandoffs(
      [
        { dueAt: due, receivedAt: "2025-10-14T17:00:00Z", serviceStartsAt: start },
        { dueAt: due, receivedAt: null, serviceStartsAt: start },
        { dueAt: due, receivedAt: "2025-10-13T05:00:00Z", serviceStartsAt: start },
      ],
      now,
    );
    expect(summary.late).toBe(2);
    expect(summary.onTime).toBe(1);
    expect(summary.onTimeRate).toBeCloseTo(1 / 3);
    // Median of 12 and 48 hours.
    expect(summary.medianHoursToDeliver).toBe(30);
  });

  it("leaves out handoffs that are not due yet", () => {
    const summary = summarizeHandoffs(
      [{ dueAt: "2025-10-20T17:00:00Z", receivedAt: null, serviceStartsAt: "2025-10-19T17:00:00Z" }],
      now,
    );
    expect(summary).toMatchObject({ settled: 0, onTimeRate: null, medianHoursToDeliver: null });
  });
});

describe("pickFocusService", () => {
  const services = [
    { id: "last-sunday", startsAt: "2025-10-12T17:00:00Z" },
    { id: "midweek", startsAt: "2025-10-16T02:30:00Z" },
    { id: "next-sunday", startsAt: "2025-10-19T17:00:00Z" },
  ];

  it("leads with a service from the last day and a half", () => {
    const sundayEvening = new Date("2025-10-13T03:00:00Z");
    expect(pickFocusService(services, sundayEvening)).toEqual({ id: "last-sunday", when: "now" });
  });

  it("otherwise leads with the next one coming", () => {
    expect(pickFocusService(services, now)).toEqual({ id: "midweek", when: "upcoming" });
  });

  it("falls back to the most recent when nothing is coming", () => {
    const later = new Date("2025-10-25T19:00:00Z");
    expect(pickFocusService(services, later)).toEqual({ id: "next-sunday", when: "recent" });
  });

  it("is null with no services", () => {
    expect(pickFocusService([], now)).toBeNull();
  });
});

describe("relativeDay", () => {
  it.each([
    ["2025-10-15T23:00:00Z", "Today"],
    ["2025-10-16T19:00:00Z", "Tomorrow"],
    ["2025-10-19T17:00:00Z", "In 4 days"],
    ["2025-10-14T19:00:00Z", "Yesterday"],
    ["2025-10-12T17:00:00Z", "3 days ago"],
  ])("%s is %s", (instant, text) => {
    expect(relativeDay(instant, now)).toBe(text);
  });

  it("uses the church's calendar day, not UTC's", () => {
    // 7:30pm Pacific on the 15th is already the 16th in UTC.
    expect(relativeDay("2025-10-16T02:30:00Z", now)).toBe("Today");
  });
});

describe("compactNumber and niceCeiling", () => {
  it.each([
    [8, "8"],
    [1284, "1,284"],
    [12900, "12.9K"],
    [20000, "20K"],
    [4_200_000, "4.2M"],
  ])("formats %d as %s", (value, text) => {
    expect(compactNumber(value)).toBe(text);
  });

  it.each([
    [0, 4],
    [3, 4],
    [7, 10],
    [18, 20],
    [34, 40],
    [45, 50],
    [130, 200],
    [1000, 1000],
  ])("rounds a chart top of %d up to %d", (max, top) => {
    expect(niceCeiling(max)).toBe(top);
  });
});
