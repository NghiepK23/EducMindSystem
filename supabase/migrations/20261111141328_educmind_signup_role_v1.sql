-- Vai trò khi đăng ký: người dùng tự chọn Giáo viên hoặc Học sinh ở form đăng ký.
-- Frontend gửi options.data = { full_name, role: 'TEACHER' | 'STUDENT' } khi gọi auth.signUp().
-- Vai trò chỉ được ghi một lần lúc tạo hồ sơ; đổi metadata sau này không đổi được vai trò.
create or replace function public.auth_user_profile() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_role public.app_role := 'STUDENT';
begin
  if upper(btrim(coalesce(new.raw_user_meta_data->>'role',''))) in ('TEACHER','T') then
    v_role := 'TEACHER';
  end if;
  insert into public.profiles(id,email,full_name,role)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',''),v_role)
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;
