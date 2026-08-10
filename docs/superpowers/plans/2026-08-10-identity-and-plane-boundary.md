# Identity and Plane Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up WorkWell v0's identity layer — orgs, people, roles, magic-link sign-in — with the boundary between wellbeing data and employment data enforced by Postgres schemas, roles, and RLS rather than by UI code.

**Architecture:** A Next.js App Router app in `workwell-app/` talks to Supabase project `tqasdiigmgzohohlrand` as the signed-in user, so RLS applies to every read. Four schemas (`identity`, `private`, `work`, `org_agg`) partition the planes; `private` and `org_agg` are created closed in this slice and stay closed until later slices add tables. Two `security definer` resolvers translate a JWT into a person and an org, and every policy routes through them.

**Tech Stack:** Next.js 15 (App Router, TypeScript), `@supabase/ssr`, `@supabase/supabase-js`, Postgres 17.6 on Supabase, `pgtap` for database tests.

**Spec:** `docs/superpowers/specs/2026-08-10-identity-and-plane-boundary-design.md`

## Global Constraints

- **Every RLS policy uses `(select auth.uid())`, never bare `auth.uid()`.** Supabase's benchmark measures 179ms vs 9ms for this change.
- **Every `security definer` function sets `search_path = ''`** and schema-qualifies every object reference.
- **Policies on `identity.*` call a resolver function; they never inline a read of the table they protect.** Inlining recurses at query time.
- **`service_role` never appears in application code or in any env var the Next.js runtime can read.** Migrations and tests only.
- **Every table created gets `enable row level security` plus at least one policy** in the same migration.
- **Any view over a plane declares `with (security_invoker = true)`.**
- **Migration files are the source of truth.** Every schema change is a numbered file in `workwell-app/supabase/migrations/`, applied through the Supabase MCP `apply_migration` tool using the filename (minus `.sql`) as the migration name.

**One reconciliation with the spec.** The spec names the request-path role `app_request`. On Supabase that role already exists and is called `authenticated` — it is what PostgREST and the client libraries assume, and inventing a parallel role would mean rebuilding the JWT plumbing for no gain. This plan uses `authenticated` everywhere the spec says `app_request`; they are the same thing. `app_aggregator` is genuinely new and is created in Task 3.

## Environment Constraints

This machine has **Node 24.15.0 and npm 11.13.0, but no Docker and no `psql`.**

That rules out `supabase start`, `supabase db reset`, and `supabase test db`, all of which need a local Docker stack. Consequences baked into every task below:

- **Migrations** are applied with the Supabase MCP tool `apply_migration`, not the CLI.
- **Database tests** are run with the MCP tool `execute_sql`, not `supabase test db`.
- **There is one Supabase project and it is empty**, so this slice treats it as the development database. Before real users exist, a separate production project is required. That is a v1 task and is out of scope here.
- **CI is deliberately not configured in this slice.** Running these tests in GitHub Actions needs either a Docker service container with an `auth` schema shim or a hosted branch database, and both are decisions with cost or complexity attached. Task 10 leaves the tests runnable by one command so wiring CI later is mechanical.

## Simulating a signed-in user in SQL

Several tasks need to run a query *as if* a particular user were signed in. Supabase's `auth.uid()` reads the request JWT claims from a GUC, so this works without any HTTP request:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
-- queries here see auth.uid() = that uuid, with RLS applied
reset role;
```

Always inside a transaction, always `set local`, always `reset role` afterwards.

## File Structure

| File | Responsibility |
|---|---|
| `workwell-app/` | The Next.js application. Nothing outside it changes. |
| `workwell-app/supabase/migrations/0001_schemas_and_roles.sql` | Four schemas, two Postgres roles, grant baseline |
| `workwell-app/supabase/migrations/0002_identity_tables.sql` | `orgs`, `people`, `person_roles`, indexes |
| `workwell-app/supabase/migrations/0003_resolvers.sql` | `current_person_id()`, `current_org_id()` |
| `workwell-app/supabase/migrations/0004_identity_rls.sql` | RLS enable + three read policies |
| `workwell-app/supabase/migrations/0005_signin_trigger.sql` | Links `auth.users` to `identity.people` on first sign-in |
| `workwell-app/supabase/migrations/0006_seed_demo_org.sql` | One org, two people, three role rows |
| `workwell-app/supabase/tests/*.sql` | pgtap suites, one file per concern |
| `workwell-app/src/lib/supabase/client.ts` | Browser client |
| `workwell-app/src/lib/supabase/server.ts` | Server client with `getAll`/`setAll` cookies |
| `workwell-app/src/middleware.ts` | Session refresh on every request |
| `workwell-app/src/app/sign-in/page.tsx` | Magic-link request form |
| `workwell-app/src/app/auth/callback/route.ts` | Exchanges the code for a session |
| `workwell-app/src/app/page.tsx` | Signed-in landing; proves person + org + roles resolve |

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create: `workwell-app/` (whole tree, via generator)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: a dev server on port 3000; `workwell-app/src/app/page.tsx` as the app entry

- [ ] **Step 1: Confirm you are on the working branch**

```bash
git branch --show-current
```

Expected: `v0-identity`. If not, run `git switch v0-identity`. Never scaffold on `main` — `main` builds the live prototype.

- [ ] **Step 2: Generate the app**

```bash
npx --yes create-next-app@latest workwell-app --typescript --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm
```

Answer no to Turbopack if prompted. Tailwind is off deliberately: the prototype's design system is hand-written CSS tokens that port over in slice B, and Tailwind would fight it.

- [ ] **Step 3: Start the dev server and confirm it renders**

Use the preview tooling rather than a raw shell, so the browser is attached:

Create `.claude/launch.json` entry (merge into the existing `configurations` array, keep the `workwell` entry):

```json
{
  "name": "workwell-app",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev", "--prefix", "workwell-app"],
  "port": 3000
}
```

Then `preview_start` with `{name: "workwell-app"}` and `read_page`.
Expected: the Next.js starter page renders, and `read_console_messages` shows no errors.

- [ ] **Step 4: Confirm secrets cannot be committed**

`create-next-app` writes a `.gitignore` inside `workwell-app/` that already covers `.env*`. Verify:

```bash
cd workwell-app && git check-ignore -v .env.local
```

Expected: a line naming `.gitignore` and the `.env*` pattern. If it prints nothing, the file is NOT ignored — add `.env*` to `workwell-app/.gitignore` before continuing.

- [ ] **Step 5: Commit**

```bash
git add workwell-app .claude/launch.json
git commit -m "Scaffold the v0 Next.js app"
```

---

### Task 2: Establish the database test loop

**Files:**
- Create: `workwell-app/supabase/tests/00_harness.sql`

**Interfaces:**
- Consumes: nothing
- Produces: the pgtap extension in schema `extensions`; the run-a-test-file convention every later task uses

- [ ] **Step 1: Write a test that must fail**

Create `workwell-app/supabase/tests/00_harness.sql`:

```sql
begin;
select plan(1);
select has_schema('identity', 'the identity schema exists');
select * from finish();
rollback;
```

- [ ] **Step 2: Run it and watch it fail for the right reason**

Run the file's contents through the Supabase MCP tool `execute_sql`.

Expected: an error naming `plan` or `has_schema` as an unknown function — pgtap is not installed yet. If instead it reports a failing assertion, pgtap is already present; skip to Step 4.

- [ ] **Step 3: Install pgtap**

Apply as migration `0000_pgtap`:

```sql
create extension if not exists pgtap with schema extensions;
```

- [ ] **Step 4: Run the test again**

Run `00_harness.sql` through `execute_sql`.

Expected: one row, `not ok 1 - the identity schema exists`. The harness now works and the assertion fails honestly — the schema genuinely does not exist yet. Task 3 makes it pass.

- [ ] **Step 5: Commit**

```bash
git add workwell-app/supabase/tests/00_harness.sql
git commit -m "Add the pgtap harness"
```

---

### Task 3: Schemas, roles, and the closed boundary

**Files:**
- Create: `workwell-app/supabase/migrations/0001_schemas_and_roles.sql`
- Create: `workwell-app/supabase/tests/01_schemas_and_roles.sql`

**Interfaces:**
- Consumes: pgtap from Task 2
- Produces: schemas `identity`, `private`, `work`, `org_agg`; roles `app_aggregator`; grant baseline that later tasks extend

- [ ] **Step 1: Write the failing test**

Create `workwell-app/supabase/tests/01_schemas_and_roles.sql`:

```sql
begin;
select plan(8);

select has_schema('identity',  'identity schema exists');
select has_schema('private',   'private schema exists');
select has_schema('work',      'work schema exists');
select has_schema('org_agg',   'org_agg schema exists');

-- The boundary: the public API roles cannot even enter the private schema.
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated has no usage on private'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon has no usage on private'
);

select has_role('app_aggregator', 'app_aggregator role exists');

-- nologin is what makes it unreachable: there is no password to present.
select is(
  (select rolcanlogin from pg_roles where rolname = 'app_aggregator'),
  false,
  'app_aggregator cannot log in'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and verify it fails**

Run through `execute_sql`.
Expected: 8 assertions, all `not ok`.

- [ ] **Step 3: Write the migration**

Create `workwell-app/supabase/migrations/0001_schemas_and_roles.sql`:

```sql
-- Four schemas, one per plane. private and org_agg are created closed:
-- no grants to any API role. Later slices add tables inside an already
-- shut boundary rather than opening one.
create schema if not exists identity;
create schema if not exists private;
create schema if not exists work;
create schema if not exists org_agg;

-- The aggregation job's role. nologin means no password exists, so no
-- client can authenticate as it; slice E's pg_cron job reaches its
-- privileges through a security definer function this role owns.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_aggregator') then
    create role app_aggregator nologin;
  end if;
end $$;

-- identity is readable by signed-in users because authorization joins
-- through it. Row visibility is still decided by RLS in migration 0004.
grant usage on schema identity to authenticated;

-- private, work and org_agg get no grants here. Each later slice grants
-- exactly what its tables need, to exactly the roles that need them.
revoke all on schema private from public, anon, authenticated;
revoke all on schema org_agg from public, anon, authenticated;
revoke all on schema work    from public, anon, authenticated;
```

Apply through `apply_migration` with name `0001_schemas_and_roles`.

- [ ] **Step 4: Run the test and verify it passes**

Run `01_schemas_and_roles.sql` through `execute_sql`.
Expected: 8 assertions, all `ok`.

- [ ] **Step 5: Re-run the harness**

Run `00_harness.sql`.
Expected: `ok 1 - the identity schema exists`. The Task 2 test now passes for real.

- [ ] **Step 6: Commit**

```bash
git add workwell-app/supabase/migrations/0001_schemas_and_roles.sql workwell-app/supabase/tests/01_schemas_and_roles.sql
git commit -m "Create the four plane schemas and the aggregator role"
```

---

### Task 4: Identity tables

**Files:**
- Create: `workwell-app/supabase/migrations/0002_identity_tables.sql`
- Create: `workwell-app/supabase/tests/02_identity_tables.sql`

**Interfaces:**
- Consumes: schemas from Task 3
- Produces: `identity.orgs(id, name, created_at)`, `identity.people(id, org_id, auth_user_id, email, full_name, status, created_at)`, `identity.person_roles(person_id, role)`

- [ ] **Step 1: Write the failing test**

Create `workwell-app/supabase/tests/02_identity_tables.sql`:

```sql
begin;
select plan(9);

select has_table('identity', 'orgs',         'orgs table exists');
select has_table('identity', 'people',       'people table exists');
select has_table('identity', 'person_roles', 'person_roles table exists');

select col_is_pk('identity', 'people', 'id', 'people.id is the primary key');
select col_is_fk('identity', 'people', 'org_id', 'people.org_id is a foreign key');

-- Both indexes are load-bearing, not housekeeping: current_person_id()
-- runs on essentially every query and joins through both.
select has_index('identity', 'people', 'people_auth_user_id_idx',
                 'auth_user_id is indexed');
select has_index('identity', 'people', 'people_org_email_key',
                 'email is unique per org, case-insensitively');
select has_index('identity', 'person_roles', 'person_roles_person_id_idx',
                 'person_roles.person_id is indexed');

select col_has_check('identity', 'people', 'status',
                     'status is constrained to known values');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and verify it fails**

Expected: 9 assertions, all `not ok`.

- [ ] **Step 3: Write the migration**

Create `workwell-app/supabase/migrations/0002_identity_tables.sql`:

```sql
create table identity.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table identity.people (
  id            uuid primary key default gen_random_uuid(),
  -- org_id lives only here. Every other table in the system reaches
  -- tenancy by joining through people, so a mismatch is impossible
  -- rather than merely unlikely.
  org_id        uuid not null references identity.orgs(id) on delete restrict,
  -- Null until first sign-in. People are created by invitation; open
  -- sign-up would leave "which org is this?" without a trustworthy answer.
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  email         text not null,
  full_name     text not null,
  status        text not null default 'invited'
                check (status in ('invited','active','left')),
  created_at    timestamptz not null default now()
);

-- text plus a lowercased unique index rather than citext: same guarantee,
-- no extension dependency.
create unique index people_org_email_key
  on identity.people (org_id, lower(email));

create index people_auth_user_id_idx
  on identity.people (auth_user_id);

-- A join table, not a column: HR staff are employees too and have their
-- own wellbeing. Holding 'hr' grants org_agg access, never another
-- person's private rows.
create table identity.person_roles (
  person_id  uuid not null references identity.people(id) on delete cascade,
  role       text not null check (role in ('employee','hr','admin')),
  primary key (person_id, role)
);

create index person_roles_person_id_idx
  on identity.person_roles (person_id);
```

Apply through `apply_migration` with name `0002_identity_tables`.

- [ ] **Step 4: Run the test and verify it passes**

Expected: 9 assertions, all `ok`.

- [ ] **Step 5: Verify the case-insensitive uniqueness actually bites**

Run through `execute_sql`:

```sql
begin;
insert into identity.orgs (id, name)
  values ('11111111-1111-1111-1111-111111111111', 'Test Org');
insert into identity.people (org_id, email, full_name)
  values ('11111111-1111-1111-1111-111111111111', 'a@b.example', 'Lower');
insert into identity.people (org_id, email, full_name)
  values ('11111111-1111-1111-1111-111111111111', 'A@B.EXAMPLE', 'Upper');
rollback;
```

Expected: the second insert raises `duplicate key value violates unique constraint "people_org_email_key"`. The `rollback` means nothing persists either way.

- [ ] **Step 6: Commit**

```bash
git add workwell-app/supabase/migrations/0002_identity_tables.sql workwell-app/supabase/tests/02_identity_tables.sql
git commit -m "Add the identity tables"
```

---

### Task 5: The resolvers

**Files:**
- Create: `workwell-app/supabase/migrations/0003_resolvers.sql`
- Create: `workwell-app/supabase/tests/03_resolvers.sql`

**Interfaces:**
- Consumes: `identity.people` from Task 4
- Produces: `identity.current_person_id() returns uuid`, `identity.current_org_id() returns uuid` — every policy in this system calls one of these

- [ ] **Step 1: Write the failing test**

Create `workwell-app/supabase/tests/03_resolvers.sql`:

```sql
begin;
select plan(6);

select has_function('identity', 'current_person_id', 'resolver for person exists');
select has_function('identity', 'current_org_id',    'resolver for org exists');

-- security definer is required: RLS on identity.people would otherwise
-- recurse, since a policy on people would call a function reading people.
select is(
  (select prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'identity' and p.proname = 'current_person_id'),
  true,
  'current_person_id is security definer'
);

-- A security definer function without a pinned search_path is a
-- privilege-escalation vector.
--
-- Postgres serialises `set search_path = ''` into proconfig as
-- search_path="" (a quoted empty string), not search_path=. Accept both
-- spellings with the array-overlap operator so the assertion tests the
-- property rather than one version's formatting.
select ok(
  (select proconfig from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'identity' and p.proname = 'current_person_id')
  && array['search_path=', 'search_path=""'],
  'current_person_id pins search_path to empty'
);
select ok(
  (select proconfig from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'identity' and p.proname = 'current_org_id')
  && array['search_path=', 'search_path=""'],
  'current_org_id pins search_path to empty'
);

-- stable lets Postgres evaluate once per query instead of once per row.
select is(
  (select provolatile from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'identity' and p.proname = 'current_person_id'),
  's'::"char",
  'current_person_id is stable'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and verify it fails**

Expected: 6 assertions, all `not ok` or erroring on the missing function.

- [ ] **Step 3: Write the migration**

Create `workwell-app/supabase/migrations/0003_resolvers.sql`:

```sql
-- Both resolvers are security definer so their bodies run without RLS.
-- That is what breaks the recursion a policy on identity.people would
-- otherwise cause. search_path is pinned to empty and every reference is
-- schema-qualified.
create or replace function identity.current_person_id() returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select id from identity.people
   where auth_user_id = (select auth.uid())
$$;

create or replace function identity.current_org_id() returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select org_id from identity.people
   where auth_user_id = (select auth.uid())
$$;

revoke all on function identity.current_person_id() from public;
revoke all on function identity.current_org_id()    from public;
grant execute on function identity.current_person_id() to authenticated;
grant execute on function identity.current_org_id()    to authenticated;
```

Apply through `apply_migration` with name `0003_resolvers`.

- [ ] **Step 4: Run the test and verify it passes**

Expected: 6 assertions, all `ok`.

- [ ] **Step 5: Commit**

```bash
git add workwell-app/supabase/migrations/0003_resolvers.sql workwell-app/supabase/tests/03_resolvers.sql
git commit -m "Add the person and org resolvers"
```

---

### Task 6: RLS and policies

**Files:**
- Create: `workwell-app/supabase/migrations/0004_identity_rls.sql`
- Create: `workwell-app/supabase/tests/04_identity_rls.sql`

**Interfaces:**
- Consumes: resolvers from Task 5
- Produces: RLS enabled on all three identity tables, with read policies `people_read_own_org`, `roles_read_own`, `orgs_read_own`

- [ ] **Step 1: Write the failing test**

Create `workwell-app/supabase/tests/04_identity_rls.sql`:

```sql
begin;
select plan(7);

select ok(
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='identity' and c.relname='people'),
  'RLS is enabled on people'
);
select ok(
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='identity' and c.relname='person_roles'),
  'RLS is enabled on person_roles'
);
select ok(
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='identity' and c.relname='orgs'),
  'RLS is enabled on orgs'
);

select policies_are('identity', 'people',
  array['people_read_own_org'], 'people has exactly its read policy');
select policies_are('identity', 'person_roles',
  array['roles_read_own'], 'person_roles has exactly its read policy');
select policies_are('identity', 'orgs',
  array['orgs_read_own'], 'orgs has exactly its read policy');

-- Bare auth.uid() is evaluated per row. Supabase measures 179ms vs 9ms
-- against the wrapped form, so this is a correctness-of-performance rule.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'identity'
      and (qual like '%auth.uid()%' and qual not like '%( SELECT auth.uid()%')),
  0,
  'no policy calls auth.uid() unwrapped'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and verify it fails**

Expected: the three RLS assertions and the three `policies_are` assertions fail.

- [ ] **Step 3: Write the migration**

Create `workwell-app/supabase/migrations/0004_identity_rls.sql`:

```sql
alter table identity.orgs         enable row level security;
alter table identity.people       enable row level security;
alter table identity.person_roles enable row level security;

-- Each policy calls a resolver instead of inlining the lookup. Inlining
-- "select org_id from identity.people ..." inside a policy ON
-- identity.people recurses: the inner read re-triggers the same policy,
-- and it fails at query time with a stack-depth error rather than at
-- migration time.
create policy people_read_own_org on identity.people
  for select to authenticated
  using (org_id = identity.current_org_id());

create policy roles_read_own on identity.person_roles
  for select to authenticated
  using (person_id = identity.current_person_id());

create policy orgs_read_own on identity.orgs
  for select to authenticated
  using (id = identity.current_org_id());

-- Read-only for signed-in users in this slice. Invitation writes arrive
-- in slice D; the sign-in trigger writes as security definer.
grant select on identity.orgs, identity.people, identity.person_roles
  to authenticated;
```

Apply through `apply_migration` with name `0004_identity_rls`.

- [ ] **Step 4: Run the test and verify it passes**

Expected: 7 assertions, all `ok`.

- [ ] **Step 5: Prove there is no recursion, with a real query**

This is the assertion the whole task exists for. Run through `execute_sql`:

```sql
begin;
insert into identity.orgs (id, name)
  values ('22222222-2222-2222-2222-222222222222', 'Recursion Check');
insert into auth.users (id, email)
  values ('33333333-3333-3333-3333-333333333333', 'r@c.example');
insert into identity.people (org_id, auth_user_id, email, full_name, status)
  values ('22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333',
          'r@c.example', 'Recursion Check', 'active');

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
select count(*) as visible_people from identity.people;
reset role;
rollback;
```

Expected: `visible_people = 1`, returned promptly.
A `stack depth limit exceeded` error means a policy is inlining a read of its own table — go back to Step 3.

- [ ] **Step 6: Commit**

```bash
git add workwell-app/supabase/migrations/0004_identity_rls.sql workwell-app/supabase/tests/04_identity_rls.sql
git commit -m "Enable RLS on identity with resolver-based policies"
```

---

### Task 7: Link auth users to people on first sign-in

**Files:**
- Create: `workwell-app/supabase/migrations/0005_signin_trigger.sql`
- Create: `workwell-app/supabase/tests/05_signin_link.sql`

**Interfaces:**
- Consumes: `identity.people` from Task 4
- Produces: trigger `on_auth_user_created` on `auth.users`, calling `identity.link_auth_user()`

- [ ] **Step 1: Write the failing test**

Create `workwell-app/supabase/tests/05_signin_link.sql`:

```sql
begin;
select plan(5);

insert into identity.orgs (id, name)
  values ('44444444-4444-4444-4444-444444444444', 'Link Test');
insert into identity.people (org_id, email, full_name, status)
  values ('44444444-4444-4444-4444-444444444444',
          'Invited.Person@Link.example', 'Invited Person', 'invited');

-- Case differs from the stored address on purpose: people type their
-- email however they like.
insert into auth.users (id, email)
  values ('55555555-5555-5555-5555-555555555555', 'invited.person@link.example');

select is(
  (select auth_user_id from identity.people
    where lower(email) = 'invited.person@link.example'),
  '55555555-5555-5555-5555-555555555555'::uuid,
  'the invited person is linked to the new auth user'
);
select is(
  (select status from identity.people
    where lower(email) = 'invited.person@link.example'),
  'active',
  'status flips from invited to active'
);

-- Someone with no invitation gets an account that resolves to nobody.
insert into auth.users (id, email)
  values ('66666666-6666-6666-6666-666666666666', 'stranger@nowhere.example');
select is(
  (select count(*)::int from identity.people
    where auth_user_id = '66666666-6666-6666-6666-666666666666'),
  0,
  'an uninvited sign-in links to no person'
);

-- The same address invited by two orgs is a legal shape, because email is
-- unique per org rather than globally. Linking both rows would violate the
-- unique constraint on auth_user_id and abort the auth.users insert that
-- fired the trigger, leaving that person unable to sign in at all.
insert into identity.orgs (id, name) values
  ('77777777-7777-7777-7777-777777777777', 'Org One'),
  ('88888888-8888-8888-8888-888888888888', 'Org Two');
insert into identity.people (org_id, email, full_name, status) values
  ('77777777-7777-7777-7777-777777777777', 'both@two.example', 'Both One', 'invited'),
  ('88888888-8888-8888-8888-888888888888', 'BOTH@two.example', 'Both Two', 'invited');

select lives_ok(
  $$ insert into auth.users (id, email)
       values ('99999999-9999-9999-9999-999999999999', 'both@two.example') $$,
  'an ambiguous invitation still allows the account to be created'
);
select is(
  (select count(*)::int from identity.people
    where auth_user_id = '99999999-9999-9999-9999-999999999999'),
  0,
  'an ambiguous invitation links to no person'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and verify it fails**

Expected: assertions 1 and 2 fail (`auth_user_id` still null, status still `invited`). Assertions 3, 4 and 5 pass already, because with no trigger nothing links anyone and nothing can crash. They guard behaviours the trigger must not break.

- [ ] **Step 3: Write the migration**

Create `workwell-app/supabase/migrations/0005_signin_trigger.sql`:

```sql
-- Runs as definer because it writes to identity.people, which grants no
-- write policy to authenticated. Matching is on lowercased email, since
-- people type their address however they like.
--
-- The count guard is load-bearing. Email is unique per org, not globally,
-- so one address can be invited by two orgs. A bare UPDATE would match
-- both rows, and the second assignment would violate the unique
-- constraint on auth_user_id — aborting the auth.users insert that fired
-- this trigger, so that person could never sign in at all.
--
-- Link only when the match is unambiguous. Otherwise link nobody: the
-- account resolves to no person and sees nothing, which is already the
-- designed outcome for an uninvited sign-in. Picking one org by timing
-- would silently place someone in an employer's tenant by coincidence,
-- which this product must never do.
create or replace function identity.link_auth_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  matches int;
begin
  select count(*) into matches
    from identity.people
   where auth_user_id is null
     and lower(email) = lower(new.email);

  if matches = 1 then
    update identity.people
       set auth_user_id = new.id,
           status       = 'active'
     where auth_user_id is null
       and lower(email) = lower(new.email);
  end if;

  return new;
end;
$$;

revoke all on function identity.link_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function identity.link_auth_user();
```

Apply through `apply_migration` with name `0005_signin_trigger`.

- [ ] **Step 4: Run the test and verify it passes**

Expected: 6 assertions, all `ok`.

- [ ] **Step 5: Commit**

```bash
git add workwell-app/supabase/migrations/0005_signin_trigger.sql workwell-app/supabase/tests/05_signin_link.sql
git commit -m "Link auth users to invited people on first sign-in"
```

---

### Task 8: Seed the demo org

**Files:**
- Create: `workwell-app/supabase/migrations/0006_seed_demo_org.sql`
- Create: `workwell-app/supabase/tests/06_seed.sql`

**Interfaces:**
- Consumes: tables from Task 4, roles constraint from Task 4
- Produces: org `Northwind`; people `Celine Nolasco` (employee) and `Wilson Dayrit` (employee + hr), both `status='invited'` until they sign in

- [ ] **Step 1: Write the failing test**

Create `workwell-app/supabase/tests/06_seed.sql`:

```sql
begin;
select plan(4);

select is((select count(*)::int from identity.orgs where name = 'Northwind'),
          1, 'the Northwind org exists');
select is((select count(*)::int from identity.people
            where org_id = (select id from identity.orgs where name='Northwind')),
          2, 'Northwind has two seeded people');

-- Wilson holds both roles. This is the departure from the prototype:
-- HR staff are employees and have their own wellbeing.
select set_eq(
  $$ select role from identity.person_roles pr
       join identity.people p on p.id = pr.person_id
      where lower(p.email) = 'wilson.dayrit@northwind.example' $$,
  array['employee','hr'],
  'Wilson is both an employee and HR'
);
select set_eq(
  $$ select role from identity.person_roles pr
       join identity.people p on p.id = pr.person_id
      where lower(p.email) = 'celine.nolasco@northwind.example' $$,
  array['employee'],
  'Celine is an employee only'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and verify it fails**

Expected: 4 assertions, all `not ok`.

- [ ] **Step 3: Write the migration**

Create `workwell-app/supabase/migrations/0006_seed_demo_org.sql`:

```sql
insert into identity.orgs (id, name)
values ('a0000000-0000-0000-0000-000000000001', 'Northwind')
on conflict (id) do nothing;

insert into identity.people (id, org_id, email, full_name, status)
values
  ('b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'celine.nolasco@northwind.example', 'Celine Nolasco', 'invited'),
  ('b0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'wilson.dayrit@northwind.example', 'Wilson Dayrit', 'invited')
on conflict (id) do nothing;

insert into identity.person_roles (person_id, role)
values
  ('b0000000-0000-0000-0000-000000000001', 'employee'),
  ('b0000000-0000-0000-0000-000000000002', 'employee'),
  ('b0000000-0000-0000-0000-000000000002', 'hr')
on conflict do nothing;
```

Apply through `apply_migration` with name `0006_seed_demo_org`.

- [ ] **Step 4: Run the test and verify it passes**

Expected: 4 assertions, all `ok`.

- [ ] **Step 5: Commit**

```bash
git add workwell-app/supabase/migrations/0006_seed_demo_org.sql workwell-app/supabase/tests/06_seed.sql
git commit -m "Seed the Northwind demo org"
```

---

### Task 9: Magic-link sign-in

**Files:**
- Create: `workwell-app/.env.local` (not committed)
- Create: `workwell-app/src/lib/supabase/client.ts`
- Create: `workwell-app/src/lib/supabase/server.ts`
- Create: `workwell-app/src/middleware.ts`
- Create: `workwell-app/src/app/sign-in/page.tsx`
- Create: `workwell-app/src/app/auth/callback/route.ts`
- Modify: `workwell-app/src/app/page.tsx`

**Interfaces:**
- Consumes: `identity.current_person_id()` indirectly, via RLS on `identity.people`
- Produces: `createClient()` from `@/lib/supabase/client` (browser) and `createClient()` from `@/lib/supabase/server` (async, server-only)

- [ ] **Step 1: Install the packages**

```bash
npm install --prefix workwell-app @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Write the environment file**

Fetch the publishable key with the Supabase MCP tool `get_publishable_keys` for project `tqasdiigmgzohohlrand`, then create `workwell-app/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://tqasdiigmgzohohlrand.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<the publishable key>
```

Only these two. The publishable key is designed to be public and is protected by RLS. **Do not add the service role key** — it bypasses RLS entirely, and anything in this file is reachable by the running app.

- [ ] **Step 3: Write the browser client**

Create `workwell-app/src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

- [ ] **Step 4: Write the server client**

Create `workwell-app/src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 5: Write the middleware**

Create `workwell-app/src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the auth token. Do not remove: without it, server components
  // see an expired session and every page looks signed out.
  await supabase.auth.getClaims()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Write the sign-in page**

Create `workwell-app/src/app/sign-in/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) return <p role="status">Check your email for a sign-in link.</p>

  return (
    <form onSubmit={send}>
      <label htmlFor="email">Work email</label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Send me a link</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 7: Write the callback route**

Create `workwell-app/src/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(origin)
  }

  return NextResponse.redirect(`${origin}/sign-in?error=link`)
}
```

- [ ] **Step 8: Write the landing page**

Replace `workwell-app/src/app/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  if (!claims) return <Link href="/sign-in">Sign in</Link>

  // Reads go through the public views, which carry security_invoker so the
  // identity policies still apply. An account with no people row sees
  // nothing, which is the intended failure mode.
  const { data: people } = await supabase
    .from('people')
    .select('id, full_name, status')

  const { data: roles } = await supabase
    .from('person_roles')
    .select('role')

  return (
    <main>
      <h1>Signed in</h1>
      <p>Your roles: {roles?.map((r) => r.role).join(', ') || 'none'}</p>
      <h2>People visible to you</h2>
      <ul>
        {people?.map((p) => (
          <li key={p.id}>
            {p.full_name} — {p.status}
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 9: Add the public read views**

PostgREST serves only the schemas on its exposed list, which by default is
`public` alone. Rather than adding `identity` to that list — which would put
the raw tables on the API surface and needs a dashboard setting no migration
can reach — expose two thin views instead. `identity` stays off the API
entirely, and `private`, `work` and `org_agg` never go near it.

Create `workwell-app/supabase/migrations/0007_public_read_views.sql`:

```sql
-- The app reads through these, never the identity tables directly.
--
-- security_invoker is load-bearing. A Postgres view is security definer by
-- default, so without it these views would run as their owner and return
-- every row in the table — a hole straight through the RLS this plan just
-- built. With it, the underlying policies apply to the querying user.
create view public.people
  with (security_invoker = true)
  as select id, org_id, full_name, status
       from identity.people;

create view public.person_roles
  with (security_invoker = true)
  as select person_id, role
       from identity.person_roles;

grant select on public.people, public.person_roles to authenticated;
```

Apply through `apply_migration` with name `0007_public_read_views`.

Then verify the views did not become a bypass. Run through `execute_sql`:

```sql
begin;
insert into identity.orgs (id, name)
  values ('12121212-1212-1212-1212-121212121212', 'View Check');
insert into auth.users (id, email)
  values ('13131313-1313-1313-1313-131313131313', 'v@c.example');
insert into identity.people (org_id, auth_user_id, email, full_name, status)
  values ('12121212-1212-1212-1212-121212121212',
          '13131313-1313-1313-1313-131313131313',
          'v@c.example', 'View Check', 'active');

set local role authenticated;
set local request.jwt.claims = '{"sub":"13131313-1313-1313-1313-131313131313"}';
select count(*) as visible_through_view from public.people;
reset role;
rollback;
```

Expected: `visible_through_view = 1` — that user's own org only, not the
seeded Northwind rows. Any higher number means `security_invoker` did not
take effect and the view is bypassing RLS.

- [ ] **Step 10: Verify as far as an inbox allows**

The seeded addresses use `@northwind.example`. `.example` is a reserved
domain that cannot receive mail, so the magic-link round trip **cannot** be
completed here. Verify everything up to the inbox, and do not pretend the
rest.

Restart the dev server, then `preview_start` with `{name: "workwell-app"}`.

1. Navigate to `/`. Expected: a "Sign in" link, because there is no session.
2. Navigate to `/sign-in`. Expected: the email field and submit button render.
3. Enter `wilson.dayrit@northwind.example` and submit. Expected: the
   "Check your email for a sign-in link" status appears and **no error** is
   shown. That proves the browser client is constructed, the environment
   variables resolve, and Supabase accepted the request — which is the part
   the app is responsible for.
4. `read_console_messages` and `preview_logs` at error level. Expected: no
   errors.

Record explicitly in your report that the round trip was not completed and
why. Completing it needs a person row whose email is a real deliverable
address; that is a decision for the human partner, not something to invent.

The database half of sign-in is already proven independently by
`05_signin_link.sql`, which drives the trigger directly.

- [ ] **Step 11: Commit**

```bash
git add workwell-app/src workwell-app/package.json workwell-app/package-lock.json
git commit -m "Add magic-link sign-in"
```

---

### Task 10: Prove the boundary holds

**Files:**
- Create: `workwell-app/supabase/tests/10_boundary.sql`
- Create: `workwell-app/supabase/tests/README.md`

**Interfaces:**
- Consumes: everything from Tasks 3 through 8
- Produces: the executable form of the guarantee in the spec

- [ ] **Step 1: Write the boundary suite**

Create `workwell-app/supabase/tests/10_boundary.sql`:

```sql
begin;
select plan(6);

-- Two orgs, one person each, to prove tenancy holds.
insert into identity.orgs (id, name) values
  ('c0000000-0000-0000-0000-00000000000a', 'Org A'),
  ('c0000000-0000-0000-0000-00000000000b', 'Org B');

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-00000000000a', 'a@orga.example'),
  ('d0000000-0000-0000-0000-00000000000b', 'b@orgb.example'),
  ('d0000000-0000-0000-0000-0000000000ff', 'orphan@nowhere.example');

insert into identity.people (org_id, auth_user_id, email, full_name, status) values
  ('c0000000-0000-0000-0000-00000000000a',
   'd0000000-0000-0000-0000-00000000000a', 'a@orga.example', 'Person A', 'active'),
  ('c0000000-0000-0000-0000-00000000000b',
   'd0000000-0000-0000-0000-00000000000b', 'b@orgb.example', 'Person B', 'active');

-- Cross-org isolation.
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-00000000000a"}';

select is((select count(*)::int from identity.people), 1,
          'a person sees only their own org');
select is((select count(*)::int from identity.orgs), 1,
          'a person sees only their own org row');

-- The orphan: an auth user with no invitation.
set local request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-0000000000ff"}';

select is(identity.current_person_id(), null,
          'an uninvited account resolves to no person');
select is((select count(*)::int from identity.people), 0,
          'an uninvited account sees no people');

reset role;

-- The private schema stays shut, checked at two levels because they bite
-- at different times.
--
-- Schema level: meaningful right now. Without usage on the schema, no API
-- role can reach anything inside it regardless of table grants.
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage')
  and not has_schema_privilege('anon', 'private', 'usage'),
  'no API role can enter the private schema'
);

-- Table level: vacuous while private is empty, because role_table_grants
-- only lists real tables. It is here so that the moment slice B adds its
-- first table, a stray grant on it fails this suite rather than shipping.
select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'private'
      and grantee in ('anon','authenticated')),
  0,
  'no API role holds any grant inside the private schema'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and verify every assertion passes**

Expected: 6 assertions, all `ok`.

- [ ] **Step 3: Prove the tests can actually fail**

A test suite that has never failed proves nothing. Temporarily widen a policy:

```sql
alter policy people_read_own_org on identity.people using (true);
```

Re-run `10_boundary.sql`.
Expected: `a person sees only their own org` and `an uninvited account sees no people` both report `not ok`.

- [ ] **Step 4: Restore the policy and confirm green**

```sql
alter policy people_read_own_org on identity.people
  using (org_id = identity.current_org_id());
```

Re-run `10_boundary.sql`.
Expected: 6 assertions, all `ok`.

- [ ] **Step 5: Confirm no service-role key reached the app**

The spec requires that `service_role` never appear in application code or in
anything the Next.js runtime can read. Check both the source and the build
output:

```bash
grep -rn "service_role\|SERVICE_ROLE" workwell-app/src workwell-app/.env.local 2>&1 | grep -v "^grep:"
```

Expected: no matches. Any hit is a release blocker, not a warning — that key
bypasses RLS entirely and would make every policy in this plan decorative.

- [ ] **Step 6: Write the runbook**

Create `workwell-app/supabase/tests/README.md`:

```markdown
# Database tests

pgtap suites, one file per concern. Run each file's contents through the
Supabase MCP `execute_sql` tool against the project database.

Order matters only in that `06_seed.sql` expects `0006_seed_demo_org.sql`
to have been applied. Every file wraps itself in `begin ... rollback`, so
running them leaves no trace.

There is no local Docker on this machine, so `supabase test db` is not
available. When CI is added, it needs either a Postgres service container
with an `auth` schema shim providing `auth.uid()` and `auth.users`, or a
hosted branch database.

`10_boundary.sql` is the executable form of the guarantee in
`docs/superpowers/specs/2026-08-10-identity-and-plane-boundary-design.md`.
If it is ever deleted or skipped, that guarantee reverts to a paragraph
nobody checks.

One assertion from that spec is deliberately absent: "signed in as HR,
selecting from any private table returns zero rows". There are no private
tables yet. It belongs in slice B's first task, alongside the first table
that goes behind the boundary.
```

- [ ] **Step 7: Commit**

```bash
git add workwell-app/supabase/tests
git commit -m "Prove the plane boundary with pgtap"
```

---

### Task 11: Preview deployment

**Files:**
- Create: `workwell-app/vercel.json`

**Interfaces:**
- Consumes: the app from Task 9
- Produces: a Vercel preview URL for branch `v0-identity`, separate from the prototype's project

- [ ] **Step 1: Confirm the build passes locally first**

```bash
npm run build --prefix workwell-app
```

Expected: a successful build. Fix any type errors before deploying — Vercel runs the same build and fails the same way, only slower.

- [ ] **Step 2: Add the Vercel config**

Create `workwell-app/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" }
      ]
    }
  ]
}
```

- [ ] **Step 3: Create a second Vercel project**

Do **not** point the existing `workwell` project at this app. That project's production domain serves the prototype from `main`, and repointing it would take the prototype down.

Create a new project in the Vercel dashboard from the same GitHub repo, with **Root Directory** set to `workwell-app`, and its production branch set to `v0-identity`.

- [ ] **Step 4: Add the environment variables**

In the new project's settings, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the same values as `.env.local`. Nothing else.

- [ ] **Step 5: Add the deployed origin to Supabase's redirect allow-list**

Auth → URL Configuration → Redirect URLs: add `https://<new-project>.vercel.app/auth/callback`. Without it, the magic link redirects to the site URL and sign-in fails on the deployed app while working locally.

- [ ] **Step 6: Push and verify**

```bash
git push -u origin v0-identity
```

Then confirm the deployment reached `READY` with the Vercel MCP `list_deployments`, and sign in on the deployed URL exactly as in Task 9 Step 10.

Expected: the same two-person list and `employee, hr` roles.

- [ ] **Step 7: Commit**

```bash
git add workwell-app/vercel.json
git commit -m "Deploy the v0 app to its own Vercel project"
```

---

## Known limitation: the seeded accounts cannot sign in

Supabase Auth rejects `@northwind.example` with `400 email_address_invalid` —
GoTrue refuses the reserved `.example` TLD. Both seeded people therefore cannot
request a magic link, on any environment. This is not a bug in the code; the
sign-in path is proven at the database level by `05_signin_link.sql`, which
drives the trigger directly.

The seed keeps `.example` addresses deliberately: they are realistic directory
data and they commit no real inbox to git history.

To sign in for real, add one person with a deliverable address **directly to
the database**, not to a migration:

```sql
insert into identity.people (org_id, email, full_name, status)
values ('a0000000-0000-0000-0000-000000000001',
        'you@example-real-domain.com', 'Your Name', 'invited');

insert into identity.person_roles (person_id, role)
select id, 'employee' from identity.people
 where lower(email) = 'you@example-real-domain.com';
```

Then request a magic link for that address. The trigger links it on first
sign-in. Keeping it out of the migration keeps a personal address out of the
repository permanently.

Slice D's invitation flow is where real addresses enter the system properly.

## Done when

- All eleven tasks are checked off.
- Every pgtap file passes, and `10_boundary.sql` has been observed failing when a policy is widened.
- Signing in as Wilson on the deployed preview lists two people and both roles.
- `main` is untouched and `workwell-one.vercel.app` still serves the prototype.
