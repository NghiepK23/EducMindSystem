-- Chấm bài kiểm tra phía máy chủ, theo đúng quy tắc của bản prototype (index.html):
--   * Câu một lựa chọn, nhiều lựa chọn, đúng/sai: chấm tự động khi nộp, đúng hoàn toàn được đủ trọng số, còn lại 0.
--   * Câu trả lời ngắn, tự luận: chờ giáo viên chấm. Câu bỏ trống được 0 điểm ngay.
--   * Lượt làm chuyển GRADED khi mọi câu đã có điểm; tổng điểm = tổng điểm các câu.
--   * Điểm chính thức của học sinh là lượt đã chấm có tổng điểm cao nhất; bằng chứng học tập lấy từ lượt đó.
--     Điểm và trọng số của mỗi câu chia đều cho các mục tiêu gắn với câu đó.
--   * Hết giờ mà chưa nộp: hệ thống tự nộp các câu đã lưu, thời điểm nộp tính là lúc hết giờ.

-- Câu trả lời phải thuộc đúng bài kiểm tra; điểm từng câu nằm trong khoảng 0 đến trọng số của câu.
create function public.validate_submission_answer() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_weight numeric;
begin
  select aq.weight into v_weight
  from public.assessment_attempts a
  join public.assessment_questions aq on aq.assessment_id=a.assessment_id and aq.question_id=new.question_id
  where a.id=new.attempt_id;
  if v_weight is null then raise exception 'Question is not part of this assessment'; end if;
  if new.score is not null and (new.score<0 or new.score>v_weight) then
    raise exception 'Score must be between 0 and the question weight';
  end if;
  return new;
end $$;
create trigger educmind_answer_bounds before insert or update of attempt_id,question_id,score on public.submission_answers
  for each row execute function public.validate_submission_answer();

-- Chuẩn hóa đáp án để so sánh: một giá trị hoặc một mảng đều thành tập chữ thường đã sắp xếp,
-- nên 1, "1" và [1] bằng nhau; [2,0] và [0,2] bằng nhau.
create function public.answer_tokens(p jsonb) returns text[]
language sql immutable set search_path=public,pg_temp as $$
  select coalesce(array_agg(distinct x.t order by x.t),'{}'::text[])
  from (
    select lower(btrim(e.v #>> '{}')) as t
    from jsonb_array_elements(
      case when p is null or jsonb_typeof(p)='null' then '[]'::jsonb
           when jsonb_typeof(p)='array' then p
           else jsonb_build_array(p) end) as e(v)
    where jsonb_typeof(e.v)<>'null'
  ) x
  where x.t<>''
$$;

-- Tổng hợp trạng thái lượt làm từ điểm các câu: đủ điểm mọi câu -> GRADED kèm tổng điểm; thiếu -> SUBMITTED.
create function public.refresh_attempt_grade(p_attempt uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  att public.assessment_attempts%rowtype;
  v_total integer;
  v_scored integer;
  v_sum numeric;
begin
  select t.* into att from public.assessment_attempts t where t.id=p_attempt for update;
  if not found or att.status='IN_PROGRESS' then return; end if;
  select count(*),count(sa.score),coalesce(sum(sa.score),0) into v_total,v_scored,v_sum
  from public.assessment_questions aq
  left join public.submission_answers sa on sa.attempt_id=p_attempt and sa.question_id=aq.question_id
  where aq.assessment_id=att.assessment_id;
  if v_scored=v_total then
    if att.status<>'GRADED' or att.total_score is distinct from v_sum then
      perform public.educmind_write_attempt_state(p_attempt,'GRADED',att.submitted_at,now(),v_sum);
    end if;
  elsif att.status='GRADED' or att.total_score is not null then
    perform public.educmind_write_attempt_state(p_attempt,'SUBMITTED',att.submitted_at,null,null);
  end if;
end $$;

-- Chấm tự động một lượt đã nộp.
create function public.autograde_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  att public.assessment_attempts%rowtype;
  q record;
  v_blank boolean;
  v_score numeric;
begin
  select t.* into att from public.assessment_attempts t where t.id=p_attempt;
  if not found or att.status='IN_PROGRESS' then return; end if;
  for q in
    select aq.question_id,aq.weight,qu.kind,qu.correct_answer,sa.answer_content
    from public.assessment_questions aq
    join public.questions qu on qu.id=aq.question_id
    left join public.submission_answers sa on sa.attempt_id=p_attempt and sa.question_id=aq.question_id
    where aq.assessment_id=att.assessment_id
    order by aq.display_order
  loop
    v_blank := case
      when q.answer_content is null then true
      when jsonb_typeof(q.answer_content)='null' then true
      when jsonb_typeof(q.answer_content)='string' then btrim(q.answer_content #>> '{}')=''
      when jsonb_typeof(q.answer_content)='array' then jsonb_array_length(q.answer_content)=0
      else false end;
    if v_blank then
      v_score := 0;
    elsif q.kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE')
          and q.correct_answer is not null and jsonb_typeof(q.correct_answer)<>'null' then
      if public.answer_tokens(q.answer_content)=public.answer_tokens(q.correct_answer) then
        v_score := q.weight;
      else
        v_score := 0;
      end if;
    else
      continue;  -- câu tự luận / trả lời ngắn có nội dung, hoặc câu trắc nghiệm chưa có đáp án: chờ giáo viên chấm
    end if;
    perform public.educmind_write_answer_score(p_attempt,q.question_id,v_score);
  end loop;
  perform public.refresh_attempt_grade(p_attempt);
end $$;

-- Điểm một câu thay đổi (giáo viên chấm hoặc hệ thống chấm) -> tổng hợp lại lượt làm.
create function public.on_answer_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_attempt_grade(old.attempt_id);
    return null;
  end if;
  if tg_op='UPDATE' and new.score is not distinct from old.score then return null; end if;
  if tg_op='INSERT' and new.score is null then return null; end if;
  perform public.refresh_attempt_grade(new.attempt_id);
  return null;
end $$;
create trigger educmind_answer_change after insert or update of score or delete on public.submission_answers
  for each row execute function public.on_answer_change();

-- Gợi ý "làm lại bài kiểm tra": lượt đã chấm gần nhất dưới 65%, còn lượt, bài còn mở và học sinh có lỗ hổng
-- đang mở ở một mục tiêu của bài. Mỗi lượt đã chấm chỉ sinh tối đa một gợi ý.
create function public.sync_retake_recommendation(p_student uuid,p_assessment uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  c_retake_below constant numeric := 0.65;
  a record;
  v_last record;
  v_possible numeric;
  v_used integer;
  v_ratio numeric;
  v_objective uuid;
  v_reason text;
  v_live uuid;
  v_id uuid;
  v_ok boolean := false;
begin
  select e.id,e.title,e.max_attempts,e.status,e.deleted_at,e.close_at,e.course_id,c.class_id into a
  from public.assessments e join public.courses c on c.id=e.course_id
  where e.id=p_assessment;
  if not found then return; end if;
  select coalesce(sum(weight),0) into v_possible from public.assessment_questions where assessment_id=p_assessment;
  select count(*) into v_used from public.assessment_attempts where assessment_id=p_assessment and student_id=p_student;
  select t.id,t.total_score,t.graded_at into v_last
  from public.assessment_attempts t
  where t.assessment_id=p_assessment and t.student_id=p_student and t.status='GRADED' and t.total_score is not null
  order by t.attempt_number desc limit 1;
  if found and v_possible>0 then
    v_ratio := v_last.total_score/v_possible;
    select g.objective_id into v_objective
    from public.knowledge_gaps g
    left join public.mastery m on m.student_id=g.student_id and m.objective_id=g.objective_id
    where g.student_id=p_student and g.status='OPEN'
      and exists(select 1 from public.assessment_questions aq
                 join public.question_objectives qo on qo.question_id=aq.question_id
                 where aq.assessment_id=p_assessment and qo.objective_id=g.objective_id)
    order by m.mastery_score nulls last limit 1;
    v_ok := a.status='PUBLISHED' and a.deleted_at is null and now()<a.close_at
            and v_ratio<c_retake_below and v_used<a.max_attempts and v_objective is not null;
  end if;

  select x.id into v_live from public.recommendations x
  where x.student_id=p_student and x.assessment_id=p_assessment and x.kind='RETAKE_ASSESSMENT' and x.status in ('ACTIVE','ACCEPTED')
  order by x.created_at desc limit 1;

  if not v_ok then
    if v_live is not null then
      update public.recommendations set status='COMPLETED',responded_at=coalesce(responded_at,clock_timestamp())
      where student_id=p_student and assessment_id=p_assessment and kind='RETAKE_ASSESSMENT' and status in ('ACTIVE','ACCEPTED');
    end if;
    return;
  end if;

  v_reason := 'Lượt gần nhất '||round(v_ratio*100)||'% (dưới 65%), còn '||(a.max_attempts-v_used)||' lượt, có lỗ hổng đang mở';
  if v_live is not null then
    update public.recommendations set reason=v_reason,objective_id=v_objective
    where id=v_live and (reason is distinct from v_reason or objective_id is distinct from v_objective);
    return;
  end if;
  if exists(select 1 from public.recommendations x
            where x.student_id=p_student and x.assessment_id=p_assessment and x.kind='RETAKE_ASSESSMENT'
              and x.created_at>=v_last.graded_at) then
    return;
  end if;
  insert into public.recommendations(student_id,objective_id,assessment_id,kind,reason,status,created_at)
  values(p_student,v_objective,p_assessment,'RETAKE_ASSESSMENT',v_reason,'ACTIVE',clock_timestamp())
  returning id into v_id;
  perform public.notify_user(p_student,'NEW_RECOMMENDATION','Gợi ý học tập: Làm lại bài kiểm tra',
    a.title||'. '||v_reason||'.',
    jsonb_build_object('page','recommend','class_id',a.class_id,'course_id',a.course_id,'assessment_id',p_assessment,
                       'objective_id',v_objective,'recommendation_id',v_id,'kind','RETAKE_ASSESSMENT'));
end $$;

-- Bằng chứng học tập của một học sinh cho một bài kiểm tra, lấy từ lượt đã chấm có tổng điểm cao nhất.
create function public.sync_assessment_evidence(p_student uuid,p_assessment uuid,p_trigger_attempt uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_best uuid;
  r record;
begin
  select t.id into v_best
  from public.assessment_attempts t
  where t.assessment_id=p_assessment and t.student_id=p_student and t.status='GRADED' and t.total_score is not null
  order by t.total_score desc,t.graded_at desc nulls last,t.attempt_number desc limit 1;

  if v_best is null then
    perform public.clear_evidence('ASSESSMENT',p_assessment,p_student);
  else
    -- Mục tiêu không còn gắn với câu hỏi nào của bài: bỏ bằng chứng cũ.
    for r in
      delete from public.learning_evidence e
      where e.student_id=p_student and e.source_type='ASSESSMENT' and e.source_id=p_assessment
        and not exists(select 1 from public.assessment_questions aq
                       join public.question_objectives qo on qo.question_id=aq.question_id
                       where aq.assessment_id=p_assessment and qo.objective_id=e.objective_id)
      returning e.objective_id
    loop
      perform public.recalc_mastery(p_student,r.objective_id);
    end loop;
    for r in
      select qo.objective_id,
             sum(coalesce(sa.score,0)/n.cnt) as got,
             sum(aq.weight/n.cnt) as possible
      from public.assessment_questions aq
      join public.question_objectives qo on qo.question_id=aq.question_id
      join lateral (select count(*)::numeric as cnt from public.question_objectives x where x.question_id=aq.question_id) n on true
      left join public.submission_answers sa on sa.attempt_id=v_best and sa.question_id=aq.question_id
      where aq.assessment_id=p_assessment
      group by qo.objective_id
    loop
      perform public.record_evidence(p_student,r.objective_id,'ASSESSMENT',p_assessment,r.got/r.possible,
                                     v_best is not distinct from p_trigger_attempt);
    end loop;
  end if;
  perform public.sync_retake_recommendation(p_student,p_assessment);
end $$;

-- Vòng đời lượt làm: nộp -> chấm tự động -> (giáo viên chấm phần còn lại) -> bằng chứng, gợi ý, thông báo.
create function public.on_attempt_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a record;
  v_status public.assessment_state;
  v_possible numeric;
  v_group text;
begin
  if tg_op='DELETE' then
    perform public.sync_assessment_evidence(old.student_id,old.assessment_id,null);
    return null;
  end if;
  v_group := 'assessment:'||new.assessment_id;

  if tg_op='UPDATE' and old.status='IN_PROGRESS' and new.status='SUBMITTED' then
    -- Vừa nộp: gợi ý "làm lại bài kiểm tra" coi như đã thực hiện; chấm tự động.
    update public.recommendations set status='COMPLETED',responded_at=coalesce(responded_at,clock_timestamp())
    where student_id=new.student_id and assessment_id=new.assessment_id and kind='RETAKE_ASSESSMENT' and status in ('ACTIVE','ACCEPTED');
    perform public.autograde_attempt(new.id);
    select t.status into v_status from public.assessment_attempts t where t.id=new.id;
    if v_status='SUBMITTED' then
      -- Còn câu chờ giáo viên chấm.
      select e.title,e.course_id,c.class_id,k.owner_teacher_id,k.name as class_name into a
      from public.assessments e
      join public.courses c on c.id=e.course_id
      join public.classes k on k.id=c.class_id
      where e.id=new.assessment_id;
      perform public.notify_grouped(a.owner_teacher_id,'NEW_ASSESSMENT_ATTEMPT_SUBMITTED',v_group,
        'Lượt kiểm tra chờ chấm: '||a.title,'lượt kiểm tra chờ chấm: '||a.title,'Lớp '||a.class_name,
        jsonb_build_object('page','grading','class_id',a.class_id,'course_id',a.course_id,'assessment_id',new.assessment_id));
    end if;
    return null;
  end if;

  if tg_op='UPDATE' and new.status is not distinct from old.status and new.total_score is not distinct from old.total_score then
    return null;
  end if;
  if new.status<>'GRADED' and not (tg_op='UPDATE' and old.status='GRADED') then return null; end if;

  perform public.sync_assessment_evidence(new.student_id,new.assessment_id,new.id);

  if new.status='GRADED' then
    select e.title,e.course_id,c.class_id,k.owner_teacher_id into a
    from public.assessments e
    join public.courses c on c.id=e.course_id
    join public.classes k on k.id=c.class_id
    where e.id=new.assessment_id;
    -- Học sinh tự nộp và được chấm ngay thì không cần thông báo; chỉ báo khi người khác hoàn tất việc chấm.
    if auth.uid() is distinct from new.student_id then
      select coalesce(sum(weight),0) into v_possible from public.assessment_questions where assessment_id=new.assessment_id;
      perform public.notify_grouped(new.student_id,'ASSESSMENT_GRADED','attempt:'||new.id,
        case when tg_op='UPDATE' and old.status='GRADED' then 'Điểm bài kiểm tra đã được cập nhật: ' else 'Bài kiểm tra đã có điểm: ' end||a.title,
        null,'Điểm: '||trim_scale(new.total_score)||'/'||trim_scale(v_possible),
        jsonb_build_object('page','results','class_id',a.class_id,'course_id',a.course_id,'assessment_id',new.assessment_id,'attempt_id',new.id));
    end if;
    -- Không còn lượt nào chờ chấm: đánh dấu đã đọc thông báo "chờ chấm" của giáo viên.
    if not exists(select 1 from public.assessment_attempts t where t.assessment_id=new.assessment_id and t.status='SUBMITTED') then
      update public.notifications set is_read=true,read_at=now()
      where user_id=a.owner_teacher_id and type='NEW_ASSESSMENT_ATTEMPT_SUBMITTED' and not is_read and payload->>'group'=v_group;
    end if;
  end if;
  return null;
end $$;
create trigger educmind_attempt_change after insert or update or delete on public.assessment_attempts
  for each row execute function public.on_attempt_change();

-- Bắt đầu hoặc làm tiếp một lượt. Lượt cũ đã hết giờ được tự nộp trước.
-- Trả về status: STARTED | RESUMED | CLOSED | NO_ATTEMPTS_LEFT, kèm lượt làm và thời điểm hết giờ.
create function public.start_assessment_attempt(p_assessment uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  att public.assessment_attempts%rowtype;
  v_end timestamptz;
  v_max integer;
  v_used integer;
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
  if v_used>=v_max then
    return jsonb_build_object('status','NO_ATTEMPTS_LEFT');
  end if;
  insert into public.assessment_attempts(assessment_id,student_id,attempt_number)
  values(p_assessment,auth.uid(),v_used+1)
  returning * into att;
  select least(att.started_at+make_interval(mins=>e.duration_minutes),e.close_at) into v_end
  from public.assessments e where e.id=p_assessment;
  return jsonb_build_object('status','STARTED','attempt',to_jsonb(att),'ends_at',v_end);
end $$;

-- Nộp một lượt đang làm. Dùng được cả khi đã hết giờ: chỉ các câu đã lưu đúng hạn được tính.
create function public.submit_assessment_attempt(p_attempt uuid) returns public.assessment_attempts
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  att public.assessment_attempts%rowtype;
  v_end timestamptz;
begin
  select t.* into att from public.assessment_attempts t where t.id=p_attempt and t.student_id=auth.uid() for update;
  if not found then raise exception 'Attempt not found'; end if;
  if att.status='IN_PROGRESS' then
    select least(att.started_at+make_interval(mins=>e.duration_minutes),e.close_at) into v_end
    from public.assessments e where e.id=att.assessment_id;
    perform public.educmind_write_attempt_state(p_attempt,'SUBMITTED',least(now(),v_end),null,null);
    select t.* into att from public.assessment_attempts t where t.id=p_attempt;
  end if;
  return att;
end $$;

-- Tự nộp các lượt đã hết giờ: của chính học sinh đang gọi, hoặc của các bài kiểm tra giáo viên đang gọi quản lý.
create function public.finalize_expired_attempts(p_assessment uuid default null) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select t.id,least(t.started_at+make_interval(mins=>e.duration_minutes),e.close_at) as ends_at
    from public.assessment_attempts t
    join public.assessments e on e.id=t.assessment_id
    where t.status='IN_PROGRESS'
      and (p_assessment is null or t.assessment_id=p_assessment)
      and now()>least(t.started_at+make_interval(mins=>e.duration_minutes),e.close_at)
      and (auth.uid() is null or t.student_id=auth.uid() or public.can_manage_course(e.course_id))
    for update of t
  loop
    perform public.educmind_write_attempt_state(r.id,'SUBMITTED',r.ends_at,null,null);
    v_count := v_count+1;
  end loop;
  return v_count;
end $$;

-- Chấm lại phần trắc nghiệm của mọi lượt đã nộp (dùng sau khi giáo viên sửa đáp án).
create function public.regrade_assessment(p_assessment uuid) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  r record;
  v_count integer := 0;
begin
  if not public.can_manage_assessment(p_assessment) then raise exception 'Assessment not found'; end if;
  for r in select t.id from public.assessment_attempts t
           where t.assessment_id=p_assessment and t.status<>'IN_PROGRESS'
           order by t.student_id,t.attempt_number loop
    perform public.autograde_attempt(r.id);
    v_count := v_count+1;
  end loop;
  return v_count;
end $$;

-- Xem lại một lượt đã nộp: câu hỏi, câu trả lời, điểm và nhận xét. Không trả về đáp án đúng.
create function public.student_attempt_review(p_attempt uuid)
returns table(question_id uuid,content text,kind text,options jsonb,weight numeric,display_order integer,answer_content jsonb,score numeric,feedback text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not exists(
    select 1 from public.assessment_attempts t
    where t.id=p_attempt and t.status<>'IN_PROGRESS'
      and (t.student_id=auth.uid() or public.can_manage_assessment(t.assessment_id))
  ) then
    raise exception 'Attempt not found';
  end if;
  return query
    select q.id,q.content,q.kind,q.options,aq.weight,aq.display_order,sa.answer_content,sa.score,sa.feedback
    from public.assessment_attempts t
    join public.assessment_questions aq on aq.assessment_id=t.assessment_id
    join public.questions q on q.id=aq.question_id
    left join public.submission_answers sa on sa.attempt_id=t.id and sa.question_id=aq.question_id
    where t.id=p_attempt
    order by aq.display_order;
end $$;

-- Sau lượt làm đầu tiên, danh sách câu hỏi và trọng số của bài kiểm tra bị khóa (chỉ còn đổi được thứ tự hiển thị),
-- để điểm các lượt luôn so sánh được với nhau.
create function public.guard_assessment_questions_lock() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.assessment_id=old.assessment_id and new.question_id=old.question_id and new.weight=old.weight then
    return new;
  end if;
  if tg_op in ('UPDATE','DELETE') and exists(select 1 from public.assessment_attempts t where t.assessment_id=old.assessment_id) then
    raise exception 'Assessment questions are locked after the first attempt';
  end if;
  if tg_op in ('INSERT','UPDATE') and exists(select 1 from public.assessment_attempts t where t.assessment_id=new.assessment_id) then
    raise exception 'Assessment questions are locked after the first attempt';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger educmind_assessment_questions_lock before insert or update or delete on public.assessment_questions
  for each row execute function public.guard_assessment_questions_lock();

-- Gắn / gỡ mục tiêu của câu hỏi sau khi đã có lượt được chấm -> đồng bộ lại bằng chứng.
create function public.sync_question_objective_link() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_old uuid;
  v_new uuid;
  r record;
begin
  if tg_op<>'INSERT' then v_old := old.question_id; end if;
  if tg_op<>'DELETE' then v_new := new.question_id; end if;
  for r in
    select distinct t.student_id,t.assessment_id
    from public.assessment_questions aq
    join public.assessment_attempts t on t.assessment_id=aq.assessment_id and t.status='GRADED'
    where aq.question_id in (v_old,v_new)
  loop
    perform public.sync_assessment_evidence(r.student_id,r.assessment_id,null);
  end loop;
  return null;
end $$;
create trigger educmind_question_objective_sync after insert or update or delete on public.question_objectives
  for each row execute function public.sync_question_objective_link();

revoke all on function
  public.validate_submission_answer(),
  public.answer_tokens(jsonb),
  public.refresh_attempt_grade(uuid),
  public.autograde_attempt(uuid),
  public.on_answer_change(),
  public.sync_retake_recommendation(uuid,uuid),
  public.sync_assessment_evidence(uuid,uuid,uuid),
  public.on_attempt_change(),
  public.guard_assessment_questions_lock(),
  public.sync_question_objective_link()
from public,anon,authenticated;
revoke all on function
  public.start_assessment_attempt(uuid),
  public.submit_assessment_attempt(uuid),
  public.finalize_expired_attempts(uuid),
  public.regrade_assessment(uuid),
  public.student_attempt_review(uuid)
from public,anon;
grant execute on function
  public.start_assessment_attempt(uuid),
  public.submit_assessment_attempt(uuid),
  public.finalize_expired_attempts(uuid),
  public.regrade_assessment(uuid),
  public.student_attempt_review(uuid)
to authenticated;
