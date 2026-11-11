-- Sửa lỗi: hàm tạo lớp gọi gen_random_bytes của pgcrypto. pgcrypto nằm trong schema extensions,
-- còn search_path của hàm chỉ có public, pg_temp, nên mọi lần tạo lớp đều báo lỗi
-- "function gen_random_bytes(integer) does not exist". Chỉ thêm tên schema; phần còn lại giữ nguyên.
create or replace function public.create_class_with_code(n text, g smallint default null, y text default null)
returns table(class_id uuid, join_code text)
language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare c uuid; k text;
begin
  if auth.uid() is null or public.current_app_role()<>'TEACHER' then raise exception 'Only teachers can create a class'; end if;
  insert into public.classes(name,grade,school_year,owner_teacher_id) values(trim(n),g,y,auth.uid()) returning id into c;
  loop
    k=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    exit when not exists(select 1 from public.class_invites where code=k);
  end loop;
  insert into public.class_invites(class_id,code,created_by) values(c,k,auth.uid());
  return query select c,k;
end $function$;
