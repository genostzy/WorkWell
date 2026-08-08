# Bento layout system and completion feedback

Date: 2026-08-08
Status: approved, not yet implemented

## Origin

Four design directions were proposed for the WorkWell prototype:

1. Bento grid layouts — complex dashboards as clean rectangular modules
2. Modern minimalism — generous whitespace, less data fatigue
3. Soft corporate tech — clean sans-serif, calming blues and greens
4. Micro-animations — gentle feedback for completed tasks

An audit of the 16 pages found two of the four already satisfied and two with
real gaps. This spec covers the gaps.

## Audit outcome

**Soft corporate tech — pass, with one deliberate deviation.** Nunito
throughout, private plane on `#0A8560`, shadows tuned soft. The org plane stays
`#BA4A1D` rather than moving to blue: warm-vs-cool is the fastest signal that
the user has crossed into employer context, the hexes carry recorded CVD ΔE
values, and blue is already committed as `--focus-ring`. "Calming" is scoped to
the private plane, where the employee actually spends time.

**Minimalism / whitespace — pass.** A 4→64px spacing scale is in use, content
is capped at 1180px, and no page was found crowded.

**Bento — gap.** Layout today is `.grid--2/3/4` plus `.grid--sidebar-right`:
equal columns, uniform modules, no way to express emphasis.

**Micro-animations — gap, larger than it appears.** Motion tokens exist
(`--dur-fast/med/slow`, a shared `--ease`, reduced-motion gating) and are used
in 57 places. What is missing is a completion pattern for single actions.
`flow.js` ends check-in and onboarding with a confirmation screen, but there is
no equivalent for a one-shot submit, and seven submit actions are inert.

## Goals

- Make bento the single layout system, replacing `.grid--n` entirely.
- Migrate all existing call sites without changing how any page looks.
- Give `trends` and `org-diagnostics` deliberate module emphasis.
- Add one completion-feedback primitive and wire the seven dead actions to it.

## Non-goals

- No change to tokens, palette, typography, or the spacing scale.
- No change to the plane model, the data-file split, or any privacy guard.
- No redesign of pages other than the two dashboards.
- Not fixing the `components.html` HR-account crash (tracked separately as
  review issue #4), though this work does rewrite that page's grid demos.

## Design — bento layout system

### The grid

```css
.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--s-5);
  align-items: start;
}
```

Children declare a span: `.b-3`, `.b-4`, `.b-6`, `.b-8`, `.b-12`. A `.b-tall`
modifier sets `grid-row: span 2` for a module that should dominate.

`.bento--split` is a container variant for the asymmetric 8/4 pairing. It exists
because the current system collapses that pairing earlier than the others, and
the migration must preserve that (see below).

### Responsive contract

The existing breakpoints are 1080px and 860px, and current behaviour differs by
helper: `.grid--4` and `.grid--sidebar-right` collapse at 1080px, while
`.grid--2` and `.grid--3` hold until 860px. A span-only system cannot reproduce
both, because `b-4` would need to collapse inside a former sidebar-right row and
hold inside a former three-up row. Hence the container variant.

| Viewport | `.b-3` | `.b-4` | `.b-6` | `.b-8` | inside `.bento--split` |
|---|---|---|---|---|---|
| > 1080px | 3 | 4 | 6 | 8 | 8 + 4 |
| ≤ 1080px | 6 | 4 | 6 | 12 | 12 + 12 |
| ≤ 860px | 12 | 12 | 12 | 12 | 12 + 12 |

This reproduces today's behaviour exactly at every breakpoint.

### Migration mapping

All 46 call sites across 15 pages move mechanically — 22 `grid--2`, 8 `grid--3`,
5 `grid--4`, 11 `grid--sidebar-right`:

| Today | Becomes |
|---|---|
| `grid grid--2` | `bento` + two `b-6` |
| `grid grid--3` | `bento` + three `b-4` |
| `grid grid--4` | `bento` + four `b-3` |
| `grid grid--sidebar-right` | `bento bento--split` + `b-8` and `b-4` |

`.grid`, `.grid--2`, `.grid--3`, `.grid--4` and `.grid--sidebar-right` are then
deleted from `layout.css`. Nothing may reference them afterwards.

Component-level grids (`.optgrid`, `.heat`, and the `display: grid` used for
centring in avatars, icon tiles and similar) are unrelated and untouched.

### Deliberate layouts

Only after the mechanical migration, and only on two pages.

**trends.html** — "How you've been feeling" is the page's subject and currently
sits in an equal 2-up. It becomes `b-8 b-tall` at the top of the page, with
**two** of the three stat cards stacked beside it at `b-4`, one per row it
spans. The third stat card leads the next row at `b-4`, paired with a `b-8`
chart. Three stat cards beside a two-row hero would leave the third orphaned on
a row of its own with eight empty columns — the row arithmetic has to close.
Remaining charts pair off at `b-6`.

**org-diagnostics.html** — the four-up stat row stays as four `b-3` (4 × 3 = 12,
the row closes). Below it sit six chart modules — the five numbered diagnostics
plus "Distribution of weekly hours" — currently three identical 2-up pairs,
which presents them as an arbitrary sequence. They become `b-8`/`b-4`,
`b-4`/`b-8`, `b-8`/`b-4`: every row still sums to 12, but the alternation gives
the numbering a sense of weight instead of uniformity.

## Design — completion feedback

### Why inline rather than a toast

The confirmation appears where the action happened, persists instead of timing
out, and generalises the pattern `flow.js` already uses to end check-in. A toast
would introduce a second, competing completion idea and an auto-dismiss
accessibility cost.

### API

```js
WW.confirmAction(host, message)
```

`host` is the element holding the action (typically the button row). It is
replaced by a confirmed panel: an accent-tinted surface, a check mark, and the
message. The panel carries `role="status"` so assistive technology announces it.

### Motion

The check mark draws in via `stroke-dasharray` over `--dur-med` on `--ease`,
then the message fades. Under `prefers-reduced-motion: reduce` both appear
without animation, matching how the rest of the app gates motion.

New rows inserted into a table (see My Leave below) arrive with a brief settle
— a short opacity and 4px translate — rather than appearing abruptly.

### The seven actions

| Page | Action | Behaviour |
|---|---|---|
| my-leave | Send request | Validate that a type and date range are set; insert a Pending row into the leave table with the settle animation; confirm inline |
| boundary | Send now anyway | Release that one held message; confirm inline |
| boundary | Send all now | Clear the held-message queue; confirm inline |
| recognition | Send appreciation | Confirm inline, disable the form |
| recognition | Send a virtual coffee instead | Confirm inline, disable the form |
| recognition | Send privately | Confirm inline, disable the form |
| my-profile | Request a data export | Confirm inline, disable the button |

`boundary.html` has no page script today; one is added. `page-my-leave.js`,
`page-recognition.js` and `page-my-profile.js` each currently register zero
event listeners.

Nothing persists — this is a prototype with no backend, and the confirmations
say so in their wording rather than implying a request was transmitted.

## Files touched

- `assets/css/layout.css` — add `.bento`, remove `.grid--n`
- `assets/css/components.css` — the confirmed panel and its motion
- `assets/js/app.js` — `WW.confirmAction`
- `assets/js/page-my-leave.js`, `page-recognition.js`, `page-my-profile.js` — wiring
- `assets/js/page-boundary.js` — new
- 15 HTML pages — grid class migration
- `components.html` — grid demos rewritten, confirmed panel documented
- `README.md` — component list updated

## Verification

- Screenshot every migrated page before and after at 1280px, 1000px and 375px;
  the mechanical migration must show no visual difference. Any diff outside
  `trends` and `org-diagnostics` is a mapping bug.
- Grep for `grid--` across the repo; expect zero matches when done.
- Exercise all seven actions in the browser and confirm each renders the panel
  and announces it, rather than asserting from the code.
- Re-run with `prefers-reduced-motion` forced and confirm no animation plays.
- Both accounts, since the migration touches HR pages.
