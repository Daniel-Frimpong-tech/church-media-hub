import { describe, expect, it } from "vitest";
import {
  handoffDueAt,
  handoffStatus,
  wasDeliveredLate,
} from "@/lib/domain/deadlines";

// Sunday 12 Oct 2025, 10:00 in Los Angeles (PDT, UTC-7)
const serviceStart = new Date("2025-10-12T17:00:00Z");
const dueAt = handoffDueAt(serviceStart, 24);

describe("handoffDueAt", () => {
  it("adds the deadline hours to the service start", () => {
    expect(dueAt.toISOString()).toBe("2025-10-13T17:00:00.000Z");
  });

  it("allows a zero-hour deadline", () => {
    expect(handoffDueAt(serviceStart, 0)).toEqual(serviceStart);
  });

  it("rejects a negative deadline", () => {
    expect(() => handoffDueAt(serviceStart, -1)).toThrow(RangeError);
  });
});

describe("handoffStatus", () => {
  it("is pending before the deadline", () => {
    const now = new Date("2025-10-13T16:59:59Z");
    expect(handoffStatus({ dueAt, receivedAt: null }, now)).toBe("pending");
  });

  it("is still pending exactly at the deadline", () => {
    expect(handoffStatus({ dueAt, receivedAt: null }, dueAt)).toBe("pending");
  });

  it("is late once the deadline has passed without being received", () => {
    const now = new Date("2025-10-13T17:00:01Z");
    expect(handoffStatus({ dueAt, receivedAt: null }, now)).toBe("late");
  });

  it("is delivered once received, even after the deadline", () => {
    const receivedAt = new Date("2025-10-14T09:00:00Z");
    const now = new Date("2025-10-15T00:00:00Z");
    expect(handoffStatus({ dueAt, receivedAt }, now)).toBe("delivered");
  });
});

describe("wasDeliveredLate", () => {
  it("is false when received on time", () => {
    const receivedAt = new Date("2025-10-13T10:00:00Z");
    expect(wasDeliveredLate({ dueAt, receivedAt })).toBe(false);
  });

  it("is true when received after the deadline", () => {
    const receivedAt = new Date("2025-10-14T09:00:00Z");
    expect(wasDeliveredLate({ dueAt, receivedAt })).toBe(true);
  });

  it("is false when not received yet", () => {
    expect(wasDeliveredLate({ dueAt, receivedAt: null })).toBe(false);
  });
});
