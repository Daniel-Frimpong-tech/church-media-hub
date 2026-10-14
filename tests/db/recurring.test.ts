// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

let db: TestDatabase;
let admin: string;
let member: string;
let series: string;

beforeAll(async () => {
  db = await createTestDatabase();
  admin = await db.signUp("admin@example.com", "admin");
  member = await db.signUp("member@example.com", "member");
  [{ id: series }] = await db.as<{ id: string }>(
    admin,
    "insert into public.service_series (name, weekday, local_time) values ('Sunday Service', 0, '10:00') returning id",
  );
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("recurring services", () => {
  const slot = "2030-01-06T18:00:00Z";

  it("creates each occurrence only once, however often the job runs", async () => {
    const insert =
      "insert into public.services (name, starts_at, series_id, series_slot) values ('Sunday Service', $2, $1, $2)";
    await db.admin(insert, [series, slot]);
    await expect(db.admin(insert, [series, slot])).rejects.toThrow(/duplicate key/);
  });

  it("does not create a duplicate after an admin moves the service", async () => {
    // Moved from 10am to 11am: the occurrence it stands for is unchanged.
    await db.as(
      admin,
      "update public.services set starts_at = '2030-01-06T19:00:00Z' where series_id = $1 and series_slot = $2",
      [series, slot],
    );
    await expect(
      db.admin(
        "insert into public.services (name, starts_at, series_id, series_slot) values ('Sunday Service', $2, $1, $2)",
        [series, slot],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("still allows any number of one-off services at the same time", async () => {
    const oneOff = "insert into public.services (name, starts_at) values ('Wedding', $1)";
    await db.as(admin, oneOff, [slot]);
    await db.as(admin, oneOff, [slot]);
  });

  it("keeps existing services when the series is deleted", async () => {
    const [{ id: temporary }] = await db.as<{ id: string }>(
      admin,
      "insert into public.service_series (name, weekday, local_time) values ('Midweek', 3, '19:30') returning id",
    );
    await db.admin(
      "insert into public.services (name, starts_at, series_id, series_slot) values ('Midweek', '2030-01-09T03:30:00Z', $1, '2030-01-09T03:30:00Z')",
      [temporary],
    );
    await db.as(admin, "delete from public.service_series where id = $1", [temporary]);
    const [service] = await db.admin<{ series_id: string | null }>(
      "select series_id from public.services where name = 'Midweek'",
    );
    expect(service.series_id).toBeNull();
  });

  it("rejects a weekday that does not exist", async () => {
    await expect(
      db.as(admin, "insert into public.service_series (name, weekday, local_time) values ('Bad', 7, '10:00')"),
    ).rejects.toThrow(/check constraint/);
  });

  it("lets members see the schedule but not change it", async () => {
    expect(await db.as(member, "select 1 from public.service_series")).toHaveLength(1);
    await expect(
      db.as(member, "insert into public.service_series (name, weekday, local_time) values ('Mine', 1, '10:00')"),
    ).rejects.toThrow(/row-level security/);
    await db.as(member, "update public.service_series set active = false");
    const [row] = await db.admin<{ active: boolean }>(
      "select active from public.service_series where id = $1",
      [series],
    );
    expect(row.active).toBe(true);
  });

  it("lets only admins record a skipped occurrence", async () => {
    await expect(
      db.as(
        member,
        "insert into public.service_series_skips (series_id, series_slot) values ($1, '2030-01-13T18:00:00Z')",
        [series],
      ),
    ).rejects.toThrow(/row-level security/);
    await db.as(
      admin,
      "insert into public.service_series_skips (series_id, series_slot) values ($1, '2030-01-13T18:00:00Z')",
      [series],
    );
  });
});

describe("series that skip weeks", () => {
  it("accepts every other Wednesday with a Wednesday as its first date", async () => {
    await db.as(
      admin,
      "insert into public.service_series (name, weekday, local_time, interval_weeks, anchor_date) values ('Women''s Midweek', 3, '19:30', 2, '2030-01-02')",
    );
  });

  it("refuses a first date on the wrong weekday", async () => {
    await expect(
      db.as(
        admin,
        "insert into public.service_series (name, weekday, local_time, interval_weeks, anchor_date) values ('Men''s Midweek', 3, '19:30', 2, '2030-01-03')",
      ),
    ).rejects.toThrow(/service_series_anchor_weekday/);
  });

  it("refuses a series that skips weeks without a first date", async () => {
    await expect(
      db.as(
        admin,
        "insert into public.service_series (name, weekday, local_time, interval_weeks) values ('No start', 3, '19:30', 2)",
      ),
    ).rejects.toThrow(/service_series_anchor_needed/);
  });

  it("refuses more than every 4 weeks", async () => {
    await expect(
      db.as(
        admin,
        "insert into public.service_series (name, weekday, local_time, interval_weeks, anchor_date) values ('Rare', 3, '19:30', 6, '2030-01-02')",
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
