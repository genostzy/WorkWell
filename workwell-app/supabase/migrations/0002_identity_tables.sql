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
