-- Expenses, made real. Same shape as leave_requests (0011): a person
-- raises their own claim, HR of their own org decides it, and nobody
-- decides their own claim -- there is no self-serve update policy for the
-- requester once it exists. Work-plane, plain grants, RLS narrows each
-- verb, exactly the leave_requests precedent rather than the RPC-only
-- convention used for the private-plane attendance tables (this is
-- employer-visible by design, not something narrowed to a single
-- consent-gated exception).

create table work.expenses (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references identity.people(id) on delete cascade,
  category   text not null
             check (category in ('Travel','Meals','Equipment','Training','Other')),
  amount     numeric(12,2) not null check (amount > 0),
  spent_on   date not null,
  note       text,
  status     text not null default 'Submitted'
             check (status in ('Submitted','Approved','Reimbursed','Declined')),
  decided_by uuid references identity.people(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index expenses_person_idx on work.expenses (person_id, created_at desc);
create index expenses_status_idx on work.expenses (status);

alter table work.expenses enable row level security;

create policy expenses_read on work.expenses
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (identity.is_hr() and identity.same_org(person_id))
  );

-- You may raise a claim for yourself only.
create policy expenses_insert on work.expenses
  for insert to authenticated
  with check (person_id = identity.current_person_id());

-- Only HR decides, and only for their own org -- approving your own claim
-- is exactly the thing an approval flow exists to prevent.
create policy expenses_decide on work.expenses
  for update to authenticated
  using (identity.is_hr() and identity.same_org(person_id))
  with check (identity.is_hr() and identity.same_org(person_id));

-- Supabase's default privileges grant more than the explicit list below
-- regardless of what's asked for (see 0028) -- close what should stay
-- shut (delete and friends -- nobody deletes a claim, it gets declined)
-- explicitly rather than relying on the grant list alone.
revoke delete, truncate, references, trigger
  on work.expenses from authenticated, anon;
grant select, insert, update on work.expenses to authenticated;

create view public.expenses
  with (security_invoker = true)
  as select id, person_id, category, amount, spent_on, note, status,
            decided_by, decided_at, created_at
       from work.expenses;

revoke delete, truncate, references, trigger
  on public.expenses from authenticated, anon;
grant select, insert, update on public.expenses to authenticated;
