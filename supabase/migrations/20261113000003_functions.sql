-- Sapience — database functions. Section 7.3.
--
-- All functions here are SECURITY DEFINER with an empty search_path, and EXECUTE is granted to
-- service_role only. Users must not be able to call consume_quota with their own limit, or
-- write lesson content.

-- ---------------------------------------------------------------------------
-- consume_quota: atomic check-and-increment of a per-user daily counter (day in Asia/Kolkata).
-- Returns true if the request is within the limit (and counts it), false otherwise.
-- ---------------------------------------------------------------------------

create or replace function public.consume_quota(p_user_id uuid, p_kind text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_count int;
begin
  if p_kind not in ('lesson', 'ai') then
    raise exception 'consume_quota: unknown kind %', p_kind using errcode = '22023';
  end if;
  if p_user_id is null or p_limit is null or p_limit < 0 then
    raise exception 'consume_quota: invalid arguments' using errcode = '22023';
  end if;

  insert into public.usage_daily (user_id, day)
  values (p_user_id, v_day)
  on conflict (user_id, day) do nothing;

  -- The conditional update row-locks the counter, so concurrent calls can't both pass.
  if p_kind = 'lesson' then
    update public.usage_daily
       set lessons_created = lessons_created + 1
     where user_id = p_user_id and day = v_day and lessons_created < p_limit
    returning lessons_created into v_count;
  else
    update public.usage_daily
       set ai_requests = ai_requests + 1
     where user_id = p_user_id and day = v_day and ai_requests < p_limit
    returning ai_requests into v_count;
  end if;

  return v_count is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- global_lessons_today: lessons created today (Asia/Kolkata), excluding fixtures.
-- ---------------------------------------------------------------------------

create or replace function public.global_lessons_today()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
    from public.lessons
   where source <> 'fixture'
     and (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
$$;

-- ---------------------------------------------------------------------------
-- refresh_lesson_counters (internal): recompute chapter counters from lesson_chapters and
-- finish the lesson once every chapter is ready or failed. A lesson with at least one ready
-- chapter is `ready` (failed chapters show a per-chapter retry); if every chapter failed, the
-- lesson is `failed`.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_lesson_counters(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
  v_ready int;
  v_failed int;
begin
  select count(*)::int,
         count(*) filter (where status = 'ready')::int,
         count(*) filter (where status = 'failed')::int
    into v_total, v_ready, v_failed
    from public.lesson_chapters
   where lesson_id = p_lesson_id;

  update public.lessons l
     set chapters_total = v_total,
         chapters_ready = v_ready,
         chapters_failed = v_failed,
         status = case
           when v_total > 0 and v_ready + v_failed >= v_total and v_ready > 0 then 'ready'
           when v_total > 0 and v_failed >= v_total then 'failed'
           else l.status
         end,
         error_code = case
           when v_total > 0 and v_ready + v_failed >= v_total and v_ready > 0 then null
           else l.error_code
         end
   where l.id = p_lesson_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_chapter_batch: write chapter details, lecture-index segments and checkpoint questions in
-- one transaction, then update counters.
--
-- p_details: JSON array of ChapterDetail (src/lib/ai/schemas/lesson.ts):
--   [{ position, summary, notesMarkdown, keyTerms[], formulas[], keyMoments[{seconds,label}],
--      checkpoint: { concept, question, options[4], correctIndex, explanation, misconception } | null,
--      segments[{ startSeconds, endSeconds, speech, board }] }]
-- Segment IDs are assigned here as c{position}s{index}; key moment IDs as c{position}m{index}.
-- Chapters that are already `ready` are left untouched (idempotent on job retries).
-- ---------------------------------------------------------------------------

create or replace function public.save_chapter_batch(p_lesson_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detail jsonb;
  v_position int;
  v_chapter public.lesson_chapters%rowtype;
  v_video_id text;
  v_checkpoint jsonb;
begin
  if jsonb_typeof(p_details) <> 'array' then
    raise exception 'save_chapter_batch: p_details must be a JSON array' using errcode = '22023';
  end if;

  select youtube_video_id into v_video_id
    from public.lessons
   where id = p_lesson_id
   for update;
  if not found then
    raise exception 'save_chapter_batch: lesson % not found', p_lesson_id using errcode = 'P0002';
  end if;

  for v_detail in select value from jsonb_array_elements(p_details) loop
    v_position := (v_detail ->> 'position')::int;

    select * into v_chapter
      from public.lesson_chapters
     where lesson_id = p_lesson_id and position = v_position
     for update;
    if not found then
      raise exception 'save_chapter_batch: chapter % not found', v_position using errcode = 'P0002';
    end if;

    continue when v_chapter.status = 'ready';

    update public.lesson_chapters c
       set status = 'ready',
           summary = v_detail ->> 'summary',
           notes_markdown = v_detail ->> 'notesMarkdown',
           key_terms = coalesce(
             array(select jsonb_array_elements_text(coalesce(v_detail -> 'keyTerms', '[]'::jsonb))),
             '{}'),
           formulas = coalesce(
             array(select jsonb_array_elements_text(coalesce(v_detail -> 'formulas', '[]'::jsonb))),
             '{}'),
           key_moments = coalesce((
             select jsonb_agg(
                      jsonb_build_object(
                        'id', format('c%sm%s', v_position, m.ord - 1),
                        'seconds', (m.value ->> 'seconds')::int,
                        'label', m.value ->> 'label')
                      order by m.ord)
               from jsonb_array_elements(coalesce(v_detail -> 'keyMoments', '[]'::jsonb))
                    with ordinality as m(value, ord)
           ), '[]'::jsonb),
           segments = coalesce((
             select jsonb_agg(
                      jsonb_build_object(
                        'id', format('c%ss%s', v_position, s.ord - 1),
                        'startSeconds', (s.value ->> 'startSeconds')::int,
                        'endSeconds', (s.value ->> 'endSeconds')::int,
                        'speech', s.value ->> 'speech',
                        'board', s.value -> 'board')
                      order by s.ord)
               from jsonb_array_elements(coalesce(v_detail -> 'segments', '[]'::jsonb))
                    with ordinality as s(value, ord)
           ), '[]'::jsonb)
     where c.id = v_chapter.id;

    -- A chapter that wasn't ready has no attempted questions, so replacing is safe.
    delete from public.questions where chapter_id = v_chapter.id and source = 'checkpoint';

    v_checkpoint := v_detail -> 'checkpoint';
    if v_checkpoint is not null and jsonb_typeof(v_checkpoint) = 'object' then
      insert into public.questions (
        source, lesson_id, chapter_id, owner_user_id, youtube_video_id, at_seconds,
        concept, prompt, options, correct_index, explanation, misconception
      ) values (
        'checkpoint', p_lesson_id, v_chapter.id, null, v_video_id, v_chapter.end_seconds,
        v_checkpoint ->> 'concept',
        v_checkpoint ->> 'question',
        v_checkpoint -> 'options',
        (v_checkpoint ->> 'correctIndex')::int,
        v_checkpoint ->> 'explanation',
        v_checkpoint ->> 'misconception'
      );
    end if;
  end loop;

  perform public.refresh_lesson_counters(p_lesson_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_chapters_failed: a `chapters` job gave up after its attempts; mark its chapters failed
-- (other chapters stay usable) and update counters.
-- ---------------------------------------------------------------------------

create or replace function public.mark_chapters_failed(p_lesson_id uuid, p_positions int[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lesson_chapters
     set status = 'failed'
   where lesson_id = p_lesson_id
     and position = any (p_positions)
     and status <> 'ready';

  perform public.refresh_lesson_counters(p_lesson_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- save_full_lesson: single-pass lessons (videos ≤ 15 min) and fixtures. Replaces any existing
-- chapters, writes overview + chapters, then reuses save_chapter_batch for the details.
--
-- p_lesson: FullLesson JSON { spokenLanguage, overview, chapters: [{ title, startSeconds,
--   endSeconds, summary, notesMarkdown, keyTerms, formulas, keyMoments, checkpoint, segments }] }
-- ---------------------------------------------------------------------------

create or replace function public.save_full_lesson(p_lesson_id uuid, p_lesson jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_details jsonb;
begin
  if jsonb_typeof(p_lesson -> 'chapters') <> 'array' or jsonb_array_length(p_lesson -> 'chapters') = 0 then
    raise exception 'save_full_lesson: chapters must be a non-empty array' using errcode = '22023';
  end if;

  perform 1 from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'save_full_lesson: lesson % not found', p_lesson_id using errcode = 'P0002';
  end if;

  delete from public.lesson_chapters where lesson_id = p_lesson_id;

  insert into public.lesson_chapters (lesson_id, position, status, title, start_seconds, end_seconds)
  select p_lesson_id,
         (c.ord - 1)::int,
         'pending',
         c.value ->> 'title',
         (c.value ->> 'startSeconds')::int,
         (c.value ->> 'endSeconds')::int
    from jsonb_array_elements(p_lesson -> 'chapters') with ordinality as c(value, ord);

  update public.lessons
     set spoken_language = p_lesson ->> 'spokenLanguage',
         overview = p_lesson ->> 'overview',
         status = 'building',
         error_code = null
   where id = p_lesson_id;

  select jsonb_agg(c.value || jsonb_build_object('position', c.ord - 1) order by c.ord)
    into v_details
    from jsonb_array_elements(p_lesson -> 'chapters') with ordinality as c(value, ord);

  perform public.save_chapter_batch(p_lesson_id, v_details);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: service_role only. Supabase grants EXECUTE on new public functions to anon and
-- authenticated by default, so revoke explicitly.
-- ---------------------------------------------------------------------------

revoke execute on function public.consume_quota(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.global_lessons_today() from public, anon, authenticated;
revoke execute on function public.refresh_lesson_counters(uuid) from public, anon, authenticated;
revoke execute on function public.save_chapter_batch(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.mark_chapters_failed(uuid, int[]) from public, anon, authenticated;
revoke execute on function public.save_full_lesson(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

grant execute on function public.consume_quota(uuid, text, int) to service_role;
grant execute on function public.global_lessons_today() to service_role;
grant execute on function public.refresh_lesson_counters(uuid) to service_role;
grant execute on function public.save_chapter_batch(uuid, jsonb) to service_role;
grant execute on function public.mark_chapters_failed(uuid, int[]) to service_role;
grant execute on function public.save_full_lesson(uuid, jsonb) to service_role;
