import { describe, expect, it } from "vitest";
import { describeRecurrence, upcomingSlots } from "@/lib/domain/recurrence";

const sunday10 = { weekday: 0, localTime: "10:00:00" };
const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

describe("upcomingSlots", () => {
  it("finds the coming Sunday from midweek", () => {
    // Wednesday 8 Oct 2025, noon Pacific.
    const now = new Date("2025-10-08T19:00:00Z");
    expect(iso(upcomingSlots(sunday10, now))).toEqual(["2025-10-12T17:00:00.000Z"]);
  });

  it("includes today's service if it has not started yet", () => {
    // Sunday 12 Oct 2025, 8am Pacific.
    const now = new Date("2025-10-12T15:00:00Z");
    expect(iso(upcomingSlots(sunday10, now))).toEqual(["2025-10-12T17:00:00.000Z"]);
  });

  it("moves on to next week once today's service has started", () => {
    // Sunday 12 Oct 2025, 10:30am Pacific.
    const now = new Date("2025-10-12T17:30:00Z");
    expect(iso(upcomingSlots(sunday10, now))).toEqual(["2025-10-19T17:00:00.000Z"]);
  });

  it("keeps 10am at church across the end of daylight saving", () => {
    // Wed 29 Oct 2025. The following Sunday, 2 Nov, is the first on PST (UTC-8).
    const now = new Date("2025-10-29T19:00:00Z");
    expect(iso(upcomingSlots(sunday10, now))).toEqual(["2025-11-02T18:00:00.000Z"]);
  });

  it("keeps 10am at church across the start of daylight saving", () => {
    // Wed 4 Mar 2026. The following Sunday, 8 Mar, is the first on PDT (UTC-7).
    const now = new Date("2026-03-04T20:00:00Z");
    expect(iso(upcomingSlots(sunday10, now))).toEqual(["2026-03-08T17:00:00.000Z"]);
  });

  it("uses the church's weekday for an evening service, not the UTC one", () => {
    // Wednesday 7:30pm Pacific is Thursday 02:30 UTC.
    const wednesdayEvening = { weekday: 3, localTime: "19:30" };
    const now = new Date("2025-10-13T19:00:00Z"); // Monday
    expect(iso(upcomingSlots(wednesdayEvening, now))).toEqual(["2025-10-16T02:30:00.000Z"]);
  });

  it("returns several when looking further ahead", () => {
    const now = new Date("2025-10-08T19:00:00Z");
    expect(upcomingSlots(sunday10, now, 21)).toHaveLength(3);
  });

  it("returns nothing when the next one is beyond the horizon", () => {
    const now = new Date("2025-10-12T17:30:00Z"); // just after this Sunday's start
    expect(upcomingSlots(sunday10, now, 3)).toEqual([]);
  });
});

describe("describeRecurrence", () => {
  it.each([
    [{ weekday: 0, localTime: "10:00:00" }, "Every Sunday at 10:00 AM"],
    [{ weekday: 3, localTime: "19:30" }, "Every Wednesday at 7:30 PM"],
    [{ weekday: 5, localTime: "00:05" }, "Every Friday at 12:05 AM"],
    [{ weekday: 6, localTime: "12:00" }, "Every Saturday at 12:00 PM"],
  ])("describes %j", (recurrence, text) => {
    expect(describeRecurrence(recurrence)).toBe(text);
  });
});
