# WorkWell — session handoff

Written 2026-08-31. Everything below was verified against the live
project and the repo at the time of writing, not recalled from memory.

## Where things stand

- **Repo root:** `C:\Users\Wilson\OJT\Healthy You Workspace`
- **App:** `workwell-app/` (Next.js 16 + Supabase)
- **Current branch:** `Stage4-Refine` (2 commits ahead of `main`, pushed)
- **Remotes:** `v0` = `genostzy/workwell-v0` — **all work goes here**.
  `origin` = `genostzy/workwell` is stale and has been left alone all
  session. Push with `git push v0 <branch>`.
- **Supabase project:** `oghphivmmqwqouyybwik` (WorkWell-v0)

`Stage4-Refine` currently holds:

```
0cce7d3 docs: record what the anon-subscriber failure looked like, now that it is fixed
1f59851 fix: authenticate the realtime socket before the channel joins
```

Working tree clean. Typecheck, lint (0 errors, 16 pre-existing warnings),
52 tests, and production build all pass.

## Read this before touching realtime

This cost most of a session to find, and it fails **completely
silently** — no error, no console output, the channel still reports
`SUBSCRIBED`, the screen just never updates.

**Symptom:** live updates stop working for signed-in users.

**Diagnosis — one query, and it is the ground truth:**

```sql
select entity::regclass, claims_role, claims->>'sub'
  from realtime.subscription;
```

`claims_role` is who *Realtime* believes the subscriber is. If it says
`anon` while a real user is signed in — and especially if that same
browser client's REST reads return that user's rows correctly — the
socket never got the user's token. RLS then filters out every row it was
supposed to deliver, because `current_person_id()` is null for anon.

**What caused it here:** the project had migrated to asymmetric **ES256**
JWT signing keys, which Realtime's postgres_changes path did not verify;
it fell back to `anon`. Fixed by rotating back to the **legacy HS256 JWT
secret** in Dashboard → Settings → JWT Keys.

Two things that bite when changing that key:
- Every existing session stops validating. Users must sign out and back
  in to get a token signed by the current key.
- ~5 minute throttle on key state changes.

**Standing risk:** the project is on the legacy HS256 secret now. That
works, but it is the older system. If it is ever migrated forward to
signing keys again, postgres_changes breaks the same silent way. The
durable fix is **Broadcast from Database** (`realtime.broadcast_changes()`
from a trigger + RLS on `realtime.messages`) instead of Postgres Changes
— roughly an hour of work, never started. Worth noting the broadcast
replication slot is already alive on this project.

## Realtime wiring as built

Shared helper: `src/lib/supabase/realtime.ts` (`watchTable`). It sets the
socket's auth **before** the channel joins, rather than relying on
supabase-js's own `setAuth()` on SIGNED_IN / TOKEN_REFRESHED — those fire
on auth *transitions* and lose the race against a page loaded with a
session already in cookies.

It also drops unauthorized payloads. Realtime does not stay silent for a
row you may not see; it delivers `{new:{}, old:{}, errors:['Error 401
...']}`, which unguarded reads as a real row with every field
`undefined`.

Consumers:
- `src/components/notifications.tsx` — bell + toasts
- `src/app/tasks/tasks-client.tsx` — employee's two task lists
- `src/app/tasks/assign-tasks-client.tsx` — HR's assignment table
- `src/app/tasks/task-comments.tsx` — open comment threads

Tables published for realtime (migration `0064_realtime.sql`), all with
`replica identity full` so DELETE carries enough of the row for RLS:
`private.tasks`, `work.assigned_tasks`, `work.notifications`,
`work.task_comments`.

## Accounts

Three accounts can actually sign in:

| Name | Email | Role |
|---|---|---|
| Big Boss | `bigbossoma@workwell.com` | hr + employee |
| Celine Nolasco | `celine.nolasco@workwell.com` | employee |
| Test Employee | `test.employee@workwell.com` | employee |

Passwords are **deliberately not recorded in this repo**. A plaintext
fixture password leaked into `.next` build artifacts earlier this
session and had to be purged; do not reintroduce one. HR can reset any
password from the HR → Accounts screen.

**There cannot be a second HR account.** `identity.enforce_single_hr()`
(migration 0026) is a trigger that rejects a second `hr` row per org
outright. Big Boss is the HR side of every test.

The other ~47 people are directory fixtures with `auth_user_id` null —
they hold employment records and can be assigned work, but nobody can
sign in as them.

## How testing was done, and the constraint on it

**Passwords are never typed into the sign-in form.** That held all
session and should keep holding.

What was done instead, and is fine to repeat: sign the *test fixture*
account in **programmatically** from a throwaway page under
`src/app/sign-in/<name>/` — anything under `/sign-in` is public per
`src/proxy.ts` — then navigate to the real app page and observe the real
components. Delete the throwaway afterwards, **and check `.next` for
build artifacts and sourcemaps of it**, which is where the credential
leak survived a `src/`-only grep.

The HR side of a test can be done with SQL through the Supabase MCP
(service role) rather than a second browser session.

Browser-pane gotchas that produced two wrong conclusions before being
caught:
- `javascript_tool` appears to run in an **isolated world**. Page-set
  `window.__x` globals are not visible to it. Instrument with
  `console.log` and read via `read_console_messages`, which does cross.
- Timers are **throttled** when the pane is not compositing (~1/s
  instead of the requested rate), so anything measuring duration there
  is meaningless.

## Verified working

- Task assignment notifies the assignee (`task_assigned` was missing from
  the `notifications_kind_check` constraint; fixed in `0063`)
- Notification bell updates live; toast fires on arrival with correct
  title/body — confirmed end to end with a real signed-in session after
  the JWT fix
- All six org departments clear the under-8 cohort suppression
  (`suppressed_cohorts` = 0)
- 50 people, 49 employment records

## Open / not started

1. **Broadcast from Database migration** — see the standing risk above.
   The durable answer to the JWT/realtime coupling.
2. **Toast auto-dismiss timing unverified.** `TOAST_MS` is 6000. The
   toast appearing and later disappearing is confirmed; its actual dwell
   time was never measurable because of the timer throttling above.
   Needs a human to eyeball it.
3. **Notification kinds with no producer:** `access_approved`,
   `access_declined`, `offboarding_updated` exist in the constraint but
   nothing in the app ever inserts them. Only `task_assigned` and
   `complaint_updated` currently appear in the table.
4. **`/shifts` has no `ROUTE_META` entry** — renders with a blank topbar
   title and falls back to the private-plane accent on a work-plane
   screen. One-line fix, never applied.
5. **Recognition visibility** — the "Their team" / "Everyone" control was
   removed because RLS only ever admitted sender and recipient. The
   `visibility` column remains for if a real consent step and a feed are
   ever built.
6. **Seven fully-merged local branches** could be deleted.

## Conventions worth keeping

- Migrations are written out, never generated with `random()`, so a rerun
  produces the same database. Seeded check-ins derive from a fixed
  per-person baseline plus fixed jitter arrays.
- DDL changes need `notify pgrst, 'reload schema'` or PostgREST keeps
  serving the old schema and the app is told columns do not exist.
- Dry-run destructive SQL in a transaction and `rollback` before applying
  it for real. Verify afterwards too.
- Three-plane model (`private` / `work` / `org`) is enforced by RLS, not
  by hiding UI. `ROUTE_META` in `src/lib/route-meta.ts` maps route →
  plane.
