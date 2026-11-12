-- Giữ tên tệp GỐC mà học sinh chọn khi nộp bài.
-- Tên tệp lưu trong kho Storage được chuẩn hóa (bỏ dấu, ký tự lạ) vì Supabase Storage
-- từ chối khóa có ký tự ngoài [A-Za-z0-9_/!.*'() &$=@;:+,?-] (lỗi "Invalid key");
-- cột file_name giữ nguyên tên gốc để hiển thị và đặt tên khi tải xuống.

alter table public.assignment_submissions add column if not exists file_name text;
