-- Sapience — user-owned tables. Sections 7.2 and 7.4.
--
-- Every row carries user_id and is visible only to its owner via RLS. Guests are signed in with
-- Supabase anonymous auth: they use the `authenticated` role with is_anonymous = true in the JWT,
-- so these policies apply to them unchanged. The `anon` role (no session) gets nothing.
--
-- User tables reference videos by youtube_video_id (not lesson_id), so regenerating a lesson
-- never breaks a student's data.

-- ---------------------------------------------------------------------------
-- profiles (created by trigger on auth.users insert, including anonymous users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Validated in code (src/types/contracts.ts → Preferences)
  preferences jsonb not null default '{}',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- lesson_progress
-- ---------------------------------------------------------------------------

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  youtube_video_id text not null references public.videos (youtube_video_id),
  output_language text not null
    constraint lesson_progress_output_language_check check (output_language in ('en', 'hi', 'hinglish')),
  last_position_seconds int not null default 0
    constraint lesson_progress_position_nonnegative check (last_position_seconds >= 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, youtube_video_id)
);

create index lesson_progress_user_updated_idx on public.lesson_progress (user_id, updated_at desc);

create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- question_attempts: inserted only by the grading route (secret key); users read their own.
-- ---------------------------------------------------------------------------

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_index int not null constraint question_attempts_selected_range check (selected_index between 0 and 3),
  is_correct bool not null,
  created_at timestamptz not null default now()
);

create index question_attempts_user_question_idx on public.question_attempts (user_id, question_id);

-- ---------------------------------------------------------------------------
-- conversations + messages (tutor)
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  youtube_video_id text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_video_idx on public.conversations (user_id, youtube_video_id, updated_at desc);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null constraint messages_role_check check (role in ('user', 'assistant')),
  parts jsonb not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_user_id_idx on public.messages (user_id);

-- ---------------------------------------------------------------------------
-- concepts + revision (FSRS via ts-fsrs)
-- ---------------------------------------------------------------------------

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  youtube_video_id text,
  output_language text
    constraint concepts_output_language_check check (output_language in ('en', 'hi', 'hinglish')),
  source_seconds int,
  title text not null,
  explanation_markdown text,
  question_id uuid references public.questions (id) on delete set null,
  source text not null default 'manual'
    constraint concepts_source_check check (source in ('checkpoint', 'tutor', 'chapter', 'key_term', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index concepts_user_question_key
  on public.concepts (user_id, question_id)
  where question_id is not null;

-- Duplicate saves for the same (user, video, title) return the existing concept (Section 5.10).
create unique index concepts_user_video_title_key
  on public.concepts (user_id, youtube_video_id, title) nulls not distinct;

create trigger concepts_set_updated_at
  before update on public.concepts
  for each row execute function public.set_updated_at();

create table public.revision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid not null unique references public.concepts (id) on delete cascade,
  -- Serialized ts-fsrs Card (dates as ISO strings)
  card jsonb not null,
  due_at timestamptz not null,
  state text not null default 'new'
    constraint revision_items_state_check check (state in ('new', 'learning', 'review', 'relearning')),
  reps int not null default 0,
  lapses int not null default 0,
  last_rating text
    constraint revision_items_last_rating_check check (last_rating in ('again', 'hard', 'good', 'easy')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index revision_items_user_due_idx on public.revision_items (user_id, due_at);

create trigger revision_items_set_updated_at
  before update on public.revision_items
  for each row execute function public.set_updated_at();

create table public.revision_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  revision_item_id uuid not null references public.revision_items (id) on delete cascade,
  rating text not null
    constraint revision_reviews_rating_check check (rating in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null default now(),
  prev_due_at timestamptz,
  next_due_at timestamptz,
  log jsonb
);

create index revision_reviews_user_id_idx on public.revision_reviews (user_id);
create index revision_reviews_item_idx on public.revision_reviews (revision_item_id);

-- ---------------------------------------------------------------------------
-- notes (P1 feature; table created now so the schema is complete)
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  youtube_video_id text not null,
  kind text not null default 'note' constraint notes_kind_check check (kind in ('note', 'bookmark')),
  seconds int,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_video_idx on public.notes (user_id, youtube_video_id);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_api_keys (P1 BYOK). Server-only: RLS on, no policies. Settings talks to it through
-- Server Actions using the secret-key client and checks the caller's ID.
-- ---------------------------------------------------------------------------

create table public.user_api_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null constraint user_api_keys_provider_check check (provider in ('gemini', 'openrouter')),
  ciphertext bytea not null,
  iv bytea not null,
  last4 text not null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_api_keys_set_updated_at
  before update on public.user_api_keys
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- usage_daily: per-user daily counters. Written only by consume_quota (service role).
-- ---------------------------------------------------------------------------

create table public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  ai_requests int not null default 0,
  lessons_created int not null default 0,
  primary key (user_id, day)
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.question_attempts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.concepts enable row level security;
alter table public.revision_items enable row level security;
alter table public.revision_reviews enable row level security;
alter table public.notes enable row level security;
alter table public.user_api_keys enable row level security;
alter table public.usage_daily enable row level security;

-- No session, no data: the anon role gets no privileges on any user table.
revoke all on table
  public.profiles,
  public.lesson_progress,
  public.question_attempts,
  public.conversations,
  public.messages,
  public.concepts,
  public.revision_items,
  public.revision_reviews,
  public.notes,
  public.user_api_keys,
  public.usage_daily
from anon;

-- Read-only (to users) tables and the server-only key table.
revoke insert, update, delete, truncate on table public.question_attempts, public.usage_daily from authenticated;
revoke update, delete, truncate on table public.revision_reviews from authenticated;
revoke all on table public.user_api_keys from authenticated;

-- profiles: id is the owner column
create policy "Owners read their profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Owners create their profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Owners update their profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Owners delete their profile" on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

-- Standard owner policies (select / insert / update / delete) for simple user tables.
do $$
declare
  t text;
begin
  foreach t in array array['lesson_progress', 'conversations', 'concepts', 'notes'] loop
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

-- messages: also require the parent conversation to belong to the caller.
create policy "Owners read their messages" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owners add messages to their conversations" on public.messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "Owners update their messages" on public.messages
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "Owners delete their messages" on public.messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- revision_items: also require the concept to belong to the caller.
create policy "Owners read their revision items" on public.revision_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owners create revision items for their concepts" on public.revision_items
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.concepts c
      where c.id = concept_id and c.user_id = (select auth.uid())
    )
  );
create policy "Owners update their revision items" on public.revision_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.concepts c
      where c.id = concept_id and c.user_id = (select auth.uid())
    )
  );
create policy "Owners delete their revision items" on public.revision_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- revision_reviews: insert and read own; the review must be for the caller's own item.
create policy "Owners read their reviews" on public.revision_reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owners log reviews of their items" on public.revision_reviews
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.revision_items r
      where r.id = revision_item_id and r.user_id = (select auth.uid())
    )
  );

-- question_attempts and usage_daily: read own only.
create policy "Owners read their attempts" on public.question_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owners read their usage" on public.usage_daily
  for select to authenticated using (user_id = (select auth.uid()));

-- user_api_keys: no policies (server-only).
