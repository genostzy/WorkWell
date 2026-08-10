# Identity and the plane boundary

Date: 2026-08-10
Status: approved, not yet implemented

## What this is

WorkWell v0 — the real product on Supabase, as opposed to `workwell-prototype/`,
which is a mock with no backend and client-side guards.

The full product is six slices. This spec covers **slice A only**.

| Slice | Scope |
|---|---|
| **A** | **Identity, orgs, roles, and the boundary between planes** |
| B | Private plane — check-in write path, personal trends |
| C | Work plane — own employment record, leave self-service |
| D | HR plane — directory, approvals, performance, onboarding |
| E | Org plane — aggregation with the 8-person rule |
| F | Nudges, boundaries, recognition |

All six are in scope for v0. They are specced and built in order because a
single document covering authentication through aggregation could not be
implemented or reviewed honestly.

## Decisions taken before this spec

| Decision | Choice |
|---|---|
| Stack | Next.js App Router on Vercel |
| Database | Supabase project `tqasdiigmgzohohlrand`, Postgres 17.6 |
| Sign-in | Supabase Auth magic link (email OTP) |
| Plane isolation | Separate schemas plus restricted Postgres roles |
| Aggregation | `pg_cron`, in-database |
| Location | `workwell-app/` beside `workwell-prototype/`, on its own branch |
| Tenancy | Multi-tenant from the first migration |

`main` continues to deploy the prototype. Nothing in this slice touches it.

## The guarantee, stated precisely

PRD §6 requires "separate storage and access layers — the org service holds no
credential that can read private data."

Taken literally, one Supabase project cannot satisfy this: it is one Postgres,
and `service_role` bypasses RLS entirely. Rather than claim compliance we do
not have, v0 commits to a narrower statement that is both defensible and
testable:

> No credential reachable from an HTTP request can read another person's
> private-plane data. The single credential that can read it runs only inside
> the database, on a schedule, and emits nothing but aggregates of eight or
> more people.

This is weaker than §6 as written. The difference is deliberate and recorded
here so nobody later mistakes the implementation for full compliance. Closing
the gap means a second Supabase project, which is a v1 decision, not a v0 one.

`service_role` is used for migrations and operational tasks only. It must never
appear in application code or in any environment variable the Next.js runtime
can read. This is a review rule, and the reason `app_request` exists.

## Schemas

| Schema | Holds | Reachable by |
|---|---|---|
| `identity` | orgs, people, role assignments | every application role |
| `private` | wellbeing — check-ins, nudge state, boundaries | the owning person only |
| `work` | employment records, leave | the owning person; HR of their org |
| `org_agg` | cohort aggregates, N≥8 already applied | HR of that org |

All four schemas are created in slice A; only `identity` gets tables. `private`,
`work` and `org_agg` start empty with no grants, so later slices add tables
inside an already-closed boundary rather than opening one.

Schemas are not added to PostgREST's exposed list. The API surface is whatever
the Next.js server chooses to expose, not whatever exists in the database.

## Roles

Two roles beyond Supabase's built-ins.

**`app_request`** — the request path. Carries the signed-in user's JWT; RLS
applies to everything it touches. Granted `usage` on all four schemas and
table-level rights only where a policy also permits access. This is the only
credential the web application holds.

**`app_aggregator`** — `nologin`, owns the aggregation function introduced in
slice E. Reads `private` in bulk, writes `org_agg`.

`nologin` is what makes it unreachable: no password exists, so no client can
authenticate as it. The `pg_cron` job invokes a `security definer` function
owned by `app_aggregator`, which is how the privilege is exercised without ever
being a credential. `app_request` is never granted the role, so no request path
can `set role` into it. Created in slice A so the grant model is complete before
there is any private data to protect.

## Tables

```sql
create table identity.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table identity.people (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references identity.orgs(id) on delete restrict,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  email         text not null,
  full_name     text not null,
  status        text not null default 'invited'
                check (status in ('invited','active','left')),
  created_at    timestamptz not null default now()
);

create unique index people_org_email_key
  on identity.people (org_id, lower(email));

create index people_auth_user_id_idx
  on identity.people (auth_user_id);

create table identity.person_roles (
  person_id  uuid not null references identity.people(id) on delete cascade,
  role       text not null check (role in ('employee','hr','admin')),
  primary key (person_id, role)
);

create index person_roles_person_id_idx
  on identity.person_roles (person_id);
```

Notes on choices that are not obvious:

**Roles are a join table, not a column.** HR staff are employees and have their
own wellbeing. The prototype models HR as a separate species that gets the
meeting room and nothing else; a real schema should not inherit that
simplification. Holding `hr` grants access to `org_agg`, never to another
person's `private` rows.

**`auth_user_id` is nullable.** People are created by invitation and linked to
an auth user on first sign-in. Open sign-up would leave "which org is this
person in?" without a trustworthy answer. Org membership is assigned, never
self-declared.

**`org_id` lives only on `people`.** Every other table reaches tenancy by
joining through it, so a tenancy mismatch is impossible rather than unlikely.

**`text` with a lowercased unique index, not `citext`.** Same guarantee without
an extension dependency.

**`on delete restrict` for the org reference.** Deleting an org with people in
it should fail loudly rather than cascade through wellbeing data.

## The resolvers

```sql
create function identity.current_person_id() returns uuid
  language sql stable security definer
  set search_path = ''
  as $$ select id from identity.people
        where auth_user_id = (select auth.uid()) $$;

create function identity.current_org_id() returns uuid
  language sql stable security definer
  set search_path = ''
  as $$ select org_id from identity.people
        where auth_user_id = (select auth.uid()) $$;
```

Three properties, each load-bearing:

- **`security definer`** — RLS on `identity.people` would otherwise recurse: a
  policy calling a function that reads the table the policy is on.
- **`set search_path = ''`** — a `security definer` function without a pinned
  path is a privilege-escalation vector. All object references inside are
  schema-qualified.
- **`stable`** — lets Postgres evaluate it once per query rather than per row.

## RLS rules

Binding for this slice and every slice after it.

1. Every table gets `enable row level security` and at least one policy. A table
   with RLS on and no policy denies everything, which fails closed but silently;
   a table with RLS off is a hole. Neither is acceptable as an accident.
2. **Always `(select auth.uid())`, never bare `auth.uid()`.** Supabase's
   published benchmark measures 179ms against 9ms for this single change — a 95%
   reduction — because the subselect is evaluated once as an InitPlan instead of
   once per row.
3. Policies name the role explicitly with `to authenticated`.
4. `private` tables carry one policy shape for all four verbs:
   `person_id = identity.current_person_id()`. A read policy stricter than its
   write policy lets a person write rows they cannot then see.
5. Any view over a plane requires `with (security_invoker = true)`. Views are
   `security definer` by default in Postgres, which makes an unmarked view a
   hole straight through the boundary.

Slice A policies:

```sql
alter table identity.people enable row level security;
alter table identity.person_roles enable row level security;
alter table identity.orgs enable row level security;

-- You can see people in your own org. Directory detail is slice D's problem;
-- this is the minimum authorization needs.
create policy people_read_own_org on identity.people
  for select to authenticated
  using (org_id = identity.current_org_id());

create policy roles_read_own on identity.person_roles
  for select to authenticated
  using (person_id = identity.current_person_id());

create policy orgs_read_own on identity.orgs
  for select to authenticated
  using (id = identity.current_org_id());
```

**The policies must call the resolvers, never inline the lookup.** A policy on
`identity.people` whose `using` clause selects from `identity.people` recurses:
the inner read triggers the same policy. `security definer` is what breaks the
cycle, because the function's body runs without RLS. This is the single easiest
way to break this schema, and it fails at query time with a stack-depth error
rather than at migration time.

Writes to all three tables in slice A happen through migrations and seed data.
No write policies are granted to `authenticated`; invitation is slice D. The
sign-in trigger below writes to `identity.people` without a policy because it
runs `security definer`.

## Sign-in

1. HR creates a `people` row with `status='invited'`.
2. Supabase Auth sends a magic link to that address.
3. On first sign-in, an `auth.users` insert trigger links `auth_user_id` to the
   `people` row matching `lower(email)` within any org, and sets `status='active'`.
4. A sign-in with no matching row links nothing. That account resolves to no
   person, so `current_person_id()` returns null and every policy denies. The
   failure mode is an empty account, not an unauthorised one.

The trigger runs `security definer` with a pinned `search_path`, for the same
reasons as the resolver.

## Proof

`pgtap`, run in CI. The guarantee is only real if it is executable.

| Test | Asserts |
|---|---|
| `private` is closed | Every table in `private` has RLS enabled |
| HR sees no wellbeing | Signed in as an HR person, selecting from any `private` table returns zero rows |
| Cross-org isolation | A person in org A resolves zero rows for org B |
| Orphan sign-in | An auth user with no `people` row gets null from `current_person_id()` and zero rows everywhere |
| No `service_role` in app | Grep the `workwell-app/` build output for the key; fail if present |
| Policy hygiene | Every policy in the database uses `(select auth.uid())`, not bare |
| No recursion | Every policy on `identity.*` resolves through a helper, not an inline read of the same table |

The last two are cheap and catch the two mistakes most likely to be made under
deadline.

## Not in this slice

Check-ins, trends, leave, the directory, aggregation, nudges, boundaries,
recognition, the office interface, and any UI beyond what sign-in requires.
Porting the prototype's design system is slice B's problem.

## Risks

**The `pgtap` tests are the whole guarantee.** If they are skipped when
inconvenient, the boundary degrades to a paragraph in a README. They belong in
CI before slice B adds the first private table.

**`security definer` functions accumulate.** Each one is a small hole with a
pinned path holding it shut. Slice A has three — two resolvers and the sign-in
trigger — and that count should grow only with a stated reason.

**The stated guarantee is narrower than PRD §6.** Recorded above. It should be
re-read before anyone claims compliance in a submission or a pitch.
