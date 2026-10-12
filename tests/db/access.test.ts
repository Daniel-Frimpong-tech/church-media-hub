// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

let db: TestDatabase;
let admin: string;
let member: string;
let thumbnailViewer: string;
let socialViewer: string;
let thumbnails: string;
let social: string;
let preacher: string;
let baptism: string;
let service: string;

beforeAll(async () => {
  db = await createTestDatabase();

  [{ id: thumbnails }] = await db.admin<{ id: string }>(
    "insert into public.teams (name) values ('Thumbnails') returning id",
  );
  [{ id: social }] = await db.admin<{ id: string }>(
    "insert into public.teams (name) values ('Social') returning id",
  );
  admin = await db.signUp("admin@example.com", "admin");
  member = await db.signUp("member@example.com", "member");
  thumbnailViewer = await db.signUp("thumbs@example.com", "viewer", thumbnails);
  socialViewer = await db.signUp("social@example.com", "viewer", social);

  [{ id: preacher }] = await db.admin<{ id: string }>(
    "select id from public.categories where slug = 'preacher'",
  );
  [{ id: baptism }] = await db.admin<{ id: string }>(
    "select id from public.categories where slug = 'baptism'",
  );
  // Preacher photos go to the thumbnail team. Baptism goes to nobody yet.
  await db.admin(
    "insert into public.category_teams (category_id, team_id) values ($1, $2)",
    [preacher, thumbnails],
  );
  [{ id: service }] = await db.admin<{ id: string }>(
    "insert into public.services (name, starts_at) values ('Sunday Service', now()) returning id",
  );
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("invite-only sign-up", () => {
  it("refuses an account whose email was not invited", async () => {
    await expect(
      db.admin("insert into auth.users (email) values ('stranger@example.com')"),
    ).rejects.toThrow(/not_invited/);
    expect(
      await db.admin("select 1 from auth.users where email = 'stranger@example.com'"),
    ).toHaveLength(0);
  });

  it("creates the profile with the invited role and team", async () => {
    const [profile] = await db.admin(
      "select role, active from public.profiles where id = $1",
      [thumbnailViewer],
    );
    expect(profile).toEqual({ role: "viewer", active: true });
    expect(
      await db.admin(
        "select 1 from public.team_members where profile_id = $1 and team_id = $2",
        [thumbnailViewer, thumbnails],
      ),
    ).toHaveLength(1);
  });

  it("matches the invite whatever case Google reports the email in", async () => {
    await db.admin("insert into public.invites (email, role) values ('grace@example.com', 'member')");
    await db.admin("insert into auth.users (email) values ('Grace@Example.com')");
    expect(
      await db.admin("select 1 from public.profiles where email = 'grace@example.com'"),
    ).toHaveLength(1);
  });
});

describe("signed-out visitors", () => {
  it.each(["profiles", "invites", "teams", "services", "uploads", "google_connection", "handoffs"])(
    "cannot read %s",
    async (table) => {
      await expect(db.asAnon(`select * from public.${table}`)).rejects.toThrow(
        /permission denied/,
      );
    },
  );
});

describe("people and invites", () => {
  it("lets only admins see invites", async () => {
    expect((await db.as(admin, "select 1 from public.invites")).length).toBeGreaterThan(0);
    expect(await db.as(member, "select 1 from public.invites")).toHaveLength(0);
    expect(await db.as(thumbnailViewer, "select 1 from public.invites")).toHaveLength(0);
  });

  it("stops a member inviting someone", async () => {
    await expect(
      db.as(member, "insert into public.invites (email, role) values ('friend@example.com', 'admin')"),
    ).rejects.toThrow(/row-level security/);
  });

  it("stops a member promoting themselves", async () => {
    await db.as(member, "update public.profiles set role = 'admin' where id = $1", [member]);
    const [profile] = await db.admin("select role from public.profiles where id = $1", [member]);
    expect(profile.role).toBe("member");
  });

  it("refuses to remove the last admin", async () => {
    await expect(
      db.as(admin, "update public.profiles set role = 'member' where id = $1", [admin]),
    ).rejects.toThrow(/last_admin/);
    await expect(
      db.as(admin, "update public.profiles set active = false where id = $1", [admin]),
    ).rejects.toThrow(/last_admin/);
  });

  it("shuts a deactivated person out of everything", async () => {
    const leaver = await db.signUp("leaver@example.com", "member");
    expect((await db.as(leaver, "select 1 from public.services")).length).toBeGreaterThan(0);

    await db.as(admin, "update public.profiles set active = false where id = $1", [leaver]);

    expect(await db.as(leaver, "select 1 from public.services")).toHaveLength(0);
    expect(await db.as(leaver, "select 1 from public.profiles")).toHaveLength(0);
  });
});

describe("the church Google connection", () => {
  it("cannot be read by anyone signed in, even an admin", async () => {
    await expect(db.as(admin, "select * from public.google_connection")).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("uploads", () => {
  let preacherUpload: string;
  let baptismUpload: string;

  beforeAll(async () => {
    // A member starts two uploads; the server (owner) marks them complete.
    for (const [category, name] of [
      [preacher, "preacher.jpg"],
      [baptism, "baptism.jpg"],
    ]) {
      const [row] = await db.as<{ id: string }>(
        member,
        `insert into public.uploads (service_id, category_id, uploaded_by, file_name, mime_type, size_bytes)
         values ($1, $2, $3, $4, 'image/jpeg', 1000) returning id`,
        [service, category, member, name],
      );
      await db.admin(
        "update public.uploads set status = 'complete', drive_file_id = $2, completed_at = now() where id = $1",
        [row.id, `drive-${name}`],
      );
      if (category === preacher) preacherUpload = row.id;
      else baptismUpload = row.id;
    }
  });

  it("lets a viewer see only categories delivered to their team", async () => {
    const seen = await db.as<{ id: string }>(thumbnailViewer, "select id from public.uploads");
    expect(seen.map((row) => row.id)).toEqual([preacherUpload]);
  });

  it("shows a viewer on another team nothing", async () => {
    expect(await db.as(socialViewer, "select id from public.uploads")).toHaveLength(0);
  });

  it("lets admins and members see every upload", async () => {
    const ids = [preacherUpload, baptismUpload].sort();
    for (const person of [admin, member]) {
      const seen = await db.as<{ id: string }>(person, "select id from public.uploads");
      expect(seen.map((row) => row.id).sort()).toEqual(ids);
    }
  });

  it("hides unfinished uploads from viewers", async () => {
    await db.as(
      member,
      `insert into public.uploads (service_id, category_id, uploaded_by, file_name, mime_type, size_bytes)
       values ($1, $2, $3, 'in-progress.jpg', 'image/jpeg', 1000)`,
      [service, preacher, member],
    );
    const seen = await db.as<{ file_name: string }>(
      thumbnailViewer,
      "select file_name from public.uploads",
    );
    expect(seen.map((row) => row.file_name)).toEqual(["preacher.jpg"]);
  });

  it("stops a viewer uploading", async () => {
    await expect(
      db.as(
        thumbnailViewer,
        `insert into public.uploads (service_id, category_id, uploaded_by, file_name, mime_type, size_bytes)
         values ($1, $2, $3, 'x.jpg', 'image/jpeg', 1000)`,
        [service, preacher, thumbnailViewer],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("stops a member uploading in someone else's name", async () => {
    await expect(
      db.as(
        member,
        `insert into public.uploads (service_id, category_id, uploaded_by, file_name, mime_type, size_bytes)
         values ($1, $2, $3, 'x.jpg', 'image/jpeg', 1000)`,
        [service, preacher, admin],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("stops anyone signed in marking an upload complete themselves", async () => {
    await expect(
      db.as(member, "update public.uploads set status = 'complete' where uploaded_by = $1", [member]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("server-only tables", () => {
  it.each(["app_settings", "telegram_link_tokens", "notification_log", "drive_grants"])(
    "%s cannot be read by anyone signed in, even an admin",
    async (table) => {
      await expect(db.as(admin, `select * from public.${table}`)).rejects.toThrow(
        /permission denied/,
      );
    },
  );

  it("lets people see who has linked Telegram, but not link it themselves", async () => {
    await db.admin("update public.profiles set telegram_user_id = 4242 where id = $1", [member]);
    const [seen] = await db.as<{ telegram_user_id: string | null }>(
      thumbnailViewer,
      "select telegram_user_id from public.profiles where id = $1",
      [member],
    );
    expect(Number(seen.telegram_user_id)).toBe(4242);

    // A member's update to their own profile matches no rows: only admins may.
    await db.as(member, "update public.profiles set telegram_user_id = 1 where id = $1", [member]);
    const [after] = await db.admin<{ telegram_user_id: string }>(
      "select telegram_user_id from public.profiles where id = $1",
      [member],
    );
    expect(Number(after.telegram_user_id)).toBe(4242);
  });
});
