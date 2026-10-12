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
