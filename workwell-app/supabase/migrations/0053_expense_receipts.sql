-- A receipt on an expense claim.
--
-- HR has been approving claims on an amount and a sentence. A claim with
-- nothing behind it is not auditable, and "Equipment, ₱12,000, Other" is
-- exactly the shape of the thing an approver needs to see the paper for.
--
-- The file lives in a private bucket, following the avatars precedent
-- (0038) rather than inventing a second one. What differs is who may read
-- it: an avatar is private-plane and owner-only, a receipt is work-plane —
-- the claimant and HR of their own org, precisely the audience the
-- expenses table's own RLS already grants. The policies below mirror that
-- table rather than restating it in a new shape.
--
-- Object path is `<person_id>/<expense_id>`, not `<auth_uid>/<...>`:
-- person_id is what work.expenses is keyed on and what identity.same_org()
-- takes, so the policies can join straight to the claim instead of first
-- resolving an auth uid back to a person. One file per claim, so the path
-- needs no other uniqueness.

alter table work.expenses
  add column receipt_path text;

-- Appended at the end of the view's column list, so create or replace is
-- enough here — it refuses a column inserted in the middle (that reads as
-- renaming every column after it), which is why 0038 had to drop first.
create or replace view public.expenses
  with (security_invoker = true)
  as select id, person_id, category, amount, spent_on, note, status,
            decided_by, decided_at, created_at, receipt_path
       from work.expenses;

-- A receipt is a photo of paper or a PDF. 5MB covers a phone camera shot
-- without inviting someone to attach a video of their lunch.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Every policy below reaches the claim the same way. Compared as text
-- rather than casting the path to uuid: a malformed object name would make
-- the cast throw mid-policy, and a policy that errors is a policy that
-- denies everything including the rows it should have allowed.
--
-- The claimant, and HR of their org. Identical in effect to expenses_read
-- on the table itself, because a receipt is not more or less private than
-- the claim it belongs to.
create policy receipt_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from work.expenses e
       where e.person_id::text = (storage.foldername(name))[1]
         and e.id::text = storage.filename(name)
         and (
           e.person_id = identity.current_person_id()
           or (identity.is_hr() and identity.same_org(e.person_id))
         )
    )
  );

-- You may attach a receipt to your own claim, and only while it is still
-- undecided. The claim is created first and the file is named for it, so
-- there is always a row to check against — an upload naming a claim that
-- does not exist has nothing to be a receipt for.
create policy receipt_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and exists (
      select 1 from work.expenses e
       where e.person_id::text = (storage.foldername(name))[1]
         and e.id::text = storage.filename(name)
         and e.person_id = identity.current_person_id()
         and e.status = 'Submitted'
    )
  );

-- Replacing and removing stop at the decision, which is the whole point of
-- keeping the file: HR approved against a particular receipt, and a
-- receipt that can be swapped afterwards proves nothing about what was
-- approved. Before the decision it is still a draft of a claim and a
-- blurry photo should be replaceable.
create policy receipt_overwrite on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from work.expenses e
       where e.person_id::text = (storage.foldername(name))[1]
         and e.id::text = storage.filename(name)
         and e.person_id = identity.current_person_id()
         and e.status = 'Submitted'
    )
  )
  with check (
    bucket_id = 'receipts'
    and exists (
      select 1 from work.expenses e
       where e.person_id::text = (storage.foldername(name))[1]
         and e.id::text = storage.filename(name)
         and e.person_id = identity.current_person_id()
         and e.status = 'Submitted'
    )
  );

create policy receipt_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from work.expenses e
       where e.person_id::text = (storage.foldername(name))[1]
         and e.id::text = storage.filename(name)
         and e.person_id = identity.current_person_id()
         and e.status = 'Submitted'
    )
  );

-- No grants needed here: 0033 already gave `authenticated` usage on the
-- work schema and select on work.expenses. Worth saying out loud that the
-- subqueries above lean on that table's own RLS rather than bypassing it —
-- a claim you cannot select is a claim these cannot find either, so this is
-- not a way to probe for other people's claim ids.

-- PostgREST caches the schema it exposes, and adding a column to a view is
-- invisible to it until it is told. Without this the app asks for
-- receipt_path and is told the column does not exist, which is true only of
-- the cache and not of the database.
notify pgrst, 'reload schema';
