// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { outstandingTasks } from "@/lib/domain/assignments";
import { createSeededDatabase, type TestDatabase } from "./harness";

/**
 * supabase/seed.sql is what a local Supabase starts with, including the one
 * CI uses for the end-to-end test. A mistake in it would stop that stack from
 * starting, so it is applied here and checked.
 */

let db: TestDatabase;
const LAST_SUNDAY = "40000000-0000-4000-8000-000000000001";
const GRACE = "20000000-0000-4000-8000-000000000002";
const TOLA = "20000000-0000-4000-8000-000000000005";

beforeAll(async () => {
  db = await createSeededDatabase();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("seed data", () => {
  it("creates the sample people through the invite gate", async () => {
    const people = await db.admin<{ role: string }>("select role from public.profiles");
    expect(people.map((person) => person.role).sort()).toEqual([
      "admin",
      "member",
      "member",
      "member",
      "viewer",
      "viewer",
    ]);
    const [pending] = await db.admin<{ count: string }>(
      "select count(*) from public.invites where accepted_at is null",
    );
    expect(Number(pending.count)).toBe(1);
  });

  it("puts services at 10am Sunday and 7:30pm Wednesday, Pacific time", async () => {
    const services = await db.admin<{ name: string; local: string }>(
      `select name, to_char(starts_at at time zone 'America/Los_Angeles', 'Dy HH24:MI') as local
       from public.services order by starts_at`,
    );
    expect(services).toEqual([
      { name: "Sunday Service", local: "Sun 10:00" },
      { name: "Midweek Prayer", local: "Wed 19:30" },
      { name: "Sunday Service", local: "Sun 10:00" },
    ]);
  });

  it("has last Sunday's service in the past", async () => {
    // (This week's Sunday service is in the future until Sunday morning, so
    // only the past one can be asserted on every day of the week.)
    const [row] = await db.admin<{ past: boolean }>(
      "select starts_at < now() as past from public.services where id = $1",
      [LAST_SUNDAY],
    );
    expect(row.past).toBe(true);
  });

  it("leaves last Sunday partly delivered", async () => {
    const handoffs = await db.admin<{ slug: string; ready: boolean; received: boolean }>(
      `select c.slug, h.ready_at is not null as ready, h.received_at is not null as received
       from public.handoffs h join public.categories c on c.id = h.category_id
       where h.service_id = $1 order by c.slug`,
      [LAST_SUNDAY],
    );
    expect(handoffs).toEqual([
      // Grace marked done; the social team has not confirmed.
      { slug: "baptism", ready: true, received: false },
      // Kofi has not uploaded or marked done.
      { slug: "fellowship", ready: false, received: false },
      // Grace marked done and the thumbnail team confirmed.
      { slug: "preacher", ready: true, received: true },
      // Sam uploaded but has not marked done.
      { slug: "videos", ready: false, received: false },
    ]);
  });

  it("leaves exactly one person to chase for last Sunday", async () => {
    const tasks = await db.admin<{
      assignment_id: string;
      profile_id: string;
      category_id: string;
      done_at: Date | null;
    }>(
      `select ac.assignment_id, a.profile_id, ac.category_id, ac.done_at
       from public.assignment_categories ac
       join public.assignments a on a.id = ac.assignment_id
       where a.service_id = $1`,
      [LAST_SUNDAY],
    );
    const uploads = await db.admin<{ category_id: string; uploaded_by: string }>(
      "select category_id, uploaded_by from public.uploads where service_id = $1",
      [LAST_SUNDAY],
    );
    const outstanding = outstandingTasks(
      tasks.map((task) => ({
        assignmentId: task.assignment_id,
        serviceId: LAST_SUNDAY,
        profileId: task.profile_id,
        categoryId: task.category_id,
        doneAt: task.done_at ? task.done_at.toISOString() : null,
      })),
      uploads.map((upload) => ({
        serviceId: LAST_SUNDAY,
        categoryId: upload.category_id,
        uploadedBy: upload.uploaded_by,
      })),
    );
    // Only Kofi (fellowship): Sam uploaded, Grace marked done.
    expect(outstanding.map((task) => task.profileId)).toEqual([
      "20000000-0000-4000-8000-000000000004",
    ]);
  });

  it("shows the thumbnail viewer only preacher uploads", async () => {
    const seen = await db.as<{ slug: string }>(
      TOLA,
      `select distinct c.slug from public.uploads u
       join public.categories c on c.id = u.category_id`,
    );
    expect(seen.map((row) => row.slug)).toEqual(["preacher"]);
    // A member sees all three categories that have uploads.
    const all = await db.as(GRACE, "select distinct category_id from public.uploads");
    expect(all).toHaveLength(3);
  });
});
