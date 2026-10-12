import { describe, expect, it } from "vitest";
import {
  churchIsoDate,
  churchLocalToUtc,
  formatChurchDate,
  formatChurchTime,
  serviceFolderName,
  slugify,
} from "@/lib/domain/time";

describe("churchLocalToUtc", () => {
  it("converts a summer (PDT, UTC-7) service time", () => {
    expect(churchLocalToUtc("2025-10-12", "10:00")?.toISOString()).toBe(
      "2025-10-12T17:00:00.000Z",
    );
  });

  it("converts a winter (PST, UTC-8) service time", () => {
    expect(churchLocalToUtc("2025-12-14", "10:00")?.toISOString()).toBe(
      "2025-12-14T18:00:00.000Z",
    );
  });

  it("handles the Sunday the clocks go back", () => {
    // 2 Nov 2025: DST ends at 2am, so 10am is already PST.
    expect(churchLocalToUtc("2025-11-02", "10:00")?.toISOString()).toBe(
      "2025-11-02T18:00:00.000Z",
    );
  });

  it("handles the Sunday the clocks go forward", () => {
    // 8 Mar 2026: DST starts at 2am, so 10am is already PDT.
    expect(churchLocalToUtc("2026-03-08", "10:00")?.toISOString()).toBe(
      "2026-03-08T17:00:00.000Z",
    );
  });

  it("handles an evening service that falls on the next UTC day", () => {
    expect(churchLocalToUtc("2025-10-15", "19:30")?.toISOString()).toBe(
      "2025-10-16T02:30:00.000Z",
    );
  });

  it.each([
    ["", "10:00"],
    ["2025-10-12", ""],
    ["12/10/2025", "10:00"],
    ["2025-02-31", "10:00"],
    ["2025-13-01", "10:00"],
    ["2025-10-12", "25:00"],
  ])("rejects %j %j", (date, time) => {
    expect(churchLocalToUtc(date, time)).toBeNull();
  });
});

describe("formatting in the church's time zone", () => {
  const evening = "2025-10-16T02:30:00.000Z";

  it("shows the church's calendar date, not the UTC one", () => {
    expect(formatChurchDate(evening)).toBe("Wed, Oct 15, 2025");
    expect(churchIsoDate(evening)).toBe("2025-10-15");
  });

  it("shows the church's clock time", () => {
    expect(formatChurchTime(evening)).toMatch(/^7:30\sPM$/);
  });
});

describe("serviceFolderName", () => {
  it("leads with the date so Drive sorts folders in order", () => {
    expect(serviceFolderName("Sunday Service", "2025-10-12T17:00:00Z")).toBe(
      "2025-10-12 Sunday Service",
    );
  });

  it("replaces slashes and tidies spaces", () => {
    expect(
      serviceFolderName("  Youth / Teens   Night ", "2025-10-12T17:00:00Z"),
    ).toBe("2025-10-12 Youth - Teens Night");
  });
});

describe("slugify", () => {
  it.each([
    ["Kids Church", "kids-church"],
    ["  Worship & Praise! ", "worship-praise"],
    ["Café", "cafe"],
    ["Baptism", "baptism"],
  ])("turns %j into %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});
