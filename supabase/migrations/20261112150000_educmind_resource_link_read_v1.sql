-- Sửa quyền đọc tài liệu dạng LIÊN KẾT (kind='LINK', storage_path để trống).
-- Chính sách resource_read cũ gọi can_read_resource(storage_path) — hàm này so theo đường dẫn tệp,
-- nên học sinh không nhìn thấy tài liệu dạng liên kết (YouTube, Canva, trang web) mà giáo viên thêm.
-- Giữ nguyên nguyên tắc cũ cho tệp: học sinh chỉ thấy khi bài học + chủ đề đã xuất bản (hoặc tài liệu
-- không gắn bài học); giáo viên thấy mọi tài liệu của lớp mình.

drop policy if exists resource_read on public.resources;
create policy resource_read on public.resources for select to authenticated
  using (public.can_read_resource(storage_path)
         or (storage_path is null
             and deleted_at is null
             and public.can_access_course(course_id)
             and (public.current_app_role()='TEACHER'
                  or lesson_id is null
                  or exists(select 1 from public.lessons l
                            join public.course_topics t on t.id = l.topic_id
                            where l.id = lesson_id
                              and l.status='PUBLISHED'
                              and t.status='PUBLISHED'))));
