-- Sapience — lesson job system. Section 5.4.
--
-- Everything that must be atomic lives here: creating a lesson with its first job, claiming a
-- job under the app-wide concurrency cap, backing off on rate limits, failing after 3 attempts,
-- saving an outline with its chapter jobs, and retries. All SECURITY DEFINER with an empty
-- search_path, EXECUTE for service_role only.

-- ---------------------------------------------------------------------------
-- create_lesson: insert the lesson (or find the existing one) and, if this call created it,
-- insert its first job. Returns the lesson id, whether it was created, and the job id (if any).
-- ---------------------------------------------------------------------------

create or replace function public.create_lesson(
  p_youtube_video_id text,
  p_output_language text,
  p_prompt_version text,
  p_source text,
  p_created_by uuid,
  p_job_kind text,
  p_job_payload jsonb
)
returns table (lesson_id uuid, created boolean, job_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson_id uuid;
  v_job_id uuid;
begin
  insert into public.lessons (youtube_video_id, output_language, prompt_version, source, status, created_by)
  values (p_youtube_video_id, p_output_language, p_prompt_version, p_source, 'queued', p_created_by)
  on conflict (youtube_video_id, output_language, prompt_version) do nothing
  returning id into v_lesson_id;

  if v_lesson_id is null then
    select l.id into v_lesson_id
      from public.lessons l
     where l.youtube_video_id = p_youtube_video_id
       and l.output_language = p_output_language
       and l.prompt_version = p_prompt_version;
    return query select v_lesson_id, false, null::uuid;
    return;
  end if;

  insert into public.lesson_jobs (lesson_id, kind, payload, status)
  values (v_lesson_id, p_job_kind, coalesce(p_job_payload, '{}'::jsonb), 'queued')
  returning id into v_job_id;

  return query select v_lesson_id, true, v_job_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- restart_lesson: a failed lesson is retried from scratch: clear its chapters and jobs, reset
-- it to queued with a new first job. Returns the new job id, or null if the lesson isn't failed
-- or was updated less than p_min_age_seconds ago.
-- ---------------------------------------------------------------------------

create or replace function public.restart_lesson(
  p_lesson_id uuid,
  p_source text,
  p_job_kind text,
  p_job_payload jsonb,
  p_min_age_seconds int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  update public.lessons
     set status = 'queued',
         source = p_source,
         error_code = null,
         chapters_total = 0,
         chapters_ready = 0,
         chapters_failed = 0,
         last_nudged_at = null
   where id = p_lesson_id
     and status = 'failed'
     and updated_at < now() - make_interval(secs => p_min_age_seconds);
  if not found then
    return null;
  end if;

  delete from public.lesson_jobs where lesson_id = p_lesson_id;
  delete from public.lesson_chapters where lesson_id = p_lesson_id;

  insert into public.lesson_jobs (lesson_id, kind, payload, status)
  values (p_lesson_id, p_job_kind, coalesce(p_job_payload, '{}'::jsonb), 'queued')
  returning id into v_job_id;
  return v_job_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- retry_chapters: reset the failed `chapters` job(s) covering a chapter position, and put their
-- failed chapters back to pending. Returns the reset job ids.
-- ---------------------------------------------------------------------------

create or replace function public.retry_chapters(p_lesson_id uuid, p_position int)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
begin
  for v_job in
    select j.id, j.payload
      from public.lesson_jobs j
     where j.lesson_id = p_lesson_id
       and j.kind = 'chapters'
       and j.status = 'failed'
       and j.payload -> 'positions' @> to_jsonb(p_position)
     for update
  loop
    update public.lesson_jobs
       set status = 'queued', attempts = 0, run_after = now(), locked_at = null, error_code = null
     where id = v_job.id;

    update public.lesson_chapters
       set status = 'pending'
     where lesson_id = p_lesson_id
       and status = 'failed'
       and position in (select (jsonb_array_elements_text(v_job.payload -> 'positions'))::int);

    return next v_job.id;
  end loop;

  update public.lessons l
     set status = 'building', error_code = null
   where l.id = p_lesson_id
     and exists (select 1 from public.lesson_chapters c where c.lesson_id = p_lesson_id and c.status = 'pending');
  perform public.refresh_lesson_counters(p_lesson_id);
  -- refresh_lesson_counters leaves the status alone while chapters are pending.
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_lesson_job: atomically claim a job for running, but only while fewer than p_max_running
-- jobs are running app-wide (stale `running` rows older than 6 minutes don't count). The
-- advisory lock serialises claims so the cap can't be exceeded by concurrent invocations.
-- Returns the claimed row, or nothing.
-- ---------------------------------------------------------------------------

create or replace function public.claim_lesson_job(p_job_id uuid, p_max_running int)
returns setof public.lesson_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_running int;
begin
  perform pg_advisory_xact_lock(hashtext('sapience.lesson_jobs.claim'));

  select count(*)::int into v_running
    from public.lesson_jobs
   where status = 'running'
     and locked_at >= now() - interval '6 minutes'
     and id <> p_job_id;
  if v_running >= p_max_running then
    return;
  end if;

  return query
  update public.lesson_jobs
     set status = 'running', locked_at = now(), attempts = attempts + 1
   where id = p_job_id
     and attempts < 3
     and run_after <= now()
     and (status = 'queued' or (status = 'running' and locked_at < now() - interval '6 minutes'))
  returning *;
end;
$$;

-- ---------------------------------------------------------------------------
-- dispatchable_jobs: queued jobs that are due (oldest first), at most the free slots under the
-- cap, plus stale running jobs the watchdog should re-dispatch. Optionally limited to one lesson.
-- ---------------------------------------------------------------------------

create or replace function public.dispatchable_jobs(p_max_running int, p_lesson_id uuid default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with running as (
    select count(*)::int as n
      from public.lesson_jobs
     where status = 'running' and locked_at >= now() - interval '6 minutes'
  ),
  candidates as (
    select j.id, j.created_at
      from public.lesson_jobs j
     where j.attempts < 3
       and j.run_after <= now()
       and (j.status = 'queued' or (j.status = 'running' and j.locked_at < now() - interval '6 minutes'))
       and (p_lesson_id is null or j.lesson_id = p_lesson_id)
     order by j.run_after, j.created_at
  )
  select c.id
    from candidates c, running r
   limit greatest(p_max_running - (select n from running), 0);
$$;

-- ---------------------------------------------------------------------------
-- requeue_lesson_job: rate-limited (429). Back to queued after p_delay_seconds without using up
-- an attempt (the claim incremented it, so give it back).
-- ---------------------------------------------------------------------------

create or replace function public.requeue_lesson_job(p_job_id uuid, p_delay_seconds int)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.lesson_jobs
     set status = 'queued',
         attempts = greatest(attempts - 1, 0),
         run_after = now() + make_interval(secs => greatest(p_delay_seconds, 1)),
         locked_at = null,
         error_code = 'quota'
   where id = p_job_id;
$$;

-- ---------------------------------------------------------------------------
-- fail_lesson_job: a job attempt failed. With attempts left, queue it again after
-- p_retry_delay_seconds. Otherwise mark it failed: a `chapters` job fails its chapters (others
-- stay usable); `full`/`outline`/`transcript` fail the whole lesson. Returns the job's status.
-- ---------------------------------------------------------------------------

create or replace function public.fail_lesson_job(p_job_id uuid, p_error_code text, p_retry_delay_seconds int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.lesson_jobs%rowtype;
begin
  select * into v_job from public.lesson_jobs where id = p_job_id for update;
  if not found then
    return null;
  end if;

  if v_job.attempts < 3 then
    update public.lesson_jobs
       set status = 'queued',
           run_after = now() + make_interval(secs => greatest(p_retry_delay_seconds, 1)),
           locked_at = null,
           error_code = p_error_code
     where id = p_job_id;
    return 'queued';
  end if;

  update public.lesson_jobs
     set status = 'failed', locked_at = null, error_code = p_error_code
   where id = p_job_id;

  if v_job.kind = 'chapters' then
    perform public.mark_chapters_failed(
      v_job.lesson_id,
      array(select (jsonb_array_elements_text(v_job.payload -> 'positions'))::int));
  else
    update public.lessons set status = 'failed', error_code = p_error_code where id = v_job.lesson_id;
  end if;
  return 'failed';
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_lesson_job: mark a job done and add its usage to the lesson totals.
-- ---------------------------------------------------------------------------

create or replace function public.complete_lesson_job(
  p_job_id uuid,
  p_input_tokens int,
  p_output_tokens int,
  p_generation_ms int,
  p_provider text,
  p_model text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson_id uuid;
begin
  update public.lesson_jobs
     set status = 'done', locked_at = null, error_code = null
   where id = p_job_id
  returning lesson_id into v_lesson_id;

  update public.lessons
     set input_tokens = input_tokens + coalesce(p_input_tokens, 0),
         output_tokens = output_tokens + coalesce(p_output_tokens, 0),
         generation_ms = generation_ms + coalesce(p_generation_ms, 0),
         provider = coalesce(p_provider, provider),
         model = coalesce(p_model, model)
   where id = v_lesson_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_outline: write the outline (chapters as `pending`), set the lesson `building`, and insert
-- one `chapters` job per batch. Idempotent: does nothing if chapters already exist.
--
-- p_outline: { spokenLanguage, overview, chapters: [{ title, startSeconds, endSeconds }] }
-- p_batches: [{ positions: [int], startSeconds, endSeconds }]
-- Returns the inserted job ids.
-- ---------------------------------------------------------------------------

create or replace function public.save_outline(p_lesson_id uuid, p_outline jsonb, p_batches jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch jsonb;
  v_job_id uuid;
begin
  perform 1 from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'save_outline: lesson % not found', p_lesson_id using errcode = 'P0002';
  end if;
  if exists (select 1 from public.lesson_chapters where lesson_id = p_lesson_id) then
    return;
  end if;

  insert into public.lesson_chapters (lesson_id, position, status, title, start_seconds, end_seconds)
  select p_lesson_id, (c.ord - 1)::int, 'pending', c.value ->> 'title',
         (c.value ->> 'startSeconds')::int, (c.value ->> 'endSeconds')::int
    from jsonb_array_elements(p_outline -> 'chapters') with ordinality as c(value, ord);

  update public.lessons
     set spoken_language = p_outline ->> 'spokenLanguage',
         overview = p_outline ->> 'overview',
         status = 'building',
         error_code = null,
         chapters_total = jsonb_array_length(p_outline -> 'chapters'),
         chapters_ready = 0,
         chapters_failed = 0
   where id = p_lesson_id;

  for v_batch in select value from jsonb_array_elements(p_batches) loop
    insert into public.lesson_jobs (lesson_id, kind, payload, status)
    values (p_lesson_id, 'chapters', v_batch, 'queued')
    returning id into v_job_id;
    return next v_job_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: service_role only.
-- ---------------------------------------------------------------------------

revoke execute on function public.create_lesson(text, text, text, text, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.restart_lesson(uuid, text, text, jsonb, int) from public, anon, authenticated;
revoke execute on function public.retry_chapters(uuid, int) from public, anon, authenticated;
revoke execute on function public.claim_lesson_job(uuid, int) from public, anon, authenticated;
revoke execute on function public.dispatchable_jobs(int, uuid) from public, anon, authenticated;
revoke execute on function public.requeue_lesson_job(uuid, int) from public, anon, authenticated;
revoke execute on function public.fail_lesson_job(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.complete_lesson_job(uuid, int, int, int, text, text) from public, anon, authenticated;
revoke execute on function public.save_outline(uuid, jsonb, jsonb) from public, anon, authenticated;

grant execute on function public.create_lesson(text, text, text, text, uuid, text, jsonb) to service_role;
grant execute on function public.restart_lesson(uuid, text, text, jsonb, int) to service_role;
grant execute on function public.retry_chapters(uuid, int) to service_role;
grant execute on function public.claim_lesson_job(uuid, int) to service_role;
grant execute on function public.dispatchable_jobs(int, uuid) to service_role;
grant execute on function public.requeue_lesson_job(uuid, int) to service_role;
grant execute on function public.fail_lesson_job(uuid, text, int) to service_role;
grant execute on function public.complete_lesson_job(uuid, int, int, int, text, text) to service_role;
grant execute on function public.save_outline(uuid, jsonb, jsonb) to service_role;
