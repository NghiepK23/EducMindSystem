-- Teacher signup may omit both class and subject. If either is supplied, require both
-- and provision their class/course atomically; the account form can provision them later.
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
    if v_class_name<>'' or v_subject_name<>'' then
      if length(v_class_name) not between 1 and 100 then
        raise exception 'Teacher signup class name must be 1–100 characters';
      end if;
      if length(v_subject_name) not between 1 and 120 then
        raise exception 'Teacher signup subject name must be 1–120 characters';
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
  end if;

  return new;
end $$;

-- A teacher can manage learning content only when the class has a non-empty course
-- title. Since course titles are the backend source of subject names, this also blocks
-- direct API writes until the teacher supplies the required class/subject information.
create or replace function public.can_manage_course(x uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.courses c
    where c.id=x
      and public.can_manage_class(c.class_id)
      and c.deleted_at is null
      and length(btrim(c.title))>0
  )
$$;
