-- Sapience — shared (cross-user) tables. Section 7.1.
--
-- `videos` is readable by signed-in users (guests included). Everything else in this file is
-- server-only: RLS is enabled with no policies, and table privileges are revoked from the
-- `anon` and `authenticated` roles, so only the secret-key (service_role) client can touch it.
--
-- Option lists in check constraints must match src/config/enums.ts
-- (enforced by tests/unit/enums-migrations.test.ts). Keep constraint names stable.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- videos: cached YouTube metadata (videos.list). Writes are server-only.
-- ---------------------------------------------------------------------------

create table public.videos (
  youtube_video_id text primary key
    constraint videos_youtube_video_id_format check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  channel_title text,
  duration_seconds int not null constraint videos_duration_positive check (duration_seconds > 0),
  thumbnail_url text,
  privacy_status text,
  embeddable bool,
  checked_at timestamptz not null default now()
);

alter table public.videos enable row level security;

create policy "Signed-in users can read video metadata"
  on public.videos for select
  to authenticated
  using (true);

revoke all on table public.videos from anon;
revoke insert, update, delete, truncate on table public.videos from authenticated;

-- ---------------------------------------------------------------------------
-- lessons: one lesson map per (video, output language, prompt version). Server-only.
-- ---------------------------------------------------------------------------

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null references public.videos (youtube_video_id),
  output_language text not null
    constraint lessons_output_language_check check (output_language in ('en', 'hi', 'hinglish')),
  prompt_version text not null,
  source text not null default 'gemini_video'
    constraint lessons_source_check check (source in ('gemini_video', 'transcript_paste', 'fixture')),
  status text not null default 'queued'
    constraint lessons_status_check check (status in ('queued', 'outlining', 'building', 'ready', 'failed')),
  spoken_language text,
  overview text,
  chapters_total int not null default 0,
  chapters_ready int not null default 0,
  chapters_failed int not null default 0,
  error_code text
    constraint lessons_error_code_check check (error_code in ('video_unavailable', 'model_timeout', 'invalid_output', 'quota', 'unknown')),
  provider text,
  model text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  generation_ms int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  last_nudged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_video_language_version_key unique (youtube_video_id, output_language, prompt_version)
);

create index lessons_youtube_video_id_idx on public.lessons (youtube_video_id);
create index lessons_created_at_idx on public.lessons (created_at);

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lesson_chapters: chapter boundaries, notes and the lecture index (segments). Server-only.
-- ---------------------------------------------------------------------------

create table public.lesson_chapters (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position int not null constraint lesson_chapters_position_nonnegative check (position >= 0),
  status text not null default 'pending'
    constraint lesson_chapters_status_check check (status in ('pending', 'ready', 'failed')),
  title text not null,
  start_seconds int not null constraint lesson_chapters_start_nonnegative check (start_seconds >= 0),
  end_seconds int not null,
  summary text,
  notes_markdown text,
  key_terms text[] not null default '{}',
  formulas text[] not null default '{}',
  -- [{ id, seconds, label }]
  key_moments jsonb not null default '[]',
  -- [{ id, startSeconds, endSeconds, speech, board }]
  segments jsonb not null default '[]',
  constraint lesson_chapters_bounds check (end_seconds > start_seconds),
  constraint lesson_chapters_lesson_position_key unique (lesson_id, position)
);

-- ---------------------------------------------------------------------------
-- lesson_jobs: one row per unit of generation work (Section 5.4). Server-only.
-- ---------------------------------------------------------------------------

create table public.lesson_jobs (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  kind text not null
    constraint lesson_jobs_kind_check check (kind in ('full', 'outline', 'chapters', 'transcript')),
  payload jsonb not null default '{}',
  status text not null default 'queued'
    constraint lesson_jobs_status_check check (status in ('queued', 'running', 'done', 'failed')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  error_code text
    constraint lesson_jobs_error_code_check check (error_code in ('video_unavailable', 'model_timeout', 'invalid_output', 'quota', 'unknown')),
  byok_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_jobs_lesson_id_status_idx on public.lesson_jobs (lesson_id, status);
create index lesson_jobs_status_run_after_idx on public.lesson_jobs (status, run_after);

create trigger lesson_jobs_set_updated_at
  before update on public.lesson_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- questions: checkpoints (shared) and tutor check questions (owned). Server-only, because
-- rows carry the correct answer. The public serializer strips answers before they leave
-- the server.
-- ---------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  source text not null
    constraint questions_source_check check (source in ('checkpoint', 'tutor_check')),
  lesson_id uuid references public.lessons (id) on delete cascade,
  chapter_id uuid references public.lesson_chapters (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete cascade,
  youtube_video_id text,
  at_seconds int,
  concept text not null,
  prompt text not null,
  options jsonb not null,
  correct_index int not null constraint questions_correct_index_range check (correct_index between 0 and 3),
  explanation text not null,
  misconception text,
  created_at timestamptz not null default now(),
  constraint questions_owner_matches_source check (
    (source = 'checkpoint' and owner_user_id is null)
    or (source = 'tutor_check' and owner_user_id is not null)
  )
);

create index questions_chapter_id_idx on public.questions (chapter_id);
create index questions_lesson_id_idx on public.questions (lesson_id);
create index questions_owner_user_id_idx on public.questions (owner_user_id);

-- ---------------------------------------------------------------------------
-- ai_calls: one row per model call, for real token/time numbers. Server-only.
-- ---------------------------------------------------------------------------

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  kind text not null
    constraint ai_calls_kind_check check (kind in ('outline', 'chapters', 'full', 'transcript', 'tutor', 'check', 'search', 'whole_lecture')),
  provider text not null,
  model text not null,
  fallback_from text,
  byok bool not null default false,
  input_tokens int,
  output_tokens int,
  duration_ms int,
  ok bool not null,
  error_code text,
  created_at timestamptz not null default now()
);

create index ai_calls_created_at_idx on public.ai_calls (created_at);
create index ai_calls_lesson_id_idx on public.ai_calls (lesson_id);

-- ---------------------------------------------------------------------------
-- Lock down server-only tables: RLS on, no policies, no table privileges for API roles.
-- ---------------------------------------------------------------------------

alter table public.lessons enable row level security;
alter table public.lesson_chapters enable row level security;
alter table public.lesson_jobs enable row level security;
alter table public.questions enable row level security;
alter table public.ai_calls enable row level security;

revoke all on table
  public.lessons,
  public.lesson_chapters,
  public.lesson_jobs,
  public.questions,
  public.ai_calls
from anon, authenticated;
