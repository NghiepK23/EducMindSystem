-- Nhóm tính năng Tệp · Rubric · Khôi phục · Mã lớp.
-- Bảng resources, rubric_criteria, rubric_scores, class_invites và các chính sách kho tệp
-- (educmind-resources, educmind-submissions) đã có từ các migration trước. Migration này chỉ thêm
-- hai thao tác mà chính sách RLS hiện tại làm không được:
--   1) regen_class_code: giáo viên tạo mã lớp mới và thu hồi mọi mã cũ. Chính sách trên class_invites
--      cho phép thêm/sửa, nhưng để mã cũ không vào lớp được nữa phải thu hồi hàng loạt — gói trong
--      một hàm để làm trong một giao dịch và không phụ thuộc thứ tự thao tác từ trình duyệt.
--   2) restore_class: mở lại lớp đã lưu trữ. Chính sách class_update yêu cầu can_manage_class()
--      (bỏ qua lớp đã lưu trữ) nên trình duyệt không tự sửa được dòng lớp đó.
-- Khôi phục chủ đề / bài học / bài tập / câu hỏi đã xóa dùng cập nhật deleted_at=null qua RLS sẵn có.

create function public.regen_class_code(p_class uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare k text;
begin
  if auth.uid() is null or not public.can_manage_class(p_class) then
    raise exception 'Only the class owner can create a new class code';
  end if;
  update public.class_invites set revoked_at = now() where class_id = p_class and revoked_at is null;
  loop
    k := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
    exit when not exists(select 1 from public.class_invites where code = k);
  end loop;
  insert into public.class_invites(class_id, code, created_by) values (p_class, k, auth.uid());
  return k;
end $$;

create function public.restore_class(p_class uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'TEACHER'
     or not exists(select 1 from public.classes c where c.id = p_class and c.owner_teacher_id = auth.uid()) then
    raise exception 'Only the class owner can restore a class';
  end if;
  update public.classes set deleted_at = null where id = p_class and deleted_at is not null;
end $$;

revoke all on function public.regen_class_code(uuid), public.restore_class(uuid) from public, anon;
grant execute on function public.regen_class_code(uuid), public.restore_class(uuid) to authenticated;
