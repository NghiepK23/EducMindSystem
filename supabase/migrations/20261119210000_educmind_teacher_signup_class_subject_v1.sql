-- Teacher signup provisions a class, invite code, and course in the same Auth transaction.
-- courses.title is the backend-managed subject name and is linked to its class by class_id.
create or replace function public.auth_user_profile() returns trigger
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_role public.app_role := 'STUDENT';
  v_class_name text;
  v_subject_name text;
  v_class_id uuid;
  v_code text;
begin
  if upper(btrim(coalesce(new.raw_user_meta_data->>'role',''))) in ('TEACHER','T') then
    v_role := 'TEACHER';
  end if;

  insert into public.profiles(id,email,full_name,role)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',''),v_role)
  on conflict(id) do update set email=excluded.email;

  if tg_op='INSERT' and v_role='TEACHER' then
    v_class_name := btrim(coalesce(new.raw_user_meta_data->>'teacher_class_name',''));
    v_subject_name := btrim(coalesce(new.raw_user_meta_data->>'teacher_subject_name',''));
    if length(v_class_name) not between 1 and 100 then
      raise exception 'Teacher signup requires a class name of 1–100 characters';
    end if;
    if length(v_subject_name) not between 1 and 120 then
      raise exception 'Teacher signup requires a subject name of 1–120 characters';
    end if;

    insert into public.classes(name,owner_teacher_id)
    values(v_class_name,new.id)
    returning id into v_class_id;

    loop
      v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
      exit when not exists(select 1 from public.class_invites where code=v_code);
    end loop;
    insert into public.class_invites(class_id,code,created_by)
    values(v_class_id,v_code,new.id);
    insert into public.courses(class_id,title)
    values(v_class_id,v_subject_name);
  end if;

  return new;
end $$;

-- Manual class creation uses the same class → course relationship and persists all three
-- records atomically, so a failed class/course setup cannot leave partial data.
create or replace function public.create_class_with_subject(
  p_name text,
  p_grade smallint,
  p_school_year text,
  p_subject text
) returns table(class_id uuid,join_code text)
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_class_id uuid;
  v_code text;
  v_name text := btrim(coalesce(p_name,''));
  v_subject text := btrim(coalesce(p_subject,''));
begin
  if auth.uid() is null or public.current_app_role()<>'TEACHER' then
    raise exception 'Only teachers can create a class';
  end if;
  if length(v_name) not between 1 and 100 then
    raise exception 'Class name must be 1–100 characters';
  end if;
  if length(v_subject) not between 1 and 120 then
    raise exception 'Subject name must be 1–120 characters';
  end if;
  if p_grade is not null and p_grade not between 3 and 12 then
    raise exception 'Class grade must be between 3 and 12';
  end if;

  insert into public.classes(name,grade,school_year,owner_teacher_id)
  values(v_name,p_grade,nullif(btrim(coalesce(p_school_year,'')),''),auth.uid())
  returning id into v_class_id;

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    exit when not exists(select 1 from public.class_invites where code=v_code);
  end loop;
  insert into public.class_invites(class_id,code,created_by)
  values(v_class_id,v_code,auth.uid());
  insert into public.courses(class_id,title)
  values(v_class_id,v_subject);
  return query select v_class_id,v_code;
end $$;

create or replace function public.update_class_with_subject(
  p_class uuid,
  p_name text,
  p_grade smallint,
  p_school_year text,
  p_subject text
) returns void
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_name text := btrim(coalesce(p_name,''));
  v_subject text := btrim(coalesce(p_subject,''));
  v_course_id uuid;
begin
  if auth.uid() is null or not public.can_manage_class(p_class) then
    raise exception 'Class not found';
  end if;
  if length(v_name) not between 1 and 100 then
    raise exception 'Class name must be 1–100 characters';
  end if;
  if length(v_subject) not between 1 and 120 then
    raise exception 'Subject name must be 1–120 characters';
  end if;
  if p_grade is not null and p_grade not between 3 and 12 then
    raise exception 'Class grade must be between 3 and 12';
  end if;

  update public.classes
  set name=v_name,grade=p_grade,school_year=nullif(btrim(coalesce(p_school_year,'')),'')
  where id=p_class and owner_teacher_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'Class not found'; end if;

  select id into v_course_id
  from public.courses
  where class_id=p_class and deleted_at is null
  order by created_at
  limit 1;
  if v_course_id is null then
    insert into public.courses(class_id,title) values(p_class,v_subject);
  else
    update public.courses set title=v_subject where id=v_course_id;
  end if;
end $$;

revoke all on function public.create_class_with_subject(text,smallint,text,text) from public,anon;
grant execute on function public.create_class_with_subject(text,smallint,text,text) to authenticated;
revoke all on function public.update_class_with_subject(uuid,text,smallint,text,text) from public,anon;
grant execute on function public.update_class_with_subject(uuid,text,smallint,text,text) to authenticated;
