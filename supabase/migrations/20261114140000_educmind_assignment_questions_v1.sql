create table public.assignment_questions(
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  display_order integer not null default 0,
  primary key(assignment_id,question_id)
);
create index assignment_questions_question_idx on public.assignment_questions(question_id);
alter table public.assignment_questions enable row level security;
create policy assignment_questions_teacher_all on public.assignment_questions for all to authenticated
  using(public.can_manage_assignment(assignment_id))
  with check(public.can_manage_assignment(assignment_id));

create function public.guard_assignment_publication() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='PUBLISHED'
     and coalesce(trim(new.description),'')=''
     and not exists(select 1 from public.assignment_questions aq where aq.assignment_id=new.id) then
    raise exception 'Assignment needs questions or instructions before publication';
  end if;
  return new;
end $$;
create trigger assignment_publication_guard before insert or update on public.assignments
  for each row execute function public.guard_assignment_publication();

create table public.assignment_submission_answers(
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  answer_content jsonb not null,
  primary key(submission_id,question_id)
);
alter table public.assignment_submission_answers enable row level security;
create policy assignment_submission_answers_read on public.assignment_submission_answers for select to authenticated
  using(exists(
    select 1 from public.assignment_submissions s
    where s.id=submission_id
      and (s.student_id=auth.uid() or public.can_manage_assignment(s.assignment_id))
  ));
create policy assignment_submission_answers_student_insert on public.assignment_submission_answers for insert to authenticated
  with check(exists(
    select 1 from public.assignment_submissions s
    where s.id=submission_id and s.student_id=auth.uid()
      and s.score is null and s.graded_at is null
      and public.student_can_submit(s.assignment_id)
  ));
create policy assignment_submission_answers_student_update on public.assignment_submission_answers for update to authenticated
  using(exists(
    select 1 from public.assignment_submissions s
    where s.id=submission_id and s.student_id=auth.uid()
      and s.score is null and s.graded_at is null
      and public.student_can_submit(s.assignment_id)
  ))
  with check(exists(
    select 1 from public.assignment_submissions s
    where s.id=submission_id and s.student_id=auth.uid()
      and s.score is null and s.graded_at is null
      and public.student_can_submit(s.assignment_id)
  ));
create policy assignment_submission_answers_teacher_delete on public.assignment_submission_answers for delete to authenticated
  using(exists(
    select 1 from public.assignment_submissions s
    where s.id=submission_id and public.can_manage_assignment(s.assignment_id)
  ));

create function public.guard_assignment_question() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_assignment uuid;
  v_course uuid;
begin
  v_assignment := case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
  if tg_op='UPDATE' and old.assignment_id is distinct from new.assignment_id
     and exists(select 1 from public.assignment_submissions s where s.assignment_id=old.assignment_id) then
    raise exception 'Assignment questions are locked after the first submission';
  end if;
  if tg_op='DELETE' and not exists(select 1 from public.assignments a where a.id=v_assignment) then
    return old;
  end if;
  if exists(select 1 from public.assignment_submissions s where s.assignment_id=v_assignment) then
    raise exception 'Assignment questions are locked after the first submission';
  end if;
  if tg_op='DELETE' then return old; end if;
  select a.course_id into v_course from public.assignments a where a.id=v_assignment;
  if v_course is null or not exists(
    select 1 from public.questions q
    where q.id=new.question_id
      and q.course_id=v_course and q.deleted_at is null
  ) then
    raise exception 'Question is not in the assignment course';
  end if;
  return new;
end $$;
create trigger assignment_question_guard before insert or update or delete on public.assignment_questions
  for each row execute function public.guard_assignment_question();

create function public.guard_assignment_submission_answer() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_assignment uuid;
begin
  select s.assignment_id into v_assignment
  from public.assignment_submissions s where s.id=new.submission_id;
  if v_assignment is null or not exists(
    select 1 from public.assignment_questions aq
    where aq.assignment_id=v_assignment and aq.question_id=new.question_id
  ) then
    raise exception 'Question is not part of this assignment';
  end if;
  return new;
end $$;
create trigger assignment_submission_answer_guard before insert or update on public.assignment_submission_answers
  for each row execute function public.guard_assignment_submission_answer();

create function public.student_assignment_questions(x uuid)
returns table(question_id uuid,content text,kind text,options jsonb,display_order integer)
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
    select q.id,q.content,q.kind,q.options,aq.display_order
    from public.assignment_questions aq
    join public.questions q on q.id=aq.question_id
    where aq.assignment_id=x
    order by aq.display_order,aq.question_id;
end $$;

revoke all on function public.guard_assignment_publication(),public.guard_assignment_question(),public.guard_assignment_submission_answer() from public,anon,authenticated;
revoke all on function public.student_assignment_questions(uuid) from public,anon;
grant execute on function public.student_assignment_questions(uuid) to authenticated;
grant select,insert,update,delete on public.assignment_questions,public.assignment_submission_answers to authenticated;
