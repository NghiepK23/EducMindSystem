-- US-G04/US-T11/US-T13/US-T12/US-S07/US-H01: hoàn thiện các guard còn thiếu ở backend.

alter table public.assignment_submissions
  add column if not exists deleted_at timestamptz;

-- Mã mục tiêu đã có bằng chứng không được đổi; mô tả vẫn được sửa.
create or replace function public.guard_learning_objective_code()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.code is distinct from old.code
     and exists(select 1 from public.learning_evidence e where e.objective_id=old.id) then
    raise exception 'OBJECTIVE_CODE_LOCKED_EVIDENCE' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists educmind_learning_objective_code_guard on public.learning_objectives;
create trigger educmind_learning_objective_code_guard
before update of code on public.learning_objectives
for each row execute function public.guard_learning_objective_code();

-- Không gỡ xuất bản bài kiểm tra đã có ít nhất một lượt làm.
create or replace function public.guard_assessment_unpublish()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.status='PUBLISHED' and new.status='DRAFT'
     and exists(select 1 from public.assessment_attempts t where t.assessment_id=old.id) then
    raise exception 'ASSESSMENT_HAS_ATTEMPTS' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists educmind_assessment_unpublish_guard on public.assessments;
create trigger educmind_assessment_unpublish_guard
before update of status on public.assessments
for each row execute function public.guard_assessment_unpublish();

-- Soft-delete chủ đề: ẩn cả chủ đề và bài học con; giữ bài tập, bài kiểm tra, điểm và bằng chứng.
create or replace function public.soft_delete_topic(p_topic uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_course uuid;
begin
  select course_id into v_course
  from public.course_topics
  where id=p_topic and deleted_at is null
  for update;
  if not found or not public.can_manage_course(v_course) then
    raise exception 'TOPIC_UNAVAILABLE' using errcode='42501';
  end if;

  update public.course_topics
  set deleted_at=now()
  where id=p_topic and deleted_at is null;

  update public.lessons
  set deleted_at=now()
  where topic_id=p_topic and course_id=v_course and deleted_at is null;
end $$;

revoke all on function public.soft_delete_topic(uuid) from public,anon,authenticated;
grant execute on function public.soft_delete_topic(uuid) to authenticated;

create or replace function public.restore_topic(p_topic uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_course uuid;
begin
  select course_id into v_course
  from public.course_topics
  where id=p_topic and deleted_at is not null
  for update;
  if not found or not public.can_manage_course(v_course) then
    raise exception 'TOPIC_UNAVAILABLE' using errcode='42501';
  end if;

  update public.course_topics set deleted_at=null where id=p_topic;
  update public.lessons set deleted_at=null
  where topic_id=p_topic and course_id=v_course and deleted_at is not null;
end $$;

revoke all on function public.restore_topic(uuid) from public,anon,authenticated;
grant execute on function public.restore_topic(uuid) to authenticated;

-- Xóa mềm bài nộp chưa chấm và chưa quá cửa nộp/nộp lại.
create or replace function public.delete_ungraded_submission(p_submission uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v public.assignment_submissions%rowtype;
begin
  select s.* into v
  from public.assignment_submissions s
  where s.id=p_submission and s.deleted_at is null
  for update;
  if not found then raise exception 'SUBMISSION_UNAVAILABLE' using errcode='P0002'; end if;
  if v.student_id<>auth.uid() or public.current_app_role()<>'STUDENT' then
    raise exception 'SUBMISSION_NOT_OWNER' using errcode='42501';
  end if;
  if v.score is not null or v.graded_at is not null then
    raise exception 'SUBMISSION_ALREADY_GRADED' using errcode='23514';
  end if;
  if not public.student_can_submit(v.assignment_id) then
    raise exception 'SUBMISSION_WINDOW_CLOSED' using errcode='23514';
  end if;

  update public.assignment_submissions
  set deleted_at=now(),is_edited=true
  where id=p_submission;

  perform public.clear_evidence('ASSIGNMENT',v.assignment_id,v.student_id);
end $$;

revoke all on function public.delete_ungraded_submission(uuid) from public,anon,authenticated;
grant execute on function public.delete_ungraded_submission(uuid) to authenticated;

-- Học sinh đọc dữ liệu xóa mềm chỉ để xem lại kết quả còn lưu.
drop policy if exists assignment_deleted_read on public.assignments;
create policy assignment_deleted_read on public.assignments
for select to authenticated
using(deleted_at is not null and public.can_access_course(course_id));

drop policy if exists assessment_deleted_read on public.assessments;
create policy assessment_deleted_read on public.assessments
for select to authenticated
using(deleted_at is not null and public.can_access_course(course_id));

-- Tách lỗi phân tích khỏi giao dịch tính toán để một cặp lỗi không chặn các cặp khác.
create table if not exists public.analytics_errors(
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  objective_id uuid not null references public.learning_objectives(id),
  error_message text not null,
  attempt_count integer not null default 1,
  first_at timestamptz not null default clock_timestamp(),
  last_at timestamptz not null default clock_timestamp(),
  fixed_at timestamptz,
  unique(student_id,objective_id)
);

alter table public.analytics_errors enable row level security;
grant select on public.analytics_errors to authenticated;
drop policy if exists analytics_errors_teacher_read on public.analytics_errors;
create policy analytics_errors_teacher_read on public.analytics_errors
for select to authenticated
using(exists(
  select 1
  from public.learning_objectives o
  join public.lessons l on l.id=o.lesson_id
  join public.courses c on c.id=l.course_id
  where o.id=objective_id and public.can_manage_class(c.class_id)
));

alter function public.recalc_mastery(uuid,uuid) rename to recalc_mastery_core;

create or replace function public.try_recalc_mastery(p_student uuid,p_objective uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_message text;
begin
  begin
    perform public.recalc_mastery_core(p_student,p_objective);
  exception when others then
    get stacked diagnostics v_message=message_text;
    insert into public.analytics_errors(student_id,objective_id,error_message,attempt_count,first_at,last_at,fixed_at)
    values(p_student,p_objective,v_message,1,clock_timestamp(),clock_timestamp(),null)
    on conflict(student_id,objective_id) do update
      set error_message=excluded.error_message,
          attempt_count=public.analytics_errors.attempt_count+1,
          last_at=clock_timestamp(),
          fixed_at=null;
    return;
  end;

  update public.analytics_errors
  set fixed_at=clock_timestamp()
  where student_id=p_student and objective_id=p_objective and fixed_at is null;
end $$;

create or replace function public.recalc_mastery(p_student uuid,p_objective uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.try_recalc_mastery(p_student,p_objective);
end $$;

revoke all on function public.recalc_mastery_core(uuid,uuid) from public,anon,authenticated;
revoke all on function public.try_recalc_mastery(uuid,uuid) from public,anon,authenticated;
revoke all on function public.recalc_mastery(uuid,uuid) from public,anon,authenticated;
