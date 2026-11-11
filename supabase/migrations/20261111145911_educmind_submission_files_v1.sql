-- Tệp bài nộp của học sinh.
-- Bảng assignment_submissions có cột storage_path nhưng kho lưu trữ chỉ cho giáo viên tải tệp lên (bucket tài liệu),
-- nên học sinh chưa nộp được bài bằng tệp. Thêm một bucket riêng tư cho bài nộp:
--   đường dẫn: <mã lớp>/<mã bài tập>/<mã học sinh>/<tên tệp>
--   học sinh: tải lên / thay / xóa tệp của chính mình khi bài tập còn nhận bài và bài chưa được chấm; luôn đọc được tệp của mình
--   giáo viên quản lý lớp: đọc và xóa
-- Giới hạn 20 MB mỗi tệp; không giới hạn loại tệp ở kho (môn Tin học nộp cả mã nguồn), giao diện kiểm tra phần mở rộng.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('educmind-submissions','educmind-submissions',false,20971520,null)
on conflict(id) do nothing;

create function public.can_read_submission_file(p_name text) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  m text[] := regexp_match(p_name,'^([0-9a-fA-F-]{36})/([0-9a-fA-F-]{36})/([0-9a-fA-F-]{36})/[^/]+$');
begin
  if m is null or auth.uid() is null then return false; end if;
  return m[3]::uuid=auth.uid() or public.can_manage_class(m[1]::uuid);
exception when invalid_text_representation then
  return false;
end $$;

create function public.can_write_submission_file(p_name text) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  m text[] := regexp_match(p_name,'^([0-9a-fA-F-]{36})/([0-9a-fA-F-]{36})/([0-9a-fA-F-]{36})/[^/]+$');
begin
  if m is null or auth.uid() is null then return false; end if;
  return m[3]::uuid=auth.uid()
     and public.student_can_submit(m[2]::uuid)
     and exists(select 1 from public.assignments a join public.courses c on c.id=a.course_id
                where a.id=m[2]::uuid and c.class_id=m[1]::uuid)
     and not exists(select 1 from public.assignment_submissions s
                    where s.assignment_id=m[2]::uuid and s.student_id=auth.uid()
                      and (s.score is not null or s.graded_at is not null));
exception when invalid_text_representation then
  return false;
end $$;

create policy educmind_submission_file_read on storage.objects for select to authenticated
  using (bucket_id='educmind-submissions' and public.can_read_submission_file(name));
create policy educmind_submission_file_insert on storage.objects for insert to authenticated
  with check (bucket_id='educmind-submissions' and public.can_write_submission_file(name));
create policy educmind_submission_file_update on storage.objects for update to authenticated
  using (bucket_id='educmind-submissions' and public.can_write_submission_file(name))
  with check (bucket_id='educmind-submissions' and public.can_write_submission_file(name));
create policy educmind_submission_file_delete on storage.objects for delete to authenticated
  using (bucket_id='educmind-submissions'
         and (public.can_write_submission_file(name)
              or (public.current_app_role()='TEACHER' and public.can_read_submission_file(name))));

-- storage_path của bài nộp phải trỏ vào đúng thư mục của học sinh đó cho bài tập đó.
create function public.validate_submission_storage_path() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_class uuid;
  v_prefix text;
begin
  if new.storage_path is null then return new; end if;
  if tg_op='UPDATE' and new.storage_path is not distinct from old.storage_path then return new; end if;
  select c.class_id into v_class
  from public.assignments a join public.courses c on c.id=a.course_id
  where a.id=new.assignment_id;
  v_prefix := v_class::text||'/'||new.assignment_id::text||'/'||new.student_id::text||'/';
  if v_class is null
     or left(new.storage_path,length(v_prefix))<>v_prefix
     or length(new.storage_path)<=length(v_prefix)
     or position('/' in substr(new.storage_path,length(v_prefix)+1))>0 then
    raise exception 'Submission file path must be <class>/<assignment>/<student>/<file name>';
  end if;
  return new;
end $$;
create trigger educmind_submission_storage_path before insert or update of storage_path on public.assignment_submissions
  for each row execute function public.validate_submission_storage_path();

revoke all on function public.validate_submission_storage_path() from public,anon,authenticated;
revoke all on function public.can_read_submission_file(text),public.can_write_submission_file(text) from public,anon;
grant execute on function public.can_read_submission_file(text),public.can_write_submission_file(text) to authenticated;
