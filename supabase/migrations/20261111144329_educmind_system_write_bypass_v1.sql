-- Cờ "ghi hệ thống" cho việc chấm tự động.
-- Ba trigger bảo vệ hiện có chặn mọi thay đổi điểm khi người gọi là học sinh. Khi học sinh nộp bài kiểm tra,
-- chính máy chủ phải ghi điểm câu trắc nghiệm và tổng điểm trong cùng giao dịch đó, nên cần một lối đi riêng:
--   * Chỉ hai hàm educmind_write_* bên dưới bật cờ, ghi đúng một câu lệnh, rồi trả cờ về giá trị cũ.
--   * Người dùng không gọi được hai hàm này (đã thu quyền EXECUTE) và không đặt được biến cấu hình qua API.
--   * Ba trigger bảo vệ giữ nguyên toàn bộ nội dung, chỉ thêm một dòng bỏ qua khi cờ đang bật.

create function public.educmind_is_system() returns boolean
language sql stable set search_path=public,pg_temp as $$
  select coalesce(current_setting('educmind.system_write',true),'')='on'
$$;

create or replace function public.guard_assessment_answer_window() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_end timestamptz;
begin
  if public.educmind_is_system() then return new; end if;
  if auth.uid() is not null and public.current_app_role()='STUDENT' then
    select least(a.started_at+make_interval(mins=>e.duration_minutes),e.close_at) into v_end
    from public.assessment_attempts a join public.assessments e on e.id=a.assessment_id
    where a.id=new.attempt_id and a.student_id=auth.uid() and a.status='IN_PROGRESS';
    if v_end is null or now()>v_end then raise exception 'Assessment time window has ended'; end if;
  end if;
  return new;
end $function$;

create or replace function public.guard_student_submission_state() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_end timestamptz;
begin
  if public.educmind_is_system() then return new; end if;
  if auth.uid() is null or public.current_app_role()<>'STUDENT' then return new; end if;
  if tg_table_name='assessment_attempts' and tg_op='UPDATE' then
    if old.student_id<>auth.uid() or old.status<>'IN_PROGRESS' then raise exception 'Submitted attempt is locked'; end if;
    if new.started_at is distinct from old.started_at or new.total_score is distinct from old.total_score
       or new.graded_at is distinct from old.graded_at then
      raise exception 'Attempt timestamps and grade are protected';
    end if;
    if new.status='SUBMITTED' then
      select least(old.started_at+make_interval(mins=>a.duration_minutes),a.close_at) into v_end
      from public.assessments a where a.id=old.assessment_id;
      if now()>v_end then raise exception 'Assessment time window has ended'; end if;
      new.submitted_at=now();
    elsif new.submitted_at is distinct from old.submitted_at then
      raise exception 'Submission time is server controlled';
    end if;
  end if;
  if tg_table_name='assignment_submissions' and tg_op='UPDATE' then
    if old.student_id<>auth.uid() or new.status is distinct from old.status
       or new.submitted_at is distinct from old.submitted_at or new.graded_at is distinct from old.graded_at
       or new.graded_by is distinct from old.graded_by then
      raise exception 'Submission state and timestamps cannot be changed by students';
    end if;
    if new.text_content is distinct from old.text_content or new.storage_path is distinct from old.storage_path then
      new.is_edited=true;
    end if;
  end if;
  return new;
end $function$;

create or replace function public.protect_student_grades() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_max integer; v_count integer;
begin
  if public.educmind_is_system() then return new; end if;
  if auth.uid() is null or public.current_app_role()<>'STUDENT' then return new; end if;
  if tg_table_name='assessment_attempts' then
    if tg_op='INSERT' then
      if new.student_id<>auth.uid() then raise exception 'Attempt owner must be the signed-in student'; end if;
      select max_attempts into v_max from public.assessments
      where id=new.assessment_id and status='PUBLISHED' and deleted_at is null for update;
      if v_max is null then raise exception 'Assessment unavailable'; end if;
      select count(*) into v_count from public.assessment_attempts
      where assessment_id=new.assessment_id and student_id=auth.uid();
      if v_count>=v_max or new.attempt_number<>v_count+1 then
        raise exception 'Maximum attempts reached or attempt number invalid';
      end if;
      if new.status<>'IN_PROGRESS' or new.total_score is not null or new.graded_at is not null then
        raise exception 'Students can only start an ungraded attempt';
      end if;
      return new;
    end if;
    if new.total_score is distinct from old.total_score or new.graded_at is distinct from old.graded_at
       or new.student_id is distinct from old.student_id or new.assessment_id is distinct from old.assessment_id
       or new.attempt_number is distinct from old.attempt_number then
      raise exception 'Students cannot change grades or attempt ownership';
    end if;
  end if;
  if tg_table_name='submission_answers' then
    if tg_op='INSERT' then
      if new.score is not null or new.graded_by is not null or new.graded_at is not null or new.feedback<>'' then
        raise exception 'Students cannot submit grading fields';
      end if;
      return new;
    end if;
    if new.score is distinct from old.score or new.feedback is distinct from old.feedback
       or new.graded_by is distinct from old.graded_by or new.graded_at is distinct from old.graded_at then
      raise exception 'Students cannot change grades';
    end if;
  end if;
  if tg_table_name='assignment_submissions' then
    if tg_op='INSERT' then
      if new.student_id<>auth.uid() or new.score is not null or new.feedback is not null
         or new.graded_by is not null or new.graded_at is not null then
        raise exception 'Students cannot submit grading fields or another student’s work';
      end if;
      return new;
    end if;
    if new.student_id is distinct from old.student_id or new.assignment_id is distinct from old.assignment_id
       or new.score is distinct from old.score or new.feedback is distinct from old.feedback
       or new.graded_by is distinct from old.graded_by or new.graded_at is distinct from old.graded_at then
      raise exception 'Students cannot change grades or submission ownership';
    end if;
  end if;
  return new;
end $function$;

-- Tự kiểm tra: bỏ khoảng trắng và bỏ dòng bỏ qua mới thêm thì ba hàm phải trùng từng ký tự với bản trước đó.
-- Nếu lệch, migration dừng và không thay đổi gì.
do $check$
declare
  v_bad text;
begin
  select string_agg(p.proname,', ') into v_bad
  from pg_proc p
  join (values
    ('guard_assessment_answer_window','a2cbc46ba9b80a37d154e42f27e9752c'),
    ('guard_student_submission_state','a80abec8085aee80b428f87f93f9e475'),
    ('protect_student_grades','5a621199d684bd7907acde5302c5fde2')
  ) as e(name,body_md5) on e.name=p.proname
  where p.pronamespace='public'::regnamespace
    and md5(replace(regexp_replace(p.prosrc,'\s+','','g'),'ifpublic.educmind_is_system()thenreturnnew;endif;',''))<>e.body_md5;
  if v_bad is not null then
    raise exception 'Guard functions differ from the previous version beyond the system bypass: %',v_bad;
  end if;
end $check$;

-- Hai lối ghi duy nhất của hệ thống vào bảng có trigger bảo vệ.
create function public.educmind_write_attempt_state(p_attempt uuid,p_status public.assessment_state,p_submitted_at timestamptz,p_graded_at timestamptz,p_total numeric) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev text := coalesce(current_setting('educmind.system_write',true),'');
begin
  perform set_config('educmind.system_write','on',true);
  update public.assessment_attempts
  set status=p_status,submitted_at=p_submitted_at,graded_at=p_graded_at,total_score=p_total
  where id=p_attempt;
  perform set_config('educmind.system_write',v_prev,true);
end $$;

create function public.educmind_write_answer_score(p_attempt uuid,p_question uuid,p_score numeric) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev text := coalesce(current_setting('educmind.system_write',true),'');
begin
  perform set_config('educmind.system_write','on',true);
  insert into public.submission_answers as sa(attempt_id,question_id,answer_content,score,graded_at)
  values(p_attempt,p_question,null,p_score,now())
  on conflict(attempt_id,question_id) do update
    set score=excluded.score,graded_at=excluded.graded_at,graded_by=null
    where sa.score is distinct from excluded.score;
  perform set_config('educmind.system_write',v_prev,true);
end $$;

revoke all on function
  public.educmind_is_system(),
  public.educmind_write_attempt_state(uuid,public.assessment_state,timestamptz,timestamptz,numeric),
  public.educmind_write_answer_score(uuid,uuid,numeric)
from public,anon,authenticated;
