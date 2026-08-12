-- Slice F: nudges, boundaries, recognition, workspace.
--
-- All on the private plane, all with the same policy shape as check_ins —
-- person_id = current_person_id() for every verb — with two deliberate
-- exceptions that are called out where they appear.

-- ---------------------------------------------------------------- Nudges

create table private.nudge_prefs (
  person_id   uuid primary key references identity.people(id) on delete cascade,
  move        boolean not null default false,
  hydrate     boolean not null default false,
  breathe     boolean not null default false,
  step_away   boolean not null default false,
  -- The cap is a product promise, not a preference: PRD F3 requires nudges
  -- be rate-limited. Stored so it is enforceable server-side rather than
  -- being a number the client chooses to respect.
  daily_cap   int not null default 4 check (daily_cap between 1 and 8),
  muted_until date,
  updated_at  timestamptz not null default now()
);

create table private.nudge_log (
  id        uuid primary key default gen_random_uuid(),
  person_id uuid not null references identity.people(id) on delete cascade,
  kind      text not null check (kind in ('move','hydrate','breathe','step_away')),
  sent_on   date not null default current_date,
  -- Recorded so the cap can be counted, never to score anyone. There is
  -- deliberately no aggregate over this column anywhere.
  action    text check (action in ('accepted','snoozed','dismissed'))
);

create index nudge_log_person_day_idx on private.nudge_log (person_id, sent_on);

-- ------------------------------------------------------------ Boundaries

create table private.boundaries (
  person_id        uuid primary key references identity.people(id) on delete cascade,
  quiet_from       time not null default '18:30',
  quiet_to         time not null default '08:30',
  quiet_days       text[] not null default array['Mon','Tue','Wed','Thu','Fri'],
  delayed_sending  boolean not null default true,
  hold_morning     boolean not null default false,
  protect_lunch    boolean not null default false,
  no_late_meetings boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table private.held_messages (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references identity.people(id) on delete cascade,
  recipient   text not null,
  deliver_at  timestamptz not null,
  released_at timestamptz,
  created_at  timestamptz not null default now()
);

create index held_messages_person_idx on private.held_messages (person_id, deliver_at);

-- ----------------------------------------------------------- Recognition

create table private.appreciations (
  id            uuid primary key default gen_random_uuid(),
  from_person   uuid not null references identity.people(id) on delete cascade,
  to_person     uuid not null references identity.people(id) on delete cascade,
  message       text not null,
  visibility    text not null default 'private'
                check (visibility in ('private','team','everyone')),
  created_at    timestamptz not null default now(),
  check (from_person <> to_person)
);

create index appreciations_to_idx   on private.appreciations (to_person, created_at desc);
create index appreciations_from_idx on private.appreciations (from_person, created_at desc);

create table private.support_requests (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references identity.people(id) on delete cascade,
  body         text not null,
  route        text not null check (route in ('hr','eap')),
  status       text not null default 'open'
               check (status in ('open','withdrawn','closed')),
  created_at   timestamptz not null default now(),
  withdrawn_at timestamptz
);

create index support_requests_person_idx on private.support_requests (person_id, created_at desc);

-- ------------------------------------------------------------- Workspace

create table private.workspace_prefs (
  person_id           uuid primary key references identity.people(id) on delete cascade,
  theme               text not null default 'system' check (theme in ('system','light','dark')),
  contrast            text not null default 'normal' check (contrast in ('normal','high')),
  motion              text not null default 'system' check (motion in ('system','full','reduced')),
  density             text not null default 'comfortable'
                      check (density in ('compact','comfortable','spacious')),
  focus_one_question  boolean not null default false,
  hide_counts         boolean not null default false,
  plain_language      boolean not null default false,
  checkin_format      text not null default 'scale'
                      check (checkin_format in ('scale','emoji','words')),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------------ RLS

alter table private.nudge_prefs      enable row level security;
alter table private.nudge_log        enable row level security;
alter table private.boundaries       enable row level security;
alter table private.held_messages    enable row level security;
alter table private.appreciations    enable row level security;
alter table private.support_requests enable row level security;
alter table private.workspace_prefs  enable row level security;

-- The ordinary shape: yours and nobody else's, for every verb.
create policy nudge_prefs_own on private.nudge_prefs
  for all to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

create policy nudge_log_own on private.nudge_log
  for all to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

create policy boundaries_own on private.boundaries
  for all to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

create policy held_messages_own on private.held_messages
  for all to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

create policy workspace_prefs_own on private.workspace_prefs
  for all to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

-- Exception one: appreciation has two ends. The recipient must be able to
-- read what was sent to them, and the sender must be able to see what they
-- sent. That is the sender's own choice to disclose, to one named person —
-- it is not a widening of the plane. HR gains nothing here.
create policy appreciations_read on private.appreciations
  for select to authenticated
  using (
    from_person = identity.current_person_id()
    or to_person = identity.current_person_id()
  );

create policy appreciations_write on private.appreciations
  for insert to authenticated
  with check (from_person = identity.current_person_id());

-- Exception two, and the more consequential one. A support request is the
-- single place where an employee deliberately opens a channel to HR. It is
-- consent, expressed per row: only requests routed to 'hr', only for HR of
-- that person's own org, and only while the request is still open. The
-- moment it is withdrawn it disappears from HR again.
--
-- Requests routed to 'eap' are never visible to HR at all.
create policy support_requests_read on private.support_requests
  for select to authenticated
  using (
    person_id = identity.current_person_id()
    or (
      route = 'hr'
      and status = 'open'
      and identity.is_hr()
      and identity.same_org(person_id)
    )
  );

create policy support_requests_write on private.support_requests
  for insert to authenticated
  with check (person_id = identity.current_person_id());

-- Only the person who raised it may withdraw it. HR cannot close someone
-- else's request out from under them.
create policy support_requests_withdraw on private.support_requests
  for update to authenticated
  using (person_id = identity.current_person_id())
  with check (person_id = identity.current_person_id());

grant select, insert, update, delete on
  private.nudge_prefs, private.nudge_log, private.boundaries,
  private.held_messages, private.workspace_prefs
  to authenticated;

grant select, insert on private.appreciations to authenticated;
grant select, insert, update on private.support_requests to authenticated;

-- ---------------------------------------------------------------- Views

create view public.nudge_prefs with (security_invoker = true) as
  select person_id, move, hydrate, breathe, step_away, daily_cap, muted_until
    from private.nudge_prefs;

create view public.boundaries with (security_invoker = true) as
  select person_id, quiet_from, quiet_to, quiet_days, delayed_sending,
         hold_morning, protect_lunch, no_late_meetings
    from private.boundaries;

create view public.held_messages with (security_invoker = true) as
  select id, person_id, recipient, deliver_at, released_at
    from private.held_messages;

create view public.appreciations with (security_invoker = true) as
  select id, from_person, to_person, message, visibility, created_at
    from private.appreciations;

create view public.support_requests with (security_invoker = true) as
  select id, person_id, body, route, status, created_at
    from private.support_requests;

create view public.workspace_prefs with (security_invoker = true) as
  select person_id, theme, contrast, motion, density, focus_one_question,
         hide_counts, plain_language, checkin_format
    from private.workspace_prefs;

grant select on public.nudge_prefs, public.boundaries, public.held_messages,
  public.appreciations, public.support_requests, public.workspace_prefs
  to authenticated;
grant insert, update, delete on public.nudge_prefs, public.boundaries,
  public.held_messages, public.workspace_prefs to authenticated;
grant insert on public.appreciations to authenticated;
grant insert, update on public.support_requests to authenticated;
