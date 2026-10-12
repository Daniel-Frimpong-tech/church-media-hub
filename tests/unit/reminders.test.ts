import { describe, expect, it } from "vitest";
import { dueReminderStage, reminderDueAt } from "@/lib/domain/reminders";

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
