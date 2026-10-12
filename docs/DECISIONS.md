# Decisions

A running log of the main technical choices in this project and why they were
made. Newest phase at the bottom.

## Phase 0: Foundation

### Design system adapted from Airbnb's

**Choice:** Base the UI on the Airbnb `DESIGN.md` from awesome-design-md, with our
own font (Geist) and accent colour (indigo). Details are in [DESIGN.md](DESIGN.md).

**Why:** The app is mostly photo albums viewed on phones. Airbnb's system is built
for exactly that: a white canvas, quiet type, rounded photo cards and 48px touch
targets. Swapping the font and accent keeps the structure while avoiding a
licensed font and another company's brand colour.

### Design tokens in Tailwind's `@theme`, not a component library

**Choice:** Colours, radii, type sizes and breakpoints are CSS variables in
`app/globals.css`. Tailwind 4 turns each into a utility class. UI primitives are
small hand-written components in `components/ui`.

**Why:** No extra dependencies, nothing to pay for, and one file to change if the
look needs adjusting. A library like shadcn/ui would work too, but it brings its
own token names and far more components than v1 needs.

### Light mode only for v1

**Choice:** Removed the starter's dark-mode colours.

**Why:** A half-finished dark mode looks worse than none. Tokens are named by
role (`canvas`, `ink`), so dark values can be added later in one place.

### Business rules as pure functions in `lib/domain`

**Choice:** Rules like "is this handoff late?" live in plain TypeScript functions
that take their inputs (including the current time) as arguments. They never read
the database or the clock themselves.

**Why:** The dashboard, the reminder job and the Telegram bot must all agree on
the answer. A pure function can be unit tested without a database, and passing
`now` in makes time-based tests exact instead of flaky.

**Rule recorded here:** a handoff is `pending` until its deadline, `late` after
it, and `delivered` once the receiving team marks it received, even if that was
after the deadline. Late deliveries are still identifiable (`wasDeliveredLate`).

### Vitest for unit tests, Playwright for end-to-end

**Choice:** Vitest with jsdom and React Testing Library for logic and simple
components. Playwright, emulating a Pixel 7, for flows through the real app.

**Why:** This is the setup the Next.js 16 docs recommend. Vitest cannot render
async Server Components, so anything involving pages and data is tested through
Playwright instead. The phone profile matches how the app will actually be used.

### CI on GitHub Actions, two jobs

**Choice:** One job runs lint, typecheck and unit tests. A second builds the app
and runs Playwright against the production build.

**Why:** The fast job fails within a minute or two on simple mistakes. The slower
job proves the app really builds and loads. GitHub Actions is free for public
repositories.

### `@types/node` moved from 20 to 24

**Choice:** Bumped the Node type definitions.

**Why:** Vitest 5 requires Node types 22 or newer, and the project runs on Node 24
locally and in CI.

### Work on a branch per phase

**Choice:** Each phase is built on its own branch and merged to `main` when it is
finished and checked.

**Why:** Vercel deploys `main` to the live site and every other branch to its own
preview URL. A phase can be verified on a real Vercel build without changing what
the team sees until it is ready.

## Phase 1: Sign-in and roles

### The invite gate is a database trigger

**Choice:** A trigger on Supabase's `auth.users` table runs when a new account
is being created. If the email has no row in `invites`, it raises an error and
the whole sign-up is rolled back. If there is an invite, the same trigger creates
the person's profile with the invited role and team.

**Why:** Checking invites in app code would leave a gap: anyone could call
Supabase's sign-up API directly and get an account. Putting the rule in the
database means there is exactly one door, and it is locked for every route in.
Supabase also offers a "Before User Created" hook that can do this, but it is
configured by hand in the dashboard, while a trigger lives in a migration and is
version controlled.

### Permissions are enforced by Row Level Security, mirrored in TypeScript

**Choice:** Every table has RLS policies that use two small helper functions,
`private.current_app_role()` and `private.is_admin()`. The app talks to the
database as the signed-in user with the publishable key, so those policies apply
to every query. `lib/domain/permissions.ts` repeats the same rules in TypeScript.

**Why:** RLS is the real protection: even a bug in a page or a hand-crafted
request cannot read or change rows the policies forbid. The TypeScript copy only
exists to hide buttons people cannot use and to give friendly error messages.
The helper functions sit in a `private` schema that Supabase does not expose
through its API, and they are `security definer` so the `profiles` policy can
look up a role without recursing into itself.

### People are deactivated, not deleted

**Choice:** Removing someone sets `profiles.active` to false. A deactivated
person has no role, so every policy treats them as a stranger.

**Why:** Uploads will record who uploaded them. Deleting the person would either
delete that history or leave it pointing at nobody.

### There is always at least one admin

**Choice:** A trigger refuses any change that would demote or deactivate the last
active admin, and the app does not let admins change their own access.

**Why:** With no admin, nobody could invite people or fix roles, and the only
way back in would be editing the database by hand.

### Emails are stored lowercase

**Choice:** `profiles.email` and `invites.email` have a check constraint
requiring lowercase, and the app normalizes before saving.

**Why:** Google treats `Grace@gmail.com` and `grace@gmail.com` as the same
account. Storing one canonical form avoids an invite silently failing to match.
Postgres has a case-insensitive text type (`citext`), but its operators live in
a separate schema, which is awkward inside the locked-down trigger functions.

### Session refresh in `proxy.ts`

**Choice:** `proxy.ts` (Next.js 16's new name for middleware) refreshes the
Supabase session cookie on each navigation and redirects signed-out visitors to
`/login`. Pages still call `requireProfile()` or `requireAdmin()` themselves.

**Why:** Server Components cannot write cookies, so something that runs before
them has to refresh an expiring session. The redirect there is for convenience
only. The Next.js docs are explicit that the proxy should not be the only check,
so each page verifies the user again next to the data it loads.

### Supabase's new publishable and secret keys

**Choice:** Use the `sb_publishable_…` and `sb_secret_…` keys, not the legacy
`anon` and `service_role` JWTs.

**Why:** Supabase is steering new projects to these. A secret key can be revoked
and replaced on its own, while replacing a legacy key means rotating the JWT
secret for the whole project. Phase 1 does not use the secret key at all: every
query runs as the signed-in user.

### Database types are hand-written for now

**Choice:** `lib/supabase/database.types.ts` is written by hand to match the
migration.

**Why:** Generating it needs the Supabase CLI to be logged in and linked, which
is a manual step. Once that is done it will be regenerated with
`npx supabase gen types typescript --linked` and kept that way.

## Phase 2: Services and Google Drive

### One church Google account, connected once by an admin

**Choice:** An admin signs in once with the church Google account. The app keeps
that account's refresh token and uses it for every Drive action, whoever is
signed in to the app.

**Why:** Files have to be owned by the church account so they count against its
1 TB and stay put when volunteers leave. If each volunteer uploaded with their
own Google sign-in, the files would live in their personal Drives.

### The `drive.file` scope

**Choice:** The app asks Google only for `drive.file`.

**Why:** It is the narrowest Drive permission: the app can see and change only
the files and folders it created itself, nothing else in the church's Drive. That
is enough because the app creates the "RCW Media" folder and everything inside
it. It is also a "non-sensitive" scope, so Google does not require a security
review before the app can be published. The trade-off: a file someone drops into
those folders by hand in Drive is invisible to the app.

### Refresh token encrypted with AES-256-GCM, readable only with the secret key

**Choice:** The refresh token is encrypted with a key held in an environment
variable (`TOKEN_ENCRYPTION_KEY`) before it is stored. The table it lives in has
Row Level Security on and no policies, so no signed-in user can read it, not
even an admin. Only server code using the Supabase secret key can.

**Why:** Two separate things would have to leak (the database and the server's
environment) before anyone could reach the church's Drive. GCM also detects
tampering: a modified value fails to decrypt instead of producing garbage.
Because local development and the live site share one database, they must use
the same `TOKEN_ENCRYPTION_KEY`.

### Plain `fetch` instead of Google's SDK

**Choice:** `lib/google` calls Google's HTTP endpoints directly.

**Why:** The app needs four calls: exchange a code, refresh a token, create a
folder, start an upload. The official `googleapis` package is very large and
would slow every server start for the sake of those four.

### Saving the service never depends on Drive

**Choice:** Creating a service saves it first, then creates folders. If Drive
fails, the service is kept and marked `failed` with the reason, and its page
offers a retry. Folder creation records each folder ID as soon as it exists, so
a retry only makes what is missing.

**Why:** Google being slow, or the connection having expired, should not lose an
admin's work or leave duplicate folders behind after a retry.

### An expired connection is recorded, not just thrown

**Choice:** When Google rejects the refresh token, the connection row is marked
`expired`. Admins then see a "Reconnect Google" banner on the dashboard.

**Why:** The person who hits the failure may be a volunteer who cannot fix it.
Recording it means the next admin to open the app is told, instead of finding
out when uploads are already missing.

### Times are stored in UTC and shown in Pacific time

**Choice:** `services.starts_at` is a UTC timestamp. Forms take a Pacific date
and time and convert with `churchLocalToUtc`; every display formats back to
`America/Los_Angeles`.

**Why:** Vercel's servers run in UTC and a volunteer's phone could be in any
zone. Converting explicitly, with tests on both daylight-saving changeovers,
means "10:00" always means 10am at church.
