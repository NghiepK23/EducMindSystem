-- Gắn bài tập và câu hỏi với mục tiêu học tập, để quy điểm về từng mục tiêu.
create table public.assignment_objectives(
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  objective_id uuid not null references public.learning_objectives(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(assignment_id,objective_id)
);
create index assignment_objectives_objective_idx on public.assignment_objectives(objective_id);

create table public.question_objectives(
  question_id uuid not null references public.questions(id) on delete cascade,
  objective_id uuid not null references public.learning_objectives(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(question_id,objective_id)
);
create index question_objectives_objective_idx on public.question_objectives(objective_id);

-- Mục tiêu phải thuộc cùng khóa học với bài tập hoặc câu hỏi.
create function public.validate_objective_link() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_item_course uuid;
  v_objective_course uuid;
begin
  select l.course_id into v_objective_course
  from public.learning_objectives o join public.lessons l on l.id=o.lesson_id
  where o.id=new.objective_id;
  if tg_table_name='assignment_objectives' then
    select course_id into v_item_course from public.assignments where id=new.assignment_id;
  else
    select course_id into v_item_course from public.questions where id=new.question_id;
  end if;
  if v_item_course is null or v_objective_course is null or v_item_course<>v_objective_course then
    raise exception 'Learning objective must belong to the same course';
  end if;
  return new;
end $$;
create trigger assignment_objective_course before insert or update on public.assignment_objectives
  for each row execute function public.validate_objective_link();
create trigger question_objective_course before insert or update on public.question_objectives
  for each row execute function public.validate_objective_link();

alter table public.assignment_objectives enable row level security;
alter table public.question_objectives enable row level security;

-- Ai xem được bài tập thì xem được mục tiêu gắn với bài tập đó (RLS của bảng assignments quyết định).
create policy assignment_objectives_read on public.assignment_objectives for select to authenticated
  using(exists(select 1 from public.assignments a where a.id=assignment_objectives.assignment_id));
create policy assignment_objectives_teacher_all on public.assignment_objectives for all to authenticated
  using(public.can_manage_assignment(assignment_id)) with check(public.can_manage_assignment(assignment_id));
-- Câu hỏi và đáp án chỉ giáo viên của khóa học được xem, nên liên kết mục tiêu cũng vậy.
create policy question_objectives_teacher_all on public.question_objectives for all to authenticated
  using(exists(select 1 from public.questions q where q.id=question_objectives.question_id and public.can_manage_course(q.course_id)))
  with check(exists(select 1 from public.questions q where q.id=question_objectives.question_id and public.can_manage_course(q.course_id)));

revoke all on public.assignment_objectives,public.question_objectives from anon,authenticated;
grant select,insert,update,delete on public.assignment_objectives,public.question_objectives to authenticated;
revoke all on function public.validate_objective_link() from public,anon,authenticated;
