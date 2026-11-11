-- Lịch sử chỉnh sửa chỉ do máy chủ ghi.
-- Từ migration educmind_revision_log_v1, mọi thay đổi nội dung và điểm của giáo viên được trigger ghi vào content_revisions.
-- Chính sách cũ revisions_teacher_insert vẫn cho giáo viên tự chèn dòng lịch sử cho lớp của mình từ trình duyệt,
-- nên lịch sử có thể chứa những dòng không ứng với thay đổi thật nào. Gỡ chính sách đó và thu quyền ghi của người dùng.
-- Hàm trigger log_content_revision() chạy bằng quyền của chủ hàm (security definer) nên vẫn ghi được như cũ.
drop policy if exists revisions_teacher_insert on public.content_revisions;
revoke insert, update, delete, truncate on table public.content_revisions from authenticated;
