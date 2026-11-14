-- Sapience — study features: watched progress, weak spots, adaptive quizzes, flashcards,
-- study rooms (codes, goals, peer progress) and the study calendar with its iCalendar feed.
--
-- Option lists in check constraints must match src/config/enums.ts
-- (tests/unit/enums-migrations.test.ts reads the last definition of each constraint).

-- ===========================================================================
-- lesson_progress.furthest_seconds: the furthest point actually played (not seeked to).
-- It never moves backwards, whatever the client sends.
-- ===========================================================================

alter table public.lesson_progress
  add column furthest_seconds int not null default 0
    constraint lesson_progress_furthest_nonnegative check (furthest_seconds >= 0);

create or replace function public.keep_furthest_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.furthest_seconds = greatest(coalesce(old.furthest_seconds, 0), coalesce(new.furthest_seconds, 0));
  return new;
end;
$$;

create trigger lesson_progress_keep_furthest
  before update on public.lesson_progress
  for each row execute function public.keep_furthest_progress();

-- ===========================================================================
-- New AI call kinds and question source
-- ===========================================================================

alter table public.ai_calls drop constraint ai_calls_kind_check;
alter table public.ai_calls add
  constraint ai_calls_kind_check check (kind in ('outline', 'chapters', 'full', 'transcript', 'tutor', 'check', 'search', 'whole_lecture', 'quiz', 'flashcards'));

alter table public.questions drop constraint questions_owner_matches_source;
alter table public.questions drop constraint questions_source_check;
alter table public.questions add
  constraint questions_source_check check (source in ('checkpoint', 'tutor_check', 'quiz'));
alter table public.questions add
  constraint questions_owner_matches_source check (
    (source = 'checkpoint' and owner_user_id is null)
    or (source in ('tutor_check', 'quiz') and owner_user_id is not null)
  );
-- Quiz questions: 1 recall, 2 understand, 3 apply, 4 challenge.
alter table public.questions add column difficulty int
  constraint questions_difficulty_range check (difficulty between 1 and 4);

-- ===========================================================================
-- weak_spots: parts of a lecture a student struggled with, from quizzes, doubts (pausing to
-- ask), wrong checkpoints and their own marking.
-- ===========================================================================

create table public.weak_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  youtube_video_id text not null
    constraint weak_spots_video_format check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  chapter_position int constraint weak_spots_chapter_nonnegative check (chapter_position >= 0),
  label text not null constraint weak_spots_label_length check (char_length(label) between 1 and 200),
  start_seconds int not null constraint weak_spots_start_nonnegative check (start_seconds >= 0),
  end_seconds int not null,
  source text not null constraint weak_spots_source_check check (source in ('checkpoint', 'quiz', 'doubt', 'manual')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint weak_spots_bounds check (end_seconds > start_seconds)
);

create index weak_spots_user_video_idx on public.weak_spots (user_id, youtube_video_id);

-- ===========================================================================
-- quiz_sessions: adaptive "Check yourself" quizzes. Server-only (the state decides which
-- question comes next); the API checks the owner.
-- ===========================================================================

create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  youtube_video_id text not null,
  output_language text not null
    constraint quiz_sessions_output_language_check check (output_language in ('en', 'hi', 'hinglish')),
  lesson_id uuid references public.lessons (id) on delete cascade,
  scope text not null constraint quiz_sessions_scope_check check (scope in ('lesson', 'chapter')),
  chapter_position int,
  status text not null default 'active' constraint quiz_sessions_status_check check (status in ('active', 'done')),
  state jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quiz_sessions_user_video_idx on public.quiz_sessions (user_id, youtube_video_id, created_at desc);

create trigger quiz_sessions_set_updated_at
  before update on public.quiz_sessions
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- lesson_flashcards: one generated deck per lesson chapter, shared by every student (like the
-- lesson itself). Server-only.
-- ===========================================================================

create table public.lesson_flashcards (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  chapter_position int not null constraint lesson_flashcards_position_nonnegative check (chapter_position >= 0),
  -- [{ front, back, seconds, kind }]
  cards jsonb not null,
  created_at timestamptz not null default now(),
  primary key (lesson_id, chapter_position)
);

-- ===========================================================================
-- Study rooms
-- ===========================================================================

create table public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint study_rooms_name_length check (char_length(name) between 1 and 60),
  description text constraint study_rooms_description_length check (char_length(description) <= 280),
  -- Six characters without look-alikes (no 0/O, 1/I/L).
  code text not null constraint study_rooms_code_format check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_rooms_code_key unique (code)
);

create trigger study_rooms_set_updated_at
  before update on public.study_rooms
  for each row execute function public.set_updated_at();

create table public.room_members (
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null constraint room_members_display_name_length check (char_length(display_name) between 1 and 40),
  role text not null default 'member' constraint room_members_role_check check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_idx on public.room_members (user_id);

create table public.room_goals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null constraint room_goals_title_length check (char_length(title) between 1 and 120),
  youtube_video_id text constraint room_goals_video_format check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create index room_goals_room_idx on public.room_goals (room_id, created_at);

create table public.room_goal_checks (
  goal_id uuid not null references public.room_goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);

create index room_goal_checks_user_idx on public.room_goal_checks (user_id);

-- Membership check used by the policies. Security definer so policies on room_members don't
-- recurse into themselves.
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_room_owner(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_rooms r
    where r.id = p_room_id and r.owner_id = (select auth.uid())
  );
$$;

create or replace function public.new_room_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
begin
  for i in 1..6 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end;
$$;

-- create_room: the room and its owner's membership, with a fresh unique code.
create or replace function public.create_room(p_name text, p_description text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_room uuid;
  v_owned int;
begin
  if v_user is null then
    raise exception 'create_room: not signed in' using errcode = '42501';
  end if;
  select count(*) into v_owned from public.study_rooms where owner_id = v_user;
  if v_owned >= 20 then
    raise exception 'create_room: room limit reached' using errcode = 'P0001', hint = 'room_limit';
  end if;

  for attempt in 1..10 loop
    begin
      insert into public.study_rooms (name, description, code, owner_id)
      values (trim(p_name), nullif(trim(coalesce(p_description, '')), ''), public.new_room_code(), v_user)
      returning id into v_room;
      exit;
    exception when unique_violation then
      if attempt = 10 then raise; end if;
    end;
  end loop;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (v_room, v_user, trim(p_display_name), 'owner');
  return v_room;
end;
$$;

-- join_room: join by code (case-insensitive). Returns the room, or null for an unknown code.
create or replace function public.join_room(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_room uuid;
  v_members int;
begin
  if v_user is null then
    raise exception 'join_room: not signed in' using errcode = '42501';
  end if;
  select id into v_room from public.study_rooms where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_room is null then
    return null;
  end if;
  if exists (select 1 from public.room_members where room_id = v_room and user_id = v_user) then
    return v_room;
  end if;
  select count(*) into v_members from public.room_members where room_id = v_room;
  if v_members >= 50 then
    raise exception 'join_room: room is full' using errcode = 'P0001', hint = 'room_full';
  end if;
  insert into public.room_members (room_id, user_id, display_name, role)
  values (v_room, v_user, trim(p_display_name), 'member');
  return v_room;
end;
$$;

-- rotate_room_code: owners can replace the code (old invites and QR codes stop working).
create or replace function public.rotate_room_code(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_room_owner(p_room_id) then
    raise exception 'rotate_room_code: not the owner' using errcode = '42501';
  end if;
  for attempt in 1..10 loop
    begin
      v_code := public.new_room_code();
      update public.study_rooms set code = v_code where id = p_room_id;
      return v_code;
    exception when unique_violation then
      if attempt = 10 then raise; end if;
    end;
  end loop;
  return null;
end;
$$;

-- room_progress: every member's progress on the room's goal lectures. Members only.
create or replace function public.room_progress(p_room_id uuid)
returns table (
  user_id uuid,
  youtube_video_id text,
  furthest_seconds int,
  last_position_seconds int,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.youtube_video_id, p.furthest_seconds, p.last_position_seconds, p.updated_at
  from public.lesson_progress p
  join public.room_members m on m.user_id = p.user_id and m.room_id = p_room_id
  where public.is_room_member(p_room_id)
    and p.youtube_video_id in (
      select g.youtube_video_id from public.room_goals g
      where g.room_id = p_room_id and g.youtube_video_id is not null
    );
$$;

-- room_activity: when each member last played anything (for "studying now"). Members only.
create or replace function public.room_activity(p_room_id uuid)
returns table (user_id uuid, youtube_video_id text, video_title text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (p.user_id) p.user_id, p.youtube_video_id, v.title, p.updated_at
  from public.lesson_progress p
  join public.room_members m on m.user_id = p.user_id and m.room_id = p_room_id
  left join public.videos v on v.youtube_video_id = p.youtube_video_id
  where public.is_room_member(p_room_id)
  order by p.user_id, p.updated_at desc;
$$;

-- video_peers: classmates from the caller's rooms who have opened this lecture.
create or replace function public.video_peers(p_youtube_video_id text)
returns table (
  user_id uuid,
  display_name text,
  room_id uuid,
  room_name text,
  furthest_seconds int,
  last_position_seconds int,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (p.user_id)
    p.user_id, m.display_name, r.id, r.name, p.furthest_seconds, p.last_position_seconds, p.updated_at
  from public.room_members me
  join public.room_members m on m.room_id = me.room_id and m.user_id <> me.user_id
  join public.study_rooms r on r.id = me.room_id
  join public.lesson_progress p on p.user_id = m.user_id and p.youtube_video_id = p_youtube_video_id
  where me.user_id = (select auth.uid())
  order by p.user_id, r.created_at;
$$;

-- ===========================================================================
-- Study calendar
-- ===========================================================================

create table public.study_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null constraint study_events_title_length check (char_length(title) between 1 and 120),
  notes text constraint study_events_notes_length check (char_length(notes) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  youtube_video_id text constraint study_events_video_format check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  seconds int constraint study_events_seconds_nonnegative check (seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_events_bounds check (ends_at > starts_at)
);

create index study_events_user_start_idx on public.study_events (user_id, starts_at);

create trigger study_events_set_updated_at
  before update on public.study_events
  for each row execute function public.set_updated_at();

-- The secret in a student's calendar subscription URL. Read by the feed route with the secret
-- key; the student can see and replace their own.
create table public.calendar_feeds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null constraint calendar_feeds_token_format check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  created_at timestamptz not null default now(),
  constraint calendar_feeds_token_key unique (token)
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.weak_spots enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.lesson_flashcards enable row level security;
alter table public.study_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_goals enable row level security;
alter table public.room_goal_checks enable row level security;
alter table public.study_events enable row level security;
alter table public.calendar_feeds enable row level security;

revoke all on table
  public.weak_spots,
  public.quiz_sessions,
  public.lesson_flashcards,
  public.study_rooms,
  public.room_members,
  public.room_goals,
  public.room_goal_checks,
  public.study_events,
  public.calendar_feeds
from anon;

-- Server-only.
revoke all on table public.quiz_sessions, public.lesson_flashcards from authenticated;

-- Simple owner tables.
do $$
declare
  t text;
begin
  foreach t in array array['weak_spots', 'study_events', 'calendar_feeds'] loop
    execute format(
      'create policy "Owners read their rows" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "Owners create their rows" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "Owners update their rows" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "Owners delete their rows" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- study_rooms: members read; the owner edits and deletes. Created only through create_room.
revoke insert on table public.study_rooms from authenticated;
revoke update on table public.study_rooms from authenticated;
grant update (name, description) on table public.study_rooms to authenticated;
create policy "Members read their rooms" on public.study_rooms
  for select to authenticated using (public.is_room_member(id));
create policy "Owners update their rooms" on public.study_rooms
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their rooms" on public.study_rooms
  for delete to authenticated using (owner_id = (select auth.uid()));

-- room_members: members see each other; anyone leaves, the owner removes others (never
-- themselves: they delete the room instead). Joined only through create_room / join_room.
revoke insert on table public.room_members from authenticated;
revoke update on table public.room_members from authenticated;
grant update (display_name) on table public.room_members to authenticated;
create policy "Members see their classmates" on public.room_members
  for select to authenticated using (public.is_room_member(room_id));
create policy "Members rename themselves" on public.room_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members leave and owners remove" on public.room_members
  for delete to authenticated using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (public.is_room_owner(room_id) and user_id <> (select auth.uid()))
  );

-- room_goals: members read and add; the author or the owner edits and deletes.
revoke update on table public.room_goals from authenticated;
grant update (title, youtube_video_id, due_at) on table public.room_goals to authenticated;
create policy "Members read goals" on public.room_goals
  for select to authenticated using (public.is_room_member(room_id));
create policy "Members add goals" on public.room_goals
  for insert to authenticated with check (public.is_room_member(room_id) and created_by = (select auth.uid()));
create policy "Authors and owners edit goals" on public.room_goals
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_room_owner(room_id))
  with check (public.is_room_member(room_id));
create policy "Authors and owners delete goals" on public.room_goals
  for delete to authenticated using (created_by = (select auth.uid()) or public.is_room_owner(room_id));

-- room_goal_checks: members see the room's ticks and tick their own.
revoke update on table public.room_goal_checks from authenticated;
create policy "Members see goal ticks" on public.room_goal_checks
  for select to authenticated using (
    exists (select 1 from public.room_goals g where g.id = goal_id and public.is_room_member(g.room_id))
  );
create policy "Members tick their goals" on public.room_goal_checks
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.room_goals g where g.id = goal_id and public.is_room_member(g.room_id))
  );
create policy "Members untick their goals" on public.room_goal_checks
  for delete to authenticated using (user_id = (select auth.uid()));

-- Functions: signed-in users only.
revoke execute on function
  public.is_room_member(uuid),
  public.is_room_owner(uuid),
  public.create_room(text, text, text),
  public.join_room(text, text),
  public.rotate_room_code(uuid),
  public.room_progress(uuid),
  public.room_activity(uuid),
  public.video_peers(text)
from public, anon;
grant execute on function
  public.is_room_member(uuid),
  public.is_room_owner(uuid),
  public.create_room(text, text, text),
  public.join_room(text, text),
  public.rotate_room_code(uuid),
  public.room_progress(uuid),
  public.room_activity(uuid),
  public.video_peers(text)
to authenticated;
revoke execute on function public.new_room_code() from public, anon, authenticated;
