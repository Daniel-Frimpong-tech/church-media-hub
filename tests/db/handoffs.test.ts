// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

let db: TestDatabase;
let admin: string;
let photographer: string;
let videographer: string;
let thumbnailViewer: string;
let socialViewer: string;
let thumbnails: string;
let social: string;
let preacher: string;
let baptism: string;
let photographerRole: string;

type Handoff = {
  id: string;
  due_at: Date;
  ready_at: Date | null;
  received_at: Date | null;
  received_by: string | null;
};

async function newService(startsAt: string): Promise<string> {
  const [{ id }] = await db.admin<{ id: string }>(
    "insert into public.services (name, starts_at) values ('Sunday Service', $1) returning id",
    [startsAt],
  );
  return id;
}

async function handoff(service: string, category: string, team: string): Promise<Handoff> {
  const [row] = await db.admin<Handoff>(
    "select id, due_at, ready_at, received_at, received_by from public.handoffs where service_id = $1 and category_id = $2 and team_id = $3",
    [service, category, team],
  );
  return row;
}

async function assign(service: string, person: string, categories: string[]): Promise<string> {
  const [{ id }] = await db.as<{ id: string }>(
    admin,
    "insert into public.assignments (service_id, profile_id, duty_role_id) values ($1, $2, $3) returning id",
    [service, person, photographerRole],
  );
  for (const category of categories) {
    await db.as(
      admin,
      "insert into public.assignment_categories (assignment_id, category_id) values ($1, $2)",
      [id, category],
    );
  }
  return id;
}

async function completeUpload(service: string, category: string, person: string): Promise<void> {
  const [{ id }] = await db.as<{ id: string }>(
    person,
    `insert into public.uploads (service_id, category_id, uploaded_by, file_name, mime_type, size_bytes)
     values ($1, $2, $3, 'a.jpg', 'image/jpeg', 1000) returning id`,
    [service, category, person],
  );
  await db.admin(
    "update public.uploads set status = 'complete', drive_file_id = $1, completed_at = now() where id = $1::uuid",
    [id],
  );
}

beforeAll(async () => {
  db = await createTestDatabase();
  [{ id: thumbnails }] = await db.admin<{ id: string }>(
    "insert into public.teams (name) values ('Thumbnails') returning id",
  );
  [{ id: social }] = await db.admin<{ id: string }>(
    "insert into public.teams (name) values ('Social') returning id",
  );
  admin = await db.signUp("admin@example.com", "admin");
  photographer = await db.signUp("photo@example.com", "member");
  videographer = await db.signUp("video@example.com", "member");
  thumbnailViewer = await db.signUp("thumbs@example.com", "viewer", thumbnails);
  socialViewer = await db.signUp("social@example.com", "viewer", social);
  [{ id: preacher }] = await db.admin<{ id: string }>(
    "select id from public.categories where slug = 'preacher'",
  );
  [{ id: baptism }] = await db.admin<{ id: string }>(
    "select id from public.categories where slug = 'baptism'",
  );
  [{ id: photographerRole }] = await db.admin<{ id: string }>(
    "select id from public.duty_roles where name = 'Photographer'",
  );
  // Preacher → Thumbnails within 24h. Baptism → Social within 48h.
  await db.as(
    admin,
    "insert into public.category_teams (category_id, team_id, deadline_hours) values ($1, $2, 24), ($3, $4, 48)",
    [preacher, thumbnails, baptism, social],
  );
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("handoffs follow services and mappings", () => {
  it("creates one handoff per mapped team when a service is created", async () => {
    const service = await newService("2030-01-06T18:00:00Z");
    const rows = await db.admin("select 1 from public.handoffs where service_id = $1", [service]);
    expect(rows).toHaveLength(2);
    expect((await handoff(service, preacher, thumbnails)).due_at.toISOString()).toBe(
      "2030-01-07T18:00:00.000Z",
    );
    expect((await handoff(service, baptism, social)).due_at.toISOString()).toBe(
      "2030-01-08T18:00:00.000Z",
    );
  });

  it("moves the deadline when the service is rescheduled", async () => {
    const service = await newService("2030-02-03T18:00:00Z");
    await db.as(admin, "update public.services set starts_at = '2030-02-10T18:00:00Z' where id = $1", [service]);
    expect((await handoff(service, preacher, thumbnails)).due_at.toISOString()).toBe(
      "2030-02-11T18:00:00.000Z",
    );
  });

  it("moves the deadline when the team's allowance changes", async () => {
    const service = await newService("2030-03-03T18:00:00Z");
    await db.as(
      admin,
      "update public.category_teams set deadline_hours = 12 where category_id = $1 and team_id = $2",
      [preacher, thumbnails],
    );
    expect((await handoff(service, preacher, thumbnails)).due_at.toISOString()).toBe(
      "2030-03-04T06:00:00.000Z",
    );
    await db.as(
      admin,
      "update public.category_teams set deadline_hours = 24 where category_id = $1 and team_id = $2",
      [preacher, thumbnails],
    );
  });

  it("adds and removes handoffs for upcoming services when a mapping changes", async () => {
    const service = await newService("2030-04-07T18:00:00Z");
    await db.as(
      admin,
      "insert into public.category_teams (category_id, team_id, deadline_hours) values ($1, $2, 6)",
      [preacher, social],
    );
    expect(await handoff(service, preacher, social)).toBeDefined();

    await db.as(
      admin,
      "delete from public.category_teams where category_id = $1 and team_id = $2",
      [preacher, social],
    );
    expect(await handoff(service, preacher, social)).toBeUndefined();
  });

  it("does not create handoffs for a retired category", async () => {
    await db.as(admin, "update public.categories set is_active = false where id = $1", [baptism]);
    const service = await newService("2030-05-05T18:00:00Z");
    expect(await handoff(service, baptism, social)).toBeUndefined();
    await db.as(admin, "update public.categories set is_active = true where id = $1", [baptism]);
  });
});

describe("when a category becomes ready", () => {
  it("is ready once everyone assigned has marked their task done", async () => {
    const service = await newService("2030-06-02T18:00:00Z");
    const first = await assign(service, photographer, [preacher]);
    const second = await assign(service, videographer, [preacher]);

    await db.as(photographer, "select public.set_task_done($1, $2, true)", [first, preacher]);
    expect((await handoff(service, preacher, thumbnails)).ready_at).toBeNull();

    await db.as(videographer, "select public.set_task_done($1, $2, true)", [second, preacher]);
    expect((await handoff(service, preacher, thumbnails)).ready_at).not.toBeNull();
  });

  it("stops being ready if a task is reopened", async () => {
    const service = await newService("2030-06-09T18:00:00Z");
    const assignment = await assign(service, photographer, [preacher]);
    await db.as(photographer, "select public.set_task_done($1, $2, true)", [assignment, preacher]);
    await db.as(photographer, "select public.set_task_done($1, $2, false)", [assignment, preacher]);
    expect((await handoff(service, preacher, thumbnails)).ready_at).toBeNull();
  });

  it("uploading alone does not make it ready while a task is still open", async () => {
    const service = await newService("2030-06-16T18:00:00Z");
    await assign(service, photographer, [preacher]);
    await completeUpload(service, preacher, photographer);
    expect((await handoff(service, preacher, thumbnails)).ready_at).toBeNull();
  });

  it("is ready on the first upload when nobody is assigned", async () => {
    const service = await newService("2030-06-23T18:00:00Z");
    expect((await handoff(service, preacher, thumbnails)).ready_at).toBeNull();
    await completeUpload(service, preacher, photographer);
    expect((await handoff(service, preacher, thumbnails)).ready_at).not.toBeNull();
  });

  it("re-evaluates when the only open assignment is removed", async () => {
    const service = await newService("2030-06-30T18:00:00Z");
    const assignment = await assign(service, photographer, [preacher]);
    await completeUpload(service, preacher, photographer);
    expect((await handoff(service, preacher, thumbnails)).ready_at).toBeNull();

    await db.as(admin, "delete from public.assignments where id = $1", [assignment]);
    // Nobody is assigned now, and a file exists.
    expect((await handoff(service, preacher, thumbnails)).ready_at).not.toBeNull();
  });
});

describe("marking tasks done", () => {
  it("stops someone marking another person's task", async () => {
    const service = await newService("2030-07-07T18:00:00Z");
    const assignment = await assign(service, photographer, [preacher]);
    await expect(
      db.as(videographer, "select public.set_task_done($1, $2, true)", [assignment, preacher]),
    ).rejects.toThrow(/not_allowed/);
    await expect(
      db.as(thumbnailViewer, "select public.set_task_done($1, $2, true)", [assignment, preacher]),
    ).rejects.toThrow(/not_allowed/);
  });

  it("lets an admin mark it for them", async () => {
    const service = await newService("2030-07-14T18:00:00Z");
    const assignment = await assign(service, photographer, [preacher]);
    await db.as(admin, "select public.set_task_done($1, $2, true)", [assignment, preacher]);
    expect((await handoff(service, preacher, thumbnails)).ready_at).not.toBeNull();
  });

  it("stops a member editing tasks directly", async () => {
    await expect(
      db.as(photographer, "update public.assignment_categories set done_at = now()"),
    ).resolves.toHaveLength(0);
    expect(
      await db.admin(
        `select 1 from public.assignment_categories ac
         join public.assignments a on a.id = ac.assignment_id
         where a.service_id = (select id from public.services order by starts_at desc limit 1)
           and ac.done_at is not null and a.profile_id <> $1`,
        [photographer],
      ),
    ).toHaveLength(0);
  });
});

describe("confirming a handoff", () => {
  it("lets the receiving team confirm, and records who and when", async () => {
    const service = await newService("2030-08-04T18:00:00Z");
    const { id } = await handoff(service, preacher, thumbnails);
    await db.as(thumbnailViewer, "select public.set_handoff_received($1, true)", [id]);

    const after = await handoff(service, preacher, thumbnails);
    expect(after.received_at).not.toBeNull();
    expect(after.received_by).toBe(thumbnailViewer);
    expect(after.ready_at).not.toBeNull();
  });

  it("stops another team confirming it", async () => {
    const service = await newService("2030-08-11T18:00:00Z");
    const { id } = await handoff(service, preacher, thumbnails);
    await expect(
      db.as(socialViewer, "select public.set_handoff_received($1, true)", [id]),
    ).rejects.toThrow(/not_allowed/);
    await expect(
      db.as(photographer, "select public.set_handoff_received($1, true)", [id]),
    ).rejects.toThrow(/not_allowed/);
  });

  it("lets only an admin undo a confirmation", async () => {
    const service = await newService("2030-08-18T18:00:00Z");
    const { id } = await handoff(service, preacher, thumbnails);
    await db.as(thumbnailViewer, "select public.set_handoff_received($1, true)", [id]);

    await expect(
      db.as(thumbnailViewer, "select public.set_handoff_received($1, false)", [id]),
    ).rejects.toThrow(/not_allowed/);

    await db.as(admin, "select public.set_handoff_received($1, false)", [id]);
    const after = await handoff(service, preacher, thumbnails);
    expect(after.received_at).toBeNull();
    // Nothing was uploaded and nobody is assigned, so it is not ready either.
    expect(after.ready_at).toBeNull();
  });

  it("stops anyone changing handoffs directly", async () => {
    await expect(
      db.as(thumbnailViewer, "update public.handoffs set received_at = now()"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(admin, "update public.handoffs set due_at = now()"),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("who can see handoffs", () => {
  it("shows a viewer only their own team's", async () => {
    const teams = await db.as<{ team_id: string }>(
      thumbnailViewer,
      "select distinct team_id from public.handoffs",
    );
    expect(teams.map((row) => row.team_id)).toEqual([thumbnails]);
  });

  it("shows admins and members all of them", async () => {
    for (const person of [admin, photographer]) {
      const teams = await db.as<{ team_id: string }>(
        person,
        "select distinct team_id from public.handoffs",
      );
      expect(teams.map((row) => row.team_id).sort()).toEqual([thumbnails, social].sort());
    }
  });
});

describe("deleting uploads", () => {
  it("un-readies a category when its only file is deleted and nobody is assigned", async () => {
    const service = await newService("2030-09-01T18:00:00Z");
    await completeUpload(service, preacher, photographer);
    expect((await handoff(service, preacher, thumbnails)).ready_at).not.toBeNull();

    await db.as(admin, "delete from public.uploads where service_id = $1", [service]);
    expect((await handoff(service, preacher, thumbnails)).ready_at).toBeNull();
  });

  it("keeps a confirmed handoff as it was", async () => {
    const service = await newService("2030-09-08T18:00:00Z");
    await completeUpload(service, preacher, photographer);
    const { id } = await handoff(service, preacher, thumbnails);
    await db.as(thumbnailViewer, "select public.set_handoff_received($1, true)", [id]);

    await db.as(admin, "delete from public.uploads where service_id = $1", [service]);
    const after = await handoff(service, preacher, thumbnails);
    expect(after.received_at).not.toBeNull();
    expect(after.ready_at).not.toBeNull();
  });

  it("lets only admins delete an upload", async () => {
    const service = await newService("2030-09-15T18:00:00Z");
    await completeUpload(service, preacher, photographer);

    // Not an error: Row Level Security simply matches no rows for them.
    await db.as(photographer, "delete from public.uploads where service_id = $1", [service]);
    await db.as(thumbnailViewer, "delete from public.uploads where service_id = $1", [service]);
    expect(
      await db.admin("select 1 from public.uploads where service_id = $1", [service]),
    ).toHaveLength(1);
  });

  it("lets an admin delete a service once its uploads are removed, taking everything with it", async () => {
    const service = await newService("2030-09-22T18:00:00Z");
    await assign(service, photographer, [preacher]);
    await completeUpload(service, preacher, photographer);

    // Upload records protect the service from being deleted by accident.
    await expect(
      db.as(admin, "delete from public.services where id = $1", [service]),
    ).rejects.toThrow(/foreign key/);

    await db.as(admin, "delete from public.uploads where service_id = $1", [service]);
    await db.as(admin, "delete from public.services where id = $1", [service]);

    for (const table of ["handoffs", "assignments", "uploads"]) {
      expect(
        await db.admin(`select 1 from public.${table} where service_id = $1`, [service]),
      ).toHaveLength(0);
    }
  });
});
