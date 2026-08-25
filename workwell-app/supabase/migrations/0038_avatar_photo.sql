-- A photo, alongside the colour and initials the room figure already wore.
--
-- Same plane as the rest of private.profile — nobody's business but yours —
-- so the storage side has to enforce that itself, not just the table side.
-- The bucket is private (public = false) and every object lives under a
-- folder named for the uploader's own auth uid, which is what the four
-- policies below check. A public bucket would have made the URL itself the
-- only thing standing between a photo and anyone who guessed or leaked it;
-- RLS is what "only you can see this" already means everywhere else here.

alter table private.profile
  add column avatar_path text;

-- The path already carries the owner (see the storage policies below), so
-- this is only ever read back by the person who wrote it — no extra check
-- needed here beyond the table's own existing RLS.
--
-- create or replace can't insert a column in the middle of an existing
-- view's shape (it reads as renaming every column after it), so this drops
-- and recreates rather than replacing.
drop view public.profile;

create view public.profile with (security_invoker = true) as
  select person_id, preferred_name, avatar_initials, avatar_colour, avatar_path, greeting
    from private.profile;

grant select, insert, update on public.profile to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy avatar_read on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatar_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatar_overwrite on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatar_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
