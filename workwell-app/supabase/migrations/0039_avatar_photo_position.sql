-- Where the photo sits inside the circle.
--
-- Cover-cropping a photo to a circle guesses the interesting part is the
-- middle, which is wrong often enough — off-centre faces, group photos,
-- the tall portrait that put the reported bug's photo pattern in reach in
-- the first place. This is that guess made adjustable: a percentage pair
-- matching CSS object-position's own convention (50/50 is centred, the
-- default before anyone touches it), read by every surface that draws the
-- photo — sidebar, profile card, and the room figure alike.

alter table private.profile
  add column avatar_offset_x numeric not null default 50
              check (avatar_offset_x between 0 and 100),
  add column avatar_offset_y numeric not null default 50
              check (avatar_offset_y between 0 and 100);

drop view public.profile;

create view public.profile with (security_invoker = true) as
  select person_id, preferred_name, avatar_initials, avatar_colour, avatar_path,
         avatar_offset_x, avatar_offset_y, greeting
    from private.profile;

grant select, insert, update on public.profile to authenticated;
