-- Sửa lỗi: mục “Lớp đã lưu trữ” luôn trống vì chính sách class_read dùng can_access_class()
-- (bỏ qua lớp đã lưu trữ) nên chính chủ lớp cũng không đọc lại được dòng lớp sau khi lưu trữ.
-- Cho phép chủ lớp luôn đọc được lớp của mình (kể cả đã lưu trữ) để danh sách lưu trữ và nút
-- “Mở lại” hoạt động; học sinh không thấy lớp đã lưu trữ (giữ nguyên can_access_class).

drop policy if exists class_read on public.classes;
create policy class_read on public.classes for select to authenticated
  using (public.can_access_class(id) or owner_teacher_id = auth.uid());
