# Design system

The look of RCW Media is adapted from the **Spotify** entry in
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/spotify):
a dark, immersive interface where every surface is a shade of charcoal, so the
content supplies the colour. For Spotify the content is album art. For us it is
the church's photos.

We borrow the structure, not the brand. Two things are deliberately different:

- **Font:** Figtree (free, geometric) instead of Spotify's proprietary typeface.
- **Accent:** our own violet instead of Spotify green, so the app does not read as theirs.

(The first version of the app used a light design adapted from Airbnb's system.
It was replaced because it came out text-heavy and plain. See DECISIONS.md.)

The tokens live in [`app/globals.css`](../app/globals.css) inside `@theme`, which
turns each one into a Tailwind utility. Build screens from these utilities and
the components in `components/`. Do not use raw hex values or Tailwind's default
colour palette (`zinc-500`, `blue-600` and so on).

## Principles

1. **Photos are the colour.** Chrome is charcoal and white. Wherever a screen can
   show real photos (a service's cover, recent uploads), it does.
2. **One accent.** Violet marks the main action on a screen, the active
   navigation item, and data in charts. Nothing else is violet.
3. **Fewest taps.** The thing someone most likely came to do is on the first
   screen, as a button, not behind a card that leads to another page.
4. **Alive, not busy.** Things rise in when a page opens, numbers count up,
   buttons press in, cards respond to hover. All of it stops for people who ask
   their device for reduced motion.
5. **Phone first.** Design at 375px wide, then add columns. Anything tappable is
   at least 44px tall, and primary actions 48px.

## Colour

### Surfaces

Depth comes from stepping up this ladder, not from borders or shadows.

| Utility | Value | Use |
|---|---|---|
| `canvas` | `#101012` | The page, the sidebar |
| `surface` | `#18181b` | Cards and panels |
| `surface-soft` | `#1f1f23` | Rows inside a card, inputs, card hover |
| `surface-strong` | `#2a2a30` | Active nav item, neutral badges, chart tracks |
| `surface-hover` | `#32323a` | Hover on the step above |

### Text and lines

| Utility | Value | Use |
|---|---|---|
| `ink` | `#ffffff` | Headings, primary text |
| `ink-soft` | `#d4d4d8` | Body paragraphs |
| `muted` | `#a1a1aa` | Secondary text, metadata |
| `muted-soft` | `#71717a` | Placeholders, axis labels, inactive tabs |
| `hairline` | `#2e2e35` | Dividers, chart gridlines, input borders |
| `hairline-soft` | `#232328` | The faintest dividers |
| `border-strong` | `#52525b` | Outlined buttons |

### Accent

| Utility | Value | Use |
|---|---|---|
| `primary` | `#9d8cff` | Main action, active nav icon, chart marks |
| `primary-active` | `#b3a6ff` | Hover and pressed |
| `primary-soft` | 16% violet | Accent badges, soft washes |
| `on-primary` | `#14121f` | Text on a violet button (dark, for contrast) |

### Status

Status is never shown by colour alone: always pair it with a word or icon.

| Meaning | Text | Background | Used for |
|---|---|---|---|
| Good | `success` `#4ade80` | `success-soft` | Delivered, uploaded, connected |
| Waiting | `warning` `#fbbf24` | `warning-soft` | Pending, due soon, still to upload |
| Problem | `danger` `#fb7185` | `danger-soft` | Late, failed upload, expired connection |

## Type

Figtree. Bold or regular, little in between: hierarchy comes from weight.

| Utility | Size / weight | Use |
|---|---|---|
| `text-hero` | 40px / 800 | The home greeting, the sign-in headline |
| `text-display` | 30px / 800 | Page titles, big numbers in stat tiles |
| `text-title-lg` | 22px / 700 | Section headings |
| `text-title` | 16px / 700 | Card titles |
| `text-body` | 16px / 400 | Paragraphs, inputs |
| `text-body-sm` | 14px / 400 | Most interface text, buttons (bold) |
| `text-caption` | 13px / 400 | Metadata, footnotes |
| `text-label` | 11px / 700, uppercase, wide | Small section labels ("ADMIN", "UP NEXT") |
| `text-badge` | 11px / 700 | Badges |

## Shape, depth and motion

- **Pills for anything you press** (`rounded-full`): buttons, badges, filter chips.
- **Soft corners for anything you read:** `rounded-md` 10px (rows, inputs, photos),
  `rounded-lg` 16px (cards), `rounded-xl` 24px (the hero card, sheets).
- **Shadows only for things that float** over content: `shadow-float` for sheets
  and menus, `shadow-card` for lifted imagery.
- **Motion utilities:** `animate-rise` (enter from below), `animate-grow-x` /
  `animate-grow-y` (bars and columns), and the `stagger` class on a container to
  bring its children in one after another.

## Layout

| Breakpoint | Width | Navigation | Columns |
|---|---|---|---|
| default | under 744px | Top bar and bottom tab bar | 1 (2 for stat tiles) |
| `tablet:` | 744px and up | Same | 2 |
| `desktop:` | 1100px and up | Sidebar | 3 or 4 |

Content is capped at 1200px. On desktop every section, including each admin
page, is one click away in the sidebar. On phones the four main sections are in
the tab bar and the rest are in the "More" sheet.

## Components

- **`components/ui`**: `Button` (primary, secondary, ghost, danger; pill shaped),
  `Badge`, `Card`, `Input`, `Select`, `Avatar` and `AvatarStack` (initials on a
  tint that is always the same for a person), `ProgressRing`, `ActionButton`.
- **`components/ui/modal.tsx`**: `Modal`, a button that opens a panel (a bottom
  sheet on phones, a dialog on larger screens).
- **`components/admin`**: the admin screens. Each kind of thing is a card that
  looks like what it is (a folder for a category, a calendar tile for a weekly
  service) in a grid, ending with a dashed "new" tile. Tapping a card opens its
  controls in a panel.
- **`components/shell`**: `AppShell`, the frame around every signed-in page.
- **`components/upload`**: `UploadProvider` (the upload sheet, its queue and the
  floating progress pill, available on every page) and `UploadButton`, which
  opens the sheet already pointed at a service or category.
- **`components/services`**, **`components/gallery`**, **`components/dashboard`**:
  one "view" per screen. A view takes plain data and draws it; a loader in
  `lib/` fetches that data. This split is what makes the previews possible.
- **`components/charts`**: `ColumnChart`, `BarList`, `CountUp`.

## Charts

Charts follow a few fixed rules so they read the same everywhere.

- **One hue for "how many".** Columns and bars are violet; the current period is
  full strength and earlier ones are dimmer. Colour is not used to tell
  categories apart, because a label does that better.
- **Thin marks.** Columns are at most 24px wide, rounded at the top and square on
  the baseline. Bars are thin lines on a darker track.
- **Numbers are written out.** Every bar has its value beside it. The column
  chart shows a value on hover, focus or tap, and has the same data as a table
  for screen readers.
- **Text is never the data colour.** Labels and values use the text tokens.
- **Status colours mean status.** Green, amber and red appear only where the
  thing shown is good, waiting or a problem, such as the on-time meter.

## Previewing screens

`/preview/<screen>` renders a real screen with sample data, with no sign-in and
no database. Screens: `dashboard`, `dashboard-empty`, `dashboard-member`,
`dashboard-viewer`, `service`, `services`, `album`, `gallery`, `upload` (the
upload sheet open), `categories`, `category-open`, `teams`, `people`,
`schedule`, `shares`, `share` (what a visitor sees on a share link),
`share-unavailable`, `login` and `login-error`. They exist only in local development
(`npm run dev`); on a deployed build they are a 404.

```bash
node tests/tools/screenshot.mjs http://localhost:3000 ./shots dashboard login
```

takes phone and desktop screenshots of them.
