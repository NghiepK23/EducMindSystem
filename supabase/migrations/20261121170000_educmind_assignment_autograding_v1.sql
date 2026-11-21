-- Chấm tự động các câu có đáp án cấu hình sẵn trong bài tập và bài kiểm tra.
-- Bài tập dùng điểm riêng từng câu; câu trả lời ngắn/tự luận vẫn chờ giáo viên.

alter table public.assignment_questions add column weight numeric(7,2) not null default 0;
alter table public.assignment_questions add constraint assignment_questions_weight_nonnegative check (weight >= 0);

alter table public.assignment_submission_answers
  add column score numeric(7,2),
  add column feedback text not null default '',
  add column graded_by uuid references public.profiles(id),
  add column graded_at timestamptz;
alter table public.assignment_submission_answers
  add constraint assignment_submission_answers_score_nonnegative check (score is null or score >= 0);

alter table public.assignment_submissions
  add column question_grading_enabled boolean not null default false;

create function public.rebalance_assignment_question_weights(p_assignment uuid, p_max_score numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_count integer;
  v_total_cents integer;
  v_base integer;
  v_remainder integer;
  v_index integer := 0;
  q record;
begin
  select count(*) into v_count from public.assignment_questions where assignment_id=p_assignment;
  if v_count=0 then return; end if;
  v_total_cents := round(p_max_score*100)::integer;
  v_base := v_total_cents / v_count;
  v_remainder := mod(v_total_cents,v_count);
  for q in
    select question_id from public.assignment_questions
    where assignment_id=p_assignment order by display_order,question_id
  loop
    v_index := v_index+1;
    update public.assignment_questions
    set weight=(v_base+case when v_index<=v_remainder then 1 else 0 end)::numeric/100
    where assignment_id=p_assignment and question_id=q.question_id;
  end loop;
end $$;

alter table public.assignment_questions disable trigger assignment_question_guard;
do $$
declare
  q record;
begin
  for q in
    select distinct a.id,a.max_score
    from public.assignments a
    join public.assignment_questions aq on aq.assignment_id=a.id
  loop
    perform public.rebalance_assignment_question_weights(q.id,q.max_score);
  end loop;
end $$;
alter table public.assignment_questions enable trigger assignment_question_guard;

create function public.rebalance_assignment_questions_after_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_assignment uuid;
  v_max_score numeric;
begin
  v_assignment := case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
  select max_score into v_max_score from public.assignments where id=v_assignment;
  if v_max_score is not null then
    perform public.rebalance_assignment_question_weights(v_assignment,v_max_score);
  end if;
  return null;
end $$;
create trigger assignment_question_weights_rebalance
  after insert or delete on public.assignment_questions
  for each row execute function public.rebalance_assignment_questions_after_change();

create function public.rebalance_assignment_weights_on_max_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.max_score is distinct from old.max_score then
    if exists(select 1 from public.assignment_submissions s where s.assignment_id=old.id) then
      raise exception 'Assignment maximum score is locked after the first submission';
    end if;
    perform public.rebalance_assignment_question_weights(new.id,new.max_score);
  end if;
  return new;
end $$;
create trigger assignment_max_score_rebalance
  before update of max_score on public.assignments
  for each row execute function public.rebalance_assignment_weights_on_max_change();

create or replace function public.guard_assignment_publication() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='PUBLISHED' then
    if coalesce(trim(new.description),'')=''
       and not exists(select 1 from public.assignment_questions aq where aq.assignment_id=new.id) then
      raise exception 'Assignment needs questions or instructions before publication';
    end if;
    if exists(select 1 from public.assignment_questions aq where aq.assignment_id=new.id)
       and (select coalesce(sum(aq.weight),0) from public.assignment_questions aq where aq.assignment_id=new.id)<>new.max_score then
      raise exception 'Assignment question weights must add up to the maximum score';
    end if;
    if exists(
      select 1 from public.assignment_questions aq
      join public.questions q on q.id=aq.question_id
      where aq.assignment_id=new.id
        and q.kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING')
        and (
          q.correct_answer is null or jsonb_typeof(q.correct_answer)='null'
          or case
            when q.kind='TRUE_FALSE' then jsonb_typeof(q.correct_answer)<>'boolean'
            when q.kind='SINGLE_CHOICE' then jsonb_typeof(q.correct_answer)<>'number'
            when q.kind in ('MULTIPLE_CHOICE','FILL_IN_BLANK','MATCHING') then
              case when jsonb_typeof(q.correct_answer)='array' then jsonb_array_length(q.correct_answer)=0 else true end
            else false
          end
        )
    ) then
      raise exception 'Every automatically graded question needs a correct answer';
    end if;
  end if;
  return new;
end $$;

create or replace function public.guard_assignment_submission_answer() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_assignment uuid;
  v_weight numeric;
begin
  if public.educmind_is_system() then return new; end if;
  select s.assignment_id,aq.weight into v_assignment,v_weight
  from public.assignment_submissions s
  join public.assignment_questions aq on aq.assignment_id=s.assignment_id and aq.question_id=new.question_id
  where s.id=new.submission_id;
  if v_assignment is null then raise exception 'Question is not part of this assignment'; end if;
  if new.score is not null and (new.score<0 or new.score>v_weight) then
    raise exception 'Score must be between 0 and the question weight';
  end if;
  if auth.uid() is not null and public.current_app_role()='STUDENT' then
    if tg_op='INSERT' then
      if new.score is not null or new.feedback<>'' or new.graded_by is not null or new.graded_at is not null then
        raise exception 'Students cannot submit grading fields';
      end if;
    elsif new.score is distinct from old.score or new.feedback is distinct from old.feedback
       or new.graded_by is distinct from old.graded_by or new.graded_at is distinct from old.graded_at then
      raise exception 'Students cannot change grades';
    elsif new.answer_content is distinct from old.answer_content then
      new.score:=null;
      new.feedback:='';
      new.graded_by:=null;
      new.graded_at:=null;
    end if;
  end if;
  return new;
end $$;

create policy assignment_submission_answers_teacher_update
  on public.assignment_submission_answers for update to authenticated
  using(exists(
    select 1 from public.assignment_submissions s
    where s.id=submission_id and public.can_manage_assignment(s.assignment_id)
  ))
  with check(exists(
    select 1 from public.assignment_submissions s
    where s.id=submission_id and public.can_manage_assignment(s.assignment_id)
  ));

create function public.educmind_write_assignment_answer_score(p_submission uuid,p_question uuid,p_score numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev text := coalesce(current_setting('educmind.system_write',true),'');
begin
  perform set_config('educmind.system_write','on',true);
  update public.assignment_submission_answers
  set score=p_score,graded_at=now(),graded_by=null
  where submission_id=p_submission and question_id=p_question
    and score is distinct from p_score;
  perform set_config('educmind.system_write',v_prev,true);
end $$;

create function public.educmind_write_assignment_grade(p_submission uuid,p_score numeric,p_graded_by uuid,p_graded_at timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev text := coalesce(current_setting('educmind.system_write',true),'');
begin
  perform set_config('educmind.system_write','on',true);
  update public.assignment_submissions
  set score=p_score,graded_by=p_graded_by,graded_at=p_graded_at
  where id=p_submission
    and (score is distinct from p_score or graded_by is distinct from p_graded_by or graded_at is distinct from p_graded_at);
  perform set_config('educmind.system_write',v_prev,true);
end $$;

create function public.refresh_assignment_submission_grade(p_submission uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_enabled boolean;
  v_total integer;
  v_scored integer;
  v_score numeric;
  v_teacher uuid;
begin
  select question_grading_enabled into v_enabled
  from public.assignment_submissions where id=p_submission for update;
  if not found or not v_enabled then return; end if;
  select count(*),count(sa.score),coalesce(sum(sa.score),0)
    into v_total,v_scored,v_score
  from public.assignment_questions aq
  left join public.assignment_submission_answers sa
    on sa.submission_id=p_submission and sa.question_id=aq.question_id
  where aq.assignment_id=(select assignment_id from public.assignment_submissions where id=p_submission);
  if v_total=0 then return; end if;
  if v_scored=v_total then
    select sa.graded_by into v_teacher
    from public.assignment_submission_answers sa
    where sa.submission_id=p_submission and sa.graded_by is not null
    order by sa.graded_at desc limit 1;
    perform public.educmind_write_assignment_grade(p_submission,v_score,v_teacher,now());
  else
    perform public.educmind_write_assignment_grade(p_submission,null,null,null);
  end if;
end $$;

create function public.autograde_assignment_submission(p_submission uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  q record;
  v_blank boolean;
  v_score numeric;
  v_answer_text text[];
  v_correct_text text[];
  v_answer_items integer;
  v_correct_items integer;
  v_matching_count integer;
  v_matching_correct integer;
begin
  if not exists(
    select 1 from public.assignment_submissions s
    where s.id=p_submission and s.question_grading_enabled
  ) then return; end if;
  for q in
    select aq.question_id,aq.weight,qu.kind,qu.correct_answer,sa.answer_content
    from public.assignment_submissions s
    join public.assignment_questions aq on aq.assignment_id=s.assignment_id
    join public.questions qu on qu.id=aq.question_id
    left join public.assignment_submission_answers sa
      on sa.submission_id=s.id and sa.question_id=aq.question_id
    where s.id=p_submission
      and qu.kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING')
      and qu.correct_answer is not null and jsonb_typeof(qu.correct_answer)<>'null'
    order by aq.display_order,aq.question_id
  loop
    v_blank := case
      when q.answer_content is null or jsonb_typeof(q.answer_content)='null' then true
      when jsonb_typeof(q.answer_content)='string' then btrim(q.answer_content #>> '{}')=''
      when jsonb_typeof(q.answer_content)='array' then not exists(
        select 1 from jsonb_array_elements(q.answer_content) as x(value)
        where jsonb_typeof(x.value)<>'null'
          and (jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')<>'')
      )
      else false end;
    if v_blank then
      v_score := 0;
    elsif q.kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE') then
      v_score := case when public.answer_tokens(q.answer_content)=public.answer_tokens(q.correct_answer)
        then q.weight else 0 end;
    elsif q.kind='FILL_IN_BLANK' then
      if jsonb_typeof(q.answer_content)<>'array' or jsonb_typeof(q.correct_answer)<>'array'
         or jsonb_array_length(q.answer_content)<>jsonb_array_length(q.correct_answer) then
        v_score:=0;
      else
        select array_agg(lower(btrim(x.value #>> '{}')) order by x.ordinality),
               count(*) filter(where jsonb_typeof(x.value)='string')::integer
          into v_answer_text,v_answer_items
        from jsonb_array_elements(q.answer_content) with ordinality as x(value,ordinality);
        select array_agg(lower(btrim(x.value #>> '{}')) order by x.ordinality),
               count(*) filter(where jsonb_typeof(x.value)='string')::integer
          into v_correct_text,v_correct_items
        from jsonb_array_elements(q.correct_answer) with ordinality as x(value,ordinality);
        v_score := case when v_answer_items=jsonb_array_length(q.answer_content)
          and v_correct_items=jsonb_array_length(q.correct_answer)
          and v_answer_text=v_correct_text then q.weight else 0 end;
      end if;
    else
      if jsonb_typeof(q.answer_content)<>'array' or jsonb_typeof(q.correct_answer)<>'array'
         or jsonb_array_length(q.correct_answer)=0
         or jsonb_array_length(q.answer_content)<>jsonb_array_length(q.correct_answer) then
        v_score:=0;
      else
        select count(*)::integer,
               count(*) filter(where jsonb_typeof(answer.value)='number' and answer.value=correct.value)::integer
          into v_matching_count,v_matching_correct
        from jsonb_array_elements(q.correct_answer) with ordinality as correct(value,ordinality)
        left join jsonb_array_elements(q.answer_content) with ordinality as answer(value,ordinality)
          on answer.ordinality=correct.ordinality;
        v_score:=q.weight*v_matching_correct/v_matching_count;
      end if;
    end if;
    perform public.educmind_write_assignment_answer_score(p_submission,q.question_id,v_score);
  end loop;
  perform public.refresh_assignment_submission_grade(p_submission);
end $$;

create function public.on_assignment_answer_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_assignment_submission_grade(old.submission_id);
    return null;
  end if;
  if tg_op='UPDATE' and new.answer_content is not distinct from old.answer_content
     and new.score is not distinct from old.score then return null; end if;
  if tg_op='UPDATE' and new.answer_content is not distinct from old.answer_content then
    perform public.refresh_assignment_submission_grade(new.submission_id);
    return null;
  end if;
  perform public.autograde_assignment_submission(new.submission_id);
  return null;
end $$;
create trigger assignment_submission_answer_autograde
  after insert or update of answer_content,score on public.assignment_submission_answers
  for each row execute function public.on_assignment_answer_change();

create function public.enable_assignment_question_grading() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.educmind_is_system() then return new; end if;
  if tg_op='UPDATE' then
    new.question_grading_enabled := old.question_grading_enabled
      or (old.score is null and exists(select 1 from public.assignment_questions aq where aq.assignment_id=new.assignment_id));
  else
    new.question_grading_enabled := exists(select 1 from public.assignment_questions aq where aq.assignment_id=new.assignment_id);
  end if;
  return new;
end $$;
create trigger assignment_question_grading_mode
  before insert or update on public.assignment_submissions
  for each row execute function public.enable_assignment_question_grading();

create function public.guard_auto_graded_assignment_total() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if public.educmind_is_system() then return new; end if;
  if old.question_grading_enabled and new.score is distinct from old.score then
    raise exception 'Question-based assignment scores are calculated from answer grades';
  end if;
  return new;
end $$;
create trigger assignment_question_grade_total_guard
  before update of score on public.assignment_submissions
  for each row execute function public.guard_auto_graded_assignment_total();

create or replace function public.autograde_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  att public.assessment_attempts%rowtype;
  q record;
  v_blank boolean;
  v_score numeric;
  v_answer_text text[];
  v_correct_text text[];
  v_answer_items integer;
  v_correct_items integer;
  v_matching_count integer;
  v_matching_correct integer;
begin
  select t.* into att from public.assessment_attempts t where t.id=p_attempt;
  if not found or att.status='IN_PROGRESS' then return; end if;
  for q in
    select aq.question_id,aq.weight,qu.kind,qu.correct_answer,sa.answer_content,
           sa.score as answer_score,sa.graded_by as answer_graded_by
    from public.assessment_questions aq
    join public.questions qu on qu.id=aq.question_id
    left join public.submission_answers sa on sa.attempt_id=p_attempt and sa.question_id=aq.question_id
    where aq.assessment_id=att.assessment_id
    order by aq.display_order
  loop
    if q.kind not in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING')
       or q.correct_answer is null or jsonb_typeof(q.correct_answer)='null' then
      if q.kind in ('SHORT_ANSWER','ESSAY') and q.answer_score is not null and q.answer_graded_by is null then
        perform public.educmind_write_answer_score(p_attempt,q.question_id,null);
      end if;
      continue;
    end if;
    v_blank := case
      when q.answer_content is null or jsonb_typeof(q.answer_content)='null' then true
      when jsonb_typeof(q.answer_content)='string' then btrim(q.answer_content #>> '{}')=''
      when jsonb_typeof(q.answer_content)='array' then not exists(
        select 1 from jsonb_array_elements(q.answer_content) as x(value)
        where jsonb_typeof(x.value)<>'null'
          and (jsonb_typeof(x.value)<>'string' or btrim(x.value #>> '{}')<>'')
      )
      else false end;
    if v_blank then
      v_score:=0;
    elsif q.kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE') then
      v_score:=case when public.answer_tokens(q.answer_content)=public.answer_tokens(q.correct_answer)
        then q.weight else 0 end;
    elsif q.kind='FILL_IN_BLANK' then
      if jsonb_typeof(q.answer_content)<>'array' or jsonb_typeof(q.correct_answer)<>'array'
         or jsonb_array_length(q.answer_content)<>jsonb_array_length(q.correct_answer) then
        v_score:=0;
      else
        select array_agg(lower(btrim(x.value #>> '{}')) order by x.ordinality),
               count(*) filter(where jsonb_typeof(x.value)='string')::integer
          into v_answer_text,v_answer_items
        from jsonb_array_elements(q.answer_content) with ordinality as x(value,ordinality);
        select array_agg(lower(btrim(x.value #>> '{}')) order by x.ordinality),
               count(*) filter(where jsonb_typeof(x.value)='string')::integer
          into v_correct_text,v_correct_items
        from jsonb_array_elements(q.correct_answer) with ordinality as x(value,ordinality);
        v_score:=case when v_answer_items=jsonb_array_length(q.answer_content)
          and v_correct_items=jsonb_array_length(q.correct_answer)
          and v_answer_text=v_correct_text then q.weight else 0 end;
      end if;
    else
      if jsonb_typeof(q.answer_content)<>'array' or jsonb_typeof(q.correct_answer)<>'array'
         or jsonb_array_length(q.correct_answer)=0
         or jsonb_array_length(q.answer_content)<>jsonb_array_length(q.correct_answer) then
        v_score:=0;
      else
        select count(*)::integer,
               count(*) filter(where jsonb_typeof(answer.value)='number' and answer.value=correct.value)::integer
          into v_matching_count,v_matching_correct
        from jsonb_array_elements(q.correct_answer) with ordinality as correct(value,ordinality)
        left join jsonb_array_elements(q.answer_content) with ordinality as answer(value,ordinality)
          on answer.ordinality=correct.ordinality;
        v_score:=q.weight*v_matching_correct/v_matching_count;
      end if;
    end if;
    perform public.educmind_write_answer_score(p_attempt,q.question_id,v_score);
  end loop;
  perform public.refresh_attempt_grade(p_attempt);
end $$;

create function public.grade_assignment_answer(p_submission uuid,p_question uuid,p_score numeric,p_feedback text default '')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_weight numeric;
  v_kind text;
begin
  if auth.uid() is null or public.current_app_role()<>'TEACHER' then raise exception 'Only teachers can grade assignment answers'; end if;
  select aq.weight,q.kind into v_weight,v_kind
  from public.assignment_submissions s
  join public.assignment_questions aq on aq.assignment_id=s.assignment_id
  join public.questions q on q.id=aq.question_id
  where s.id=p_submission and aq.question_id=p_question and public.can_manage_assignment(s.assignment_id);
  if v_weight is null then raise exception 'Question is not part of this assignment'; end if;
  if v_kind in ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING') then
    raise exception 'Automatically graded questions cannot be graded manually';
  end if;
  if p_score is null or p_score<0 or p_score>v_weight then raise exception 'Score must be between 0 and the question weight'; end if;
  update public.assignment_submission_answers
  set score=p_score,feedback=coalesce(p_feedback,''),graded_by=auth.uid(),graded_at=now()
  where submission_id=p_submission and question_id=p_question;
  if not found then raise exception 'No submitted answer exists for this question'; end if;
end $$;

drop function public.student_assignment_questions(uuid);
create function public.student_assignment_questions(x uuid)
returns table(question_id uuid,content text,kind text,options jsonb,display_order integer,weight numeric)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_course uuid;
begin
  select a.course_id into v_course
  from public.assignments a
  where a.id=x and a.deleted_at is null;
  if auth.uid() is null or v_course is null or not public.can_access_course(v_course) then
    raise exception 'Assignment unavailable';
  end if;
  if public.current_app_role()='TEACHER' and not public.can_manage_assignment(x) then
    raise exception 'Assignment unavailable';
  end if;
  if public.current_app_role()='STUDENT' and not exists(
    select 1 from public.assignments a
    where a.id=x and a.status='PUBLISHED' and a.deleted_at is null
      and public.student_content(a.course_id,a.topic_id,a.lesson_id)
  ) then
    raise exception 'Assignment unavailable';
  end if;
  return query
    select q.id,q.content,q.kind,q.options,aq.display_order,aq.weight
    from public.assignment_questions aq
    join public.questions q on q.id=aq.question_id
    where aq.assignment_id=x
    order by aq.display_order,aq.question_id;
end $$;
revoke all on function public.student_assignment_questions(uuid) from public,anon;
grant execute on function public.student_assignment_questions(uuid) to authenticated;

revoke all on function
  public.rebalance_assignment_question_weights(uuid,numeric),
  public.rebalance_assignment_questions_after_change(),
  public.rebalance_assignment_weights_on_max_change(),
  public.educmind_write_assignment_answer_score(uuid,uuid,numeric),
  public.educmind_write_assignment_grade(uuid,numeric,uuid,timestamptz),
  public.refresh_assignment_submission_grade(uuid),
  public.autograde_assignment_submission(uuid),
  public.on_assignment_answer_change(),
  public.enable_assignment_question_grading(),
  public.guard_auto_graded_assignment_total(),
  public.grade_assignment_answer(uuid,uuid,numeric,text)
from public,anon,authenticated;
grant execute on function public.grade_assignment_answer(uuid,uuid,numeric,text) to authenticated;

