-- Sapience — bring your own key (Section 4.5.4, P1).
--
-- A lesson started by a student with their own AI key runs its jobs with that key. The first job
-- records whose key to use (`lesson_jobs.byok_user_id`, already in the schema); chapter jobs
-- created by save_outline inherit it while the outline job that creates them is still running.
-- Chapter retries started later (possibly by another student) fall back to the app's key.

-- create_lesson / restart_lesson gain `p_byok_user_id` (default null). Drop the old signatures
-- first so there is exactly one function of each name.
drop function if exists public.create_lesson(text, text, text, text, uuid, text, jsonb);
drop function if exists public.restart_lesson(uuid, text, text, jsonb, int);

create function public.create_lesson(
  p_youtube_video_id text,
  p_output_language text,
  p_prompt_version text,
  p_source text,
  p_created_by uuid,
  p_job_kind text,
  p_job_payload jsonb,
  p_byok_user_id uuid default null
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

  insert into public.lesson_jobs (lesson_id, kind, payload, status, byok_user_id)
  values (v_lesson_id, p_job_kind, coalesce(p_job_payload, '{}'::jsonb), 'queued', p_byok_user_id)
  returning id into v_job_id;

  return query select v_lesson_id, true, v_job_id;
end;
$$;

create function public.restart_lesson(
  p_lesson_id uuid,
  p_source text,
  p_job_kind text,
  p_job_payload jsonb,
  p_min_age_seconds int,
  p_byok_user_id uuid default null
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

  insert into public.lesson_jobs (lesson_id, kind, payload, status, byok_user_id)
  values (p_lesson_id, p_job_kind, coalesce(p_job_payload, '{}'::jsonb), 'queued', p_byok_user_id)
  returning id into v_job_id;
  return v_job_id;
end;
$$;

revoke execute on function public.create_lesson(text, text, text, text, uuid, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.restart_lesson(uuid, text, text, jsonb, int, uuid) from public, anon, authenticated;
grant execute on function public.create_lesson(text, text, text, text, uuid, text, jsonb, uuid) to service_role;
grant execute on function public.restart_lesson(uuid, text, text, jsonb, int, uuid) to service_role;

-- Chapter jobs inherit the key owner from the lesson's running outline/transcript job.
create function public.lesson_jobs_inherit_byok()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'chapters' and new.byok_user_id is null then
    select j.byok_user_id into new.byok_user_id
      from public.lesson_jobs j
     where j.lesson_id = new.lesson_id
       and j.kind <> 'chapters'
       and j.status = 'running'
     order by j.created_at desc
     limit 1;
  end if;
  return new;
end;
$$;

revoke execute on function public.lesson_jobs_inherit_byok() from public, anon, authenticated;

create trigger lesson_jobs_inherit_byok
  before insert on public.lesson_jobs
  for each row execute function public.lesson_jobs_inherit_byok();
