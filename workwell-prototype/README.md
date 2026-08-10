# WorkWell

Built from `WorkWell_HiFi_Design_Plan.md`, grounded in `WorkWell_Revised_v2.txt`
(the two-plane, no-scores revision — **not** the earlier `WorkWell` draft, whose
Burnout Risk Score the plan explicitly forbids) and cross-checked against
`WorkWell_Product_Requirements_Document.docx`.

## Running it

Open `index.html` in a browser. No build step, no dependencies, no server.

Plain HTML/CSS/JS with classic scripts — ES modules are blocked over `file://`,
so everything hangs off a small `window.WW` namespace instead. Nunito loads from
Google Fonts when online and falls back to a rounded system stack offline.

## The office is the interface

`index.html` is a top-down office, not a menu. It is the whole navigation
surface, rendered once in `room.js` and reused twice: full size as the home
screen, and inside the nav overlay on every other screen.

**Arriving.** The room starts dark and inert — every object is
`pointer-events: none` until you sign in. Only the front door responds, and it
pulses to say so. Clicking it opens the account chooser; picking an account
swings both door leaves open, lights the room, walks your avatar in, and pops
the check-in bubble.

**The floor plan is the privacy model, and it cuts both ways.**

*As an employee*, the organisation dashboard is behind a badge-locked
meeting-room door you genuinely cannot open — the spot renders faded,
`aria-disabled`, with no `data-go`, and locked in the list view too.

*As an employer*, you get the meeting room and nothing else. The employee floor
is not drawn as furniture you can't use — it is drawn as a **sealed area**,
because an HR leader has no business seeing whose desk is whose. Per PRD §8, an
HR Leader has "access to anonymous organisational insights only".

## Four planes

Adding an HR system of record does not soften the wall — it needs a plane of
its own, because employment data and wellbeing data are different categories.

| Plane | Holds | Data file | Who |
|---|---|---|---|
| `private` | wellbeing — mood, trends, boundaries, nudges | `private-data.js` | employee, only ever |
| `work` | own employment record — leave, payslips, profile | `work-data.js` | employee (own row only) |
| `hr` | the directory — everyone's job, leave, reviews | `hr-data.js` | HR |
| `org` | anonymous cohort aggregates, N≥8 | `data.js` | HR |

An HR manager legitimately sees that Celine has 10 days of leave left. They
never see how her week felt.

**Two layers, because a UI guard is not a data guarantee.** `app.js` blanks the
page for the wrong plane — but a `<script>` tag still runs, so blanking alone
would leave the other plane's data sitting in that browser. Each dataset
therefore refuses to populate for the wrong account:

- Opening `trends.html` as HR → blocked screen **and** `WW.privateData` is
  `undefined`.
- Opening `hr-people.html` as an employee → blocked screen **and** `WW.hr` is
  `undefined`.

Self-service is a separate file from the directory for the same reason: opening
My Leave must not download everyone else's balances.

> These checks are client-side, which is right for a prototype and wrong for
> production. In a real deployment the API refuses the request and this is the
> second line, not the only one.

**The page guard.** `app.js` checks the page's plane against the account before
anything renders:

- An employer opening `trends.html`, `check-in.html`, `boundary.html` (etc.)
  gets a block screen. Page scripts find no hooks, so no chart, scale or feed
  is ever populated.
- An employee opening `org-diagnostics.html` gets the same treatment.
- Neither account is offered a link into the other plane — the check-in bubble
  is removed from the document for employers, not merely faded, since an
  `opacity: 0` link is still keyboard-focusable.
- `components.html` is exempt via `data-access="any"`; it is documentation,
  not a product screen.

Verified: an employer has **zero** reachable links to private-plane pages, and
blocked pages render zero data.

| Object | Goes to |
|---|---|
| Your desk | `trends.html` |
| Journal | `check-in.html` |
| Water cooler | `nudges.html` |
| The clock | `boundary.html` |
| The sofa | `recognition.html` |
| Your shelf | `workspace.html` |
| Meeting room | `org-diagnostics.html` — HR only |

**Sign-in is for show.** Nothing authenticates. Signing in records a display
name and role in `localStorage` so the room knows which doors you may open.

> Do not wire this to a real backend as-is. It is a visual mock, not an auth
> implementation, and has none of the protections a real sign-in needs.

## Navigation: no sidebar

The sidebar is gone. Every screen carries a floating **The office** button that
opens the room as a dialog; the brand mark in the topbar returns home, and the
account menu moved into the topbar.

A picture cannot be the only way to navigate, so the room always ships beside a
plain **List** view — on the home screen as a view toggle, and inside the nav
overlay as a disclosure. Every object is a focusable button with a real label,
and labels are always visible rather than hover-only, so touch and keyboard
users are not guessing.

**On phones the list is the default.** Scaled to a 390px screen the plan's
labels come out ~13px tall with tap targets far under 44px, so the room stops
being usable and the list is simply better. The room stays one tap away. The
list respects the same gate as the room: before sign-in its items are inert,
with a **Sign in to come in** button — otherwise the list would be a way around
the front door.

**Onboarding is reachable from the room.** The Journal points at
`onboarding.html` and reads "Set up" until setup is completed once
(`ww.onboarded`), then switches to `check-in.html` / "Check in". The arrival
bubble follows the same rule.

## The room knows what time it is

The wall clock shows the real time, and the room has three phases:

| Phase | When | Room |
|---|---|---|
| Morning | until noon | Warm light across the floor |
| Day | noon → quiet hours | Normal |
| Quiet | your quiet hours | Lights out. No check-in offer |

During quiet hours the greeting becomes *"It's 9:40 pm. This can wait until
tomorrow"* and the check-in bubble is replaced by a note. **Nothing is
blocked** — every destination still works. The room just stops asking. The
clock keeps its accent so it stays legible: it's the thing you'd come here to
change.

The window comes from the Boundary Assistant, persisted as `ww.quietFrom` /
`ww.quietTo` (minutes past midnight), defaulting to 6:30 pm – 8:30 am.

Add `?time=21:40` to any office URL to preview a given hour — otherwise the
night state is only visible at night.

> Deliberately **not** built: other people's avatars in the room. Showing who
> is at their desk is presence surveillance, which is the thing this product
> refuses to do. If the room ever needs to feel populated, it has to be
> anonymous and aggregate — never *who*.

## Seeing the designed states

Every screen still implements populated / empty / loading / error / not-enough-data,
but the state switcher is hidden so the app presents as finished. Reveal it with:

- `?state=<name>` on any screen URL — e.g. `trends.html?state=empty`
- **Ctrl+Alt+S** to toggle the switcher on the current screen

`components.html` is the design-system reference. It is deliberately not linked
from the app navigation.

## Screens

| Screen | File | Plane | States |
|---|---|---|---|
| The office (home) | `index.html` | — | locked · signing in · open |
| Personal Trend Reflection | `trends.html` | Private | populated · not-enough-data · empty · loading · error |
| Mood Check — onboarding | `onboarding.html` | Private | 5-step flow |
| Mood Check — daily | `check-in.html` | Private | flow · already-checked-in · loading · error |
| Adaptive Health Nudges | `nudges.html` | Private | populated · all-off · muted · loading · error |
| Boundary Assistant | `boundary.html` | Private | populated · not-set-up · loading · error |
| Recognition & Connection | `recognition.html` | Private | populated · empty · request-sent · loading · error |
| Adaptive Workspace | `workspace.html` | Private | settings (controls are live) |
| Structural Load Diagnostics | `org-diagnostics.html` | Org | populated · all-locked · not-enough-data · loading · error |
| Design system | `components.html` | Both | reference |

## The three open items from the plan, resolved

**1. Accent hex values — and a change to the plan's suggestion.**
The plan proposed sage green. Validated as a pair against terracotta, sage
`#3F6B4F` **failed**: colour-vision separation ΔE 6.0 under protanopia (floor 8)
and below the chroma floor (reads grey). Since plane identity — "can my employer
see this?" — is the most consequential distinction in the product, the private
accent was re-stepped teal-ward.

| Plane | Light | Dark |
|---|---|---|
| Private | `#0A8560` | `#1BAB91` |
| Org | `#BA4A1D` | `#DE7145` |

Both modes pass all six checks: lightness band, chroma floor, CVD separation
(ΔE 9.0 light / 11.0 dark), normal-vision separation (23.9 / 24.7), and ≥3:1
contrast on their surface. Accent-as-text uses a darker step (`--accent-text`)
to clear 4.5:1 on the page background.

**Consequence:** plane identity is never carried by colour alone. Every screen
also shows a plane badge with a distinct icon (padlock vs building) and an
explicit sentence — in the sidebar on desktop, a strip under the topbar on mobile.

**2. Mobile navigation — bottom tab bar,** plus the office button. Four tabs for
the highest-frequency destinations; settings-shaped screens and sign-out sit
behind a "More" sheet. Breakpoint is 860px.

**3. Component inventory — `components.html`.** Extracted after the screens were
drafted rather than guessed up front, as the plan intended. Now presented as the
design-system reference.

## How the design rules are enforced

1. **No individual data on the org plane.** There is no employee list to reach —
   the org data model contains only cohorts.
2. **Never render a group under 8.** Enforced once, in `data.js` `orgCohorts()`,
   which recomputes contributing headcount for the active filter and sets
   `locked`. Every renderer receives the same list and must not read metric
   fields from a locked cohort. Because the threshold is applied to the
   *filtered* result, narrowing the date range genuinely re-locks groups —
   at "Last 7 days" only one of fourteen survives. Suppressed groups are
   **named** rather than silently dropped, so the gap can't be read as a signal.
3. **No scores, rankings, or risk labels.** No composite index anywhere. Deltas
   render in neutral ink with an arrow — never red-bad/green-good, which would
   be a verdict on a person. Status colours exist only for technical failures.
4. **Plain-language trends.** Insight cards name the factor that changed, the
   window it changed over, and one suggested action — per PRD §5.1's own example
   and §6 Step 4. Tied to the person's own baseline, never a cohort norm.
5. **Boundary Assistant is never employer-facing.** Stated on the screen itself.

## Charts

Every chart is single-series or a single-hue sequential ramp — the data's job is
magnitude and change over time, never identity, so the categorical palette is
deliberately never reached for. 2px lines, 8px markers, 4px rounded bar ends, a
2px gap between adjacent bars, recessive grid. All ship a hover layer and a
`View as table` equivalent. The employee's own typical range renders as a quiet
band behind the line, so "is this unusual for me?" is answerable without a score.

## Copy

Deliberately terse. The PRD's target users include people with ADHD, autism,
anxiety and notification overload, so a wall of explanatory text is the opposite
of an accessibility feature — the first draft had roughly
twice the word count and was worse for it.

The privacy claim is the one thing that must be stated everywhere and must not
shout: it uses progressive disclosure. One line by default, full detail behind
a **What this means** toggle. A promise repeated at paragraph length on every
screen stops being read.

## Completion feedback

Single-shot actions confirm inline. `WW.confirmAction(host, message)` replaces
the element holding the action — usually the whole button row, so a spent
choice never sits beside a live one — with a `role="status"` panel: a check
mark that draws in, then the message. Focus follows the panel when the button
that was clicked had it.

Wired on: send a leave request (validates the dates and inserts a Pending row),
release a held message or the whole queue, the three recognition sends, and the
data export.

Nothing is transmitted or persisted — there is no backend. The confirmations
are written as product copy rather than as disclaimers, because no rendered
text in this app breaks the fourth wall.

## Accessibility

WCAG AA floor throughout, plus the four toggles the PRD's target users need —
all live, all persisted, all on `workspace.html`:

- **Theme** — system / light / dark
- **Contrast** — normal / high
- **Motion** — system / full / reduced (stops the skeleton shimmer too)
- **Notification density** — compact / comfortable / spacious

Also: skip link, visible focus rings, 44px minimum targets, `role="switch"` with
`aria-checked` on every toggle, labelled form controls, live regions on the
check-in slider and the org filter (the re-lock is announced, not just shown),
and a table view for every chart.

## Verified

Across all 10 pages: no horizontal overflow at 1440 / 1280 / 900 / 768 / 390 /
360px; exactly one `h1` and no heading-level jumps per page; no control without
an accessible name; no unlabelled input; every state switcher cycles cleanly and
stays hidden by default; no "prototype" wording in any rendered text; sign-out
present and reachable on every screen at both desktop and mobile; correct accent
per plane in both themes.

Org suppression checked across six filter combinations — no group under 8 ever
renders, the roll-up never includes a locked cohort, and force-revealing the
populated panel under a fully-suppressed filter yields zero metric values.

Sign-in checked: all three steps render, the chooser routes each account to its
plane, show/hide password works, back returns to the chooser, and the account
menu opens, closes on Escape, and signs out.

## Files

```
index.html (sign-in) · trends.html · onboarding.html · check-in.html · nudges.html
boundary.html · recognition.html · workspace.html · org-diagnostics.html
components.html (design-system reference)

assets/css/  tokens.css      design tokens, both planes, both themes, a11y prefs
             signin.css      sign-in screen
             base.css        reset, typography, focus, motion
             layout.css      app shell, sidebar, tab bar, breakpoints
             components.css  the component library

assets/js/   icons.js        inline SVG icon set
             page-signin.js  sign-in screen (mock, no real auth)
             data.js         mock data + the suppression rule
             charts.js       SVG chart renderers
             app.js          shell, nav, preferences, state switcher,
                             WW.confirmAction
             flow.js         multi-step flow engine
             page-*.js       per-screen wiring
```
