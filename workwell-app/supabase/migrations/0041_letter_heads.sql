-- Letter heads was the one mock page 0037 missed. Its own comment counted
-- "9 of the 10 remaining client-only mock pages" and named warnings as the
-- deliberate exception — that accounts for 9, not 10. Letter heads was
-- simply left out, with no note deciding it should stay a mock the way
-- warnings has one. It is wired up here the same way: org-scoped reference
-- data HR authors, everyone else has no reason to see.
--
-- A template's body is plain text with {{name}} / {{title}} placeholders,
-- filled in by the client at generate time — the same two fields the old
-- hardcoded templates ever used.

create table work.letter_heads (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references identity.orgs(id) on delete cascade,
  name        text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

create index letter_heads_org_idx on work.letter_heads (org_id, name);

alter table work.letter_heads enable row level security;

create policy letter_heads_read on work.letter_heads
  for select to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

create policy letter_heads_write on work.letter_heads
  for insert to authenticated
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy letter_heads_update on work.letter_heads
  for update to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id())
  with check (identity.is_hr() and org_id = identity.current_org_id());

create policy letter_heads_delete on work.letter_heads
  for delete to authenticated
  using (identity.is_hr() and org_id = identity.current_org_id());

revoke truncate, references, trigger
  on work.letter_heads from authenticated, anon;
grant select, insert, update, delete on work.letter_heads to authenticated;

create view public.letter_heads
  with (security_invoker = true)
  as select id, org_id, name, body, created_at
       from work.letter_heads;

revoke truncate, references, trigger
  on public.letter_heads from authenticated, anon;
grant select, insert, update, delete on public.letter_heads to authenticated;

-- Same three templates the mock page always showed, so nothing regresses
-- for the demo org — now rows HR can edit or remove instead of constants.
insert into work.letter_heads (org_id, name, body)
values
  ('a0000000-0000-0000-0000-000000000001',
   'Employment certificate',
   'This is to certify that {{name}} is a current employee of WorkWell, holding the position of {{title}}, in good standing as of today.'),
  ('a0000000-0000-0000-0000-000000000001',
   'Offer letter',
   E'Dear {{name}},\n\nWe are pleased to offer you the position of {{title}} at WorkWell. Full terms will follow under separate cover.'),
  ('a0000000-0000-0000-0000-000000000001',
   'Certificate of employment (final)',
   'This certifies that {{name}} was employed by WorkWell as {{title}}. We wish them well in their next role.')
on conflict (org_id, name) do nothing;
