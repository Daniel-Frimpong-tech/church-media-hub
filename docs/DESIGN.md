# Design system

The look of RCW Media is adapted from the **Airbnb** entry in
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/airbnb).
That system is photo-led: a white canvas, quiet type and one accent colour, so the
pictures carry the visual weight. That suits an app whose main job is showing
albums on a phone.

We borrow the structure, not the brand. Two things are deliberately different:

- **Font:** Geist (free, already in the project) instead of Airbnb's licensed Cereal.
- **Accent:** our own indigo instead of Airbnb's red, so the app does not read as theirs.

The tokens live in [`app/globals.css`](../app/globals.css) inside `@theme`, which
turns each one into a Tailwind utility. Build screens from these utilities and the
components in `components/ui`. Do not use raw hex values or Tailwind's default
colour palette (`zinc-500`, `blue-600` and so on).

## Principles

1. **Photos first.** Chrome stays white and grey. Thumbnails are the colour on the page.
2. **One accent, used sparingly.** One or two indigo moments per screen: the main action and the active state.
3. **Soft shapes.** Every interactive element is rounded. No square corners.
4. **Flat by default.** Hairline borders separate things. There is exactly one shadow, for things that float.
5. **Phone first.** Design at 375px wide, then add columns. Anything tappable is at least 48px tall.

## Colour

| Utility | Value | Use |
|---|---|---|
| `primary` | `#4338ca` | Main action per screen, active tab, links |
| `primary-active` | `#3730a3` | Pressed state |
| `primary-soft` | `#eef0ff` | Accent badge and selected-row background |
| `primary-disabled` | `#c7cbf5` | Disabled primary button |
| `ink` | `#222222` | Headings and primary text |
| `ink-soft` | `#3f3f3f` | Body paragraphs |
| `muted` | `#6a6a6a` | Secondary text, metadata |
| `muted-soft` | `#929292` | Placeholders, disabled text |
| `canvas` | `#ffffff` | Page and card background |
| `surface-soft` | `#f7f7f7` | Subtle bands, photo placeholders |
| `surface-strong` | `#f2f2f2` | Pressed states, neutral badge |
| `hairline` | `#dddddd` | Card borders and dividers |
| `hairline-soft` | `#ebebeb` | Dividers inside a card |
| `border-strong` | `#c1c1c1` | Input borders |

### Status colours

Airbnb's system has no status colours, so these are ours. Each has a text colour
and a soft background, and status is never shown by colour alone: always pair it
with a word.

| Meaning | Text | Background | Used for |
|---|---|---|---|
| Good | `success` `#1a7f4b` | `success-soft` | Delivered, uploaded, connected |
| Waiting | `warning` `#8a5300` | `warning-soft` | Pending, due soon |
| Problem | `danger` `#c13515` | `danger-soft` | Late, failed upload, expired Google connection |

## Type

Geist at modest weights. Each size utility sets its own line height and weight.

| Utility | Size / weight | Use |
|---|---|---|
| `text-display` | 28px / 700 | Page title, one per screen |
| `text-title-lg` | 22px / 600 | Section heading |
| `text-title` | 16px / 600 | Card title, list row title |
| `text-body` | 16px / 400 | Paragraphs, inputs, buttons |
| `text-body-sm` | 14px / 400 | Metadata, helper text |
| `text-caption` | 13px / 400 | Timestamps, photo counts |
| `text-badge` | 11px / 600 | Badges only |

## Shape, spacing and depth

- **Radius:** `rounded-sm` 8px (buttons, inputs), `rounded-md` 14px (cards, photos),
  `rounded-lg` 20px (sheets), `rounded-xl` 32px (large panels), `rounded-full` (badges, filter pills, icon buttons).
- **Spacing:** Tailwind's 4px scale. Use 16px gutters between cards and photos,
  24px inside cards, 64px between major page sections.
- **Shadow:** `shadow-float` is the only shadow. Use it for menus, bottom sheets and
  the sticky upload bar. Cards and photos are flat.
- **Scrim:** `bg-scrim/50` behind dialogs and the full-size photo viewer.

## Layout

| Breakpoint | Width | Photo grid | Navigation |
|---|---|---|---|
| default | under 744px | 2 or 3 columns | Bottom tab bar |
| `tablet:` | 744px and up | 4 columns | Top bar |
| `desktop:` | 1128px and up | 6 columns | Top bar |

Content is capped at 1280px wide. Grids only change their column count between
breakpoints; rows never reflow. On phones the main action for a screen (for
example "Upload") sits in a sticky bar at the bottom, the way Airbnb's "Reserve"
button does.

## Components

In `components/ui`:

- **`Button`**: `primary` (one per screen), `secondary` (outlined), `ghost` (text only),
  `danger` (destructive, outlined). Size `md` is 48px tall for phones; `sm` is for dense desktop rows.
- **`Badge`**: pill label in `neutral`, `accent`, `success`, `warning` or `danger`.
- **`Card`**: flat white surface with a hairline border.
- **`Input`**: 56px tall, label above, error text below in `danger`.

Planned as later phases need them: photo tile and album grid, full-size viewer,
filter pills, upload queue row with progress, bottom tab bar, empty and error states.

## Not in v1

- **Dark mode.** The source system is light only, and photos are judged best on white. Tokens are named by role so a dark set can be added later without touching components.
