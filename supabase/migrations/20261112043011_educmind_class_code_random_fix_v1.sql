-- Sửa lỗi: regen_class_code gọi gen_random_bytes của pgcrypto mà không kèm schema.
-- pgcrypto nằm trong schema extensions (xem educmind_class_code_search_path_fix_v1) nên
-- mọi lần tạo mã lớp mới đều báo "function gen_random_bytes(integer) does not exist".
-- Chỉ thêm tên schema; phần còn lại giữ nguyên như educmind_files_rubric_restore_v1.

create or replace function public.regen_class_code(p_class uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare k text;
begin
  if auth.uid() is null or not public.can_manage_class(p_class) then
    raise exception 'Only the class owner can create a new class code';
  end if;
  update public.class_invites set revoked_at = now() where class_id = p_class and revoked_at is null;
  loop
    k := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
    exit when not exists(select 1 from public.class_invites where code = k);
  end loop;
  insert into public.class_invites(class_id, code, created_by) values (p_class, k, auth.uid());
  return k;
end $$;
