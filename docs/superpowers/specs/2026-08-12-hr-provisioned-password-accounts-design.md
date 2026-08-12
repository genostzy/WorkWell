# HR-provisioned password accounts

2026-08-12

## Why

Access to WorkWell has always started with the person: sign in with any
email via a magic link, then ask HR to be linked to an account. That two-step
shape — auth exists before identity does — is what the sign-in trigger and
the whole `access_requests` table exist to bridge.

Wilson wants the shape reversed: HR creates the account, employee gets in
with it. No self-service, no request to review, no gap between "has an auth
user" and "has access" for the trigger machinery to bridge. What replaces
magic link is ordinary email + password, with the twist that the password
starts as something HR hands the person rather than something the person
picks — and is never allowed to stay that way.

## What comes out

- The magic-link sign-in form, and `/auth/callback`.
- `RequestAccess`, the "you're signed in but not in yet" screen it renders
  behind, and the `request_access` RPC.
- `identity.access_requests` and `decide_access_request`, along with the
  Accounts page's request queue built on them.
- The `on_auth_user_created` / `link_auth_user()` and `on_person_invited` /
  `link_invited_person()` triggers. They exist to link an `auth.users` row
  to an `identity.people` row when the two are created in either order,
  independently, by different actors — which was true when a person could
  sign in before HR ever heard of them. In the new flow HR creates both in
  one server request and sets `auth_user_id` directly; nothing is ever
  created independently again, so the triggers have no remaining case to
  handle. Leaving unused linking logic sitting on `auth.users` is exactly
  the kind of thing worth removing rather than stepping around.
- `05_signin_link.sql`, the pgtap file proving the ambiguous-email guard on
  that trigger. The guard goes with the trigger.

## What goes in

### Schema

`identity.people` gains `must_change_password boolean not null default true`.
Nothing else about the table changes — `auth_user_id` is still nullable in
principle, but every row created from here on sets it at insert time.

### Provisioning

A new `identity.provision_person(auth_user_id, full_name, job_title,
department, is_hr)` function, security definer, gated by `identity.is_hr()`
exactly like `decide_access_request` was. It is that function's body with
the `access_requests` bookkeeping cut out: insert the person (status
`'active'`, `auth_user_id` supplied rather than null), the role row, and the
employment row if title and department were both given, all in one
transaction. `must_change_password` defaults true, so nothing extra is
needed there.

A server-only Next.js route, `POST /api/hr/accounts`, does the two things
that must happen outside Postgres:

1. Confirms the caller's session belongs to HR — using the request's own
   Supabase client against `person_roles`, the same check every HR page
   already makes, not a client-supplied flag.
2. Calls Supabase's Admin API (`auth.admin.createUser`), which needs the
   service-role key. That key is a new server-only env var
   (`SUPABASE_SERVICE_ROLE_KEY`) and is never sent to the browser — it only
   ever lives inside this route handler.

The password itself is generated server-side: 10 characters drawn from a
set that excludes visually ambiguous characters (`0/O`, `1/l/I`), so it can
be read off a screen and typed back without transcription errors. It is
never stored anywhere in plaintext — Supabase hashes it into `auth.users` on
creation, and the route holds it only long enough to return it once in the
response body.

With the auth user created, the route calls `provision_person` with its id.
If that call fails, the route says so plainly rather than retrying or
rolling back the auth user — an auth user that exists but is not yet linked
to a person is the same "invited, not yet in" state the product already has
a name for, and HR can see it and retry from the Accounts screen rather than
the failure being silent.

### The Accounts screen

The request queue is replaced by a **Create account** form: name, email,
job title, department, and the same Private/HR grant choice — with the same
type-the-word confirmation — that approving a request already used. On
success, the generated password is shown once in a copyable field with a
line making clear it will not be shown again.

Every account row gains a **Reset password** action, next to the existing
Give/Remove HR access and Close/Reopen controls, following the same
confirm-by-typing pattern. It calls the same route in a mode that generates
a fresh password for an *existing* auth user and sets
`must_change_password` back to true. This is not a new mechanism bolted on
for one purpose — it is the same primitive doing double duty, for a
forgotten password and for the one-time migration below.

### First sign-in

`/sign-in` becomes an ordinary email + password form.

Middleware already runs `getClaims()` on every request. It gains one more
check: if the session is valid and `must_change_password` is true on that
person, and the path is not `/set-password` itself, redirect there. Nothing
else is reachable until it clears — the same "guard once, centrally" reasoning
that keeps the rest of the route guard out of individual pages.

`/set-password` asks for a new password twice, calls
`supabase.auth.updateUser({ password })`, and on success calls a small RPC,
`identity.clear_password_change_flag()`, security definer, which sets the
flag false for `identity.current_person_id()` and nothing else — a person
can only ever clear their own flag, and cannot set anyone else's.

### Existing accounts

The 18 people already in the organisation signed in via magic link and have
never had a password on their `auth.users` row. Turning off magic link
would lock every one of them out at the same moment.

Before that flag flips, each existing account needs a password set the same
way a newly-created one would — which is exactly what **Reset password**
does. Rather than a one-off script, this is Wilson running that same button
once per existing person from the Accounts screen before password sign-in
goes live, which means the migration path and the "forgot it" path are
proven by the same code before anyone depends on either.

## Security notes

- The service-role key's only caller is `/api/hr/accounts`, and that route's
  first line of work is verifying HR — the key itself grants far more than
  this route uses, so the verification is what keeps it scoped.
- `provision_person` and `clear_password_change_flag` are each gated at the
  database layer too (`is_hr()`, `current_person_id()`), not only by the
  route above them — the same defense-in-depth the rest of this schema
  already relies on rather than trusting a single check.
- Generated passwords are never logged. The route's error paths must be
  written to guarantee this — a caught exception that happens to include
  the request body would be as bad as printing it deliberately.

## Testing

- `05_signin_link.sql` is removed with the trigger it tests.
- A new pgtap file replaces it: `provision_person` refuses a non-HR caller;
  `clear_password_change_flag` clears only the caller's own row and cannot
  target another; a provisioned person's `auth_user_id` is set at creation,
  not left null for a trigger to fill in later.
- `10_boundary.sql`'s structural floor (RLS everywhere in a plane schema,
  every governed table carrying a policy, every public view
  `security_invoker`, no API role executing `org_agg.refresh`) is unaffected
  and should still pass unchanged.

## Out of scope

- Self-service "forgot password" — HR resets it, matching "HR decides who
  gets in" carrying through to "HR decides who gets back in."
- Any password-strength UI beyond Supabase's own minimum length check.
- Emailing the temporary password. Decided against in favour of on-screen,
  one-time display — see the brainstorm exchange in this session for the
  reasoning (no email-sending infrastructure exists yet, and adding one is
  out of proportion to this feature).
