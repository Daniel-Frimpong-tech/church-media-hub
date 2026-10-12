import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * A real Postgres, running inside the test process, with every migration in
 * supabase/migrations applied. Lets the tests check Row Level Security and
 * triggers themselves rather than a description of them.
 *
 * It stands in for the parts of Supabase the migrations rely on: the three
 * API roles, the auth.users table, and auth.uid().
 */

const SUPABASE_STANDINS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  -- Supabase reads the signed-in user's ID from the request's token.
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export async function createTestDatabase(): Promise<TestDatabase> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STANDINS);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    try {
      await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return new TestDatabase(pg);
}

type Row = Record<string, unknown>;

export class TestDatabase {
  constructor(private readonly pg: PGlite) {}

  /** Runs SQL as the database owner: no Row Level Security. For test setup. */
  async admin<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
    return (await this.pg.query<T>(sql, params)).rows;
  }

  /** Runs SQL the way the app does for a signed-in person. */
  async as<T extends Row = Row>(
    userId: string,
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    await this.pg.exec("reset role;");
    await this.pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await this.pg.exec("set role authenticated;");
    try {
      return (await this.pg.query<T>(sql, params)).rows;
    } finally {
      await this.pg.exec("reset role;");
    }
  }

  /** Runs SQL as a signed-out visitor. */
  async asAnon<T extends Row = Row>(sql: string): Promise<T[]> {
    await this.pg.exec(
      "reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;",
    );
    try {
      return (await this.pg.query<T>(sql)).rows;
    } finally {
      await this.pg.exec("reset role;");
    }
  }

  /** Invites an email and signs them up, as Google sign-in would. Returns their ID. */
  async signUp(
    email: string,
    role: "admin" | "member" | "viewer",
    teamId: string | null = null,
  ): Promise<string> {
    await this.admin(
      "insert into public.invites (email, role, team_id) values ($1, $2, $3)",
      [email, role, teamId],
    );
    const [user] = await this.admin<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [email, JSON.stringify({ full_name: email.split("@")[0] })],
    );
    return user.id;
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}
