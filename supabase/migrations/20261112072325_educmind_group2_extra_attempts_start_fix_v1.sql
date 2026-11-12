-- Nhóm 2 (bổ sung): RPC start_assessment_attempt phải tính cả lượt làm bù mà giáo viên đã cấp
-- (bảng assessment_extra_attempts), giống giới hạn trong protect_student_grades.
create or replace function public.start_assessment_attempt(p_assessment uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  att public.assessment_attempts%rowtype;
  v_end timestamptz;
  v_max integer;
  v_used integer;
  v_extra integer;
begin
  if auth.uid() is null or public.current_app_role()<>'STUDENT' then
    raise exception 'Only students can take an assessment';
  end if;
  select t.* into att from public.assessment_attempts t
  where t.assessment_id=p_assessment and t.student_id=auth.uid() and t.status='IN_PROGRESS' for update;
  if found then
    select least(att.started_at+make_interval(mins=>e.duration_minutes),e.close_at) into v_end
    from public.assessments e where e.id=p_assessment;
    if now()<=v_end then
      return jsonb_build_object('status','RESUMED','attempt',to_jsonb(att),'ends_at',v_end);
    end if;
    perform public.educmind_write_attempt_state(att.id,'SUBMITTED',v_end,null,null);
  end if;
  if not public.student_can_take(p_assessment) then
    return jsonb_build_object('status','CLOSED');
  end if;
  select e.max_attempts into v_max from public.assessments e where e.id=p_assessment for update;
  select count(*) into v_used from public.assessment_attempts t where t.assessment_id=p_assessment and t.student_id=auth.uid();
  select coalesce(sum(extra),0) into v_extra from public.assessment_extra_attempts x
  where x.assessment_id=p_assessment and x.student_id=auth.uid();
  if v_used>=v_max+v_extra then
    return jsonb_build_object('status','NO_ATTEMPTS_LEFT');
  end if;
  insert into public.assessment_attempts(assessment_id,student_id,attempt_number)
  values(p_assessment,auth.uid(),v_used+1)
  returning * into att;
  select least(att.started_at+make_interval(mins=>e.duration_minutes),e.close_at) into v_end
  from public.assessments e where e.id=p_assessment;
  return jsonb_build_object('status','STARTED','attempt',to_jsonb(att),'ends_at',v_end);
end $$;
