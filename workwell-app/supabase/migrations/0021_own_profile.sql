-- Your own profile: how WorkWell presents itself to you.
--
-- The locker already showed the employment record, which HR holds and you
-- cannot change. That is one half of a profile and the half that is not
-- yours. This is the other half — the part you set, about your own view of
-- the product — and it lives on the private plane for the same reason
-- everything else there does: it is nobody's business but yours.
--
-- What is deliberately NOT here: pronouns. They exist for other people to
-- use, and there is no colleague-facing surface in the product yet — the
-- recognition feed names nobody. A pronouns field on the private plane
-- would be a field that goes nowhere, which is worse than not asking.

create table private.profile (
  person_id       uuid primary key references identity.people(id) on delete cascade,

  -- What the office calls you. Not the employment record's name: that one
  -- is HR's and has to match the contract. This one is yours.
  preferred_name  text check (preferred_name is null or length(trim(preferred_name)) between 1 and 40),

  -- The figure standing in your room. Initials override the derived ones,
  -- because a name is not always two words and not always in this order.
  avatar_initials text check (avatar_initials is null or length(trim(avatar_initials)) between 1 and 3),
  avatar_colour   text not null default 'accent'
                  check (avatar_colour in ('accent','clay','indigo','plum','moss')),

  -- Some people want to be greeted; some find it grating on a product about
  -- workload. 'plain' keeps the clock and drops the salutation.
  greeting        text not null default 'warm'
                  check (greeting in ('warm','plain')),

  updated_at      timestamptz not null default now()
);

alter table private.profile enable row level security;

-- The ordinary shape: yours and nobody else's, for every verb.
create policy profile_own on private.profile
  for all to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

grant select, insert, update on private.profile to authenticated;

create view public.profile with (security_invoker = true) as
  select person_id, preferred_name, avatar_initials, avatar_colour, greeting
    from private.profile;

grant select, insert, update on public.profile to authenticated;
