import { describe, expect, it } from "vitest";
import {
  dueReminderStage,
  isServiceDayPostDue,
  reminderDueAt,
  serviceDayPostAt,
} from "@/lib/domain/reminders";

const startsAt = new Date("2025-10-12T17:00:00Z"); // Sunday 10am Pacific
const hoursLater = (hours: number) => new Date(startsAt.getTime() + hours * 3_600_000);

describe("dueReminderStage", () => {
  it("is not due before or during the service", () => {
    expect(dueReminderStage(startsAt, hoursLater(-24))).toBe(0);
    expect(dueReminderStage(startsAt, hoursLater(1))).toBe(0);
    expect(dueReminderStage(startsAt, hoursLater(2.99))).toBe(0);
  });

  it("is the first reminder from three hours after the start", () => {
    expect(dueReminderStage(startsAt, hoursLater(3))).toBe(1);
    expect(dueReminderStage(startsAt, hoursLater(19))).toBe(1);
  });

  it("is the second reminder from twenty hours, before a 24-hour deadline", () => {
    expect(dueReminderStage(startsAt, hoursLater(20))).toBe(2);
    expect(dueReminderStage(startsAt, hoursLater(72))).toBe(2);
  });

  it("stops after a week", () => {
    expect(dueReminderStage(startsAt, hoursLater(7 * 24 + 1))).toBe(0);
  });
});

describe("reminderDueAt", () => {
  it("gives the instant each stage falls due", () => {
    expect(reminderDueAt(startsAt, 1).toISOString()).toBe("2025-10-12T20:00:00.000Z");
    expect(reminderDueAt(startsAt, 2).toISOString()).toBe("2025-10-13T13:00:00.000Z");
  });

  it("rejects a stage that does not exist", () => {
    expect(() => reminderDueAt(startsAt, 3)).toThrow(RangeError);
  });
});

describe("the post on the day of a service", () => {
  // Sunday 12 Oct 2025, 10:00 AM Pacific (PDT).
  const sunday = new Date("2025-10-12T17:00:00Z");

  it("goes out at 7:00 AM on the day, church time", () => {
    expect(serviceDayPostAt(sunday).toISOString()).toBe("2025-10-12T14:00:00.000Z");
  });

  it("goes out two hours before an early service instead", () => {
    const early = new Date("2025-10-12T15:00:00Z"); // 8:00 AM Pacific
    expect(serviceDayPostAt(early).toISOString()).toBe("2025-10-12T13:00:00.000Z");
  });

  it("is not due the week before, when the service is created", () => {
    expect(isServiceDayPostDue(sunday, new Date("2025-10-05T17:00:00Z"))).toBe(false);
  });

  it("is not due before 7:00 AM on the day", () => {
    expect(isServiceDayPostDue(sunday, new Date("2025-10-12T13:59:00Z"))).toBe(false);
  });

  it("is due from 7:00 AM on the day, including after the service starts", () => {
    expect(isServiceDayPostDue(sunday, new Date("2025-10-12T14:00:00Z"))).toBe(true);
    expect(isServiceDayPostDue(sunday, new Date("2025-10-12T20:00:00Z"))).toBe(true);
  });

  it("is never due once the day has passed", () => {
    expect(isServiceDayPostDue(sunday, new Date("2025-10-13T08:00:00Z"))).toBe(false);
  });

  it("uses the church's day for an evening service", () => {
    // Wednesday 7:30 PM Pacific is Thursday 02:30 UTC.
    const midweek = new Date("2025-10-16T02:30:00Z");
    expect(isServiceDayPostDue(midweek, new Date("2025-10-15T15:00:00Z"))).toBe(true);
    expect(isServiceDayPostDue(midweek, new Date("2025-10-16T08:00:00Z"))).toBe(false);
  });
});
