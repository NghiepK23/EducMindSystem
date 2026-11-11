-- Giờ máy chủ cho giao diện.
-- Hạn nộp bài và giờ làm bài kiểm tra do máy chủ quyết định. Đồng hồ trên máy người dùng có thể sai, nên giao diện hỏi
-- giờ máy chủ một lần khi đăng nhập để hiển thị đồng hồ đếm ngược và trạng thái "còn hạn / hết hạn" cho đúng.
-- Hàm chỉ trả về thời điểm hiện tại, không đọc bảng nào.
create function public.server_now() returns timestamptz
language sql stable set search_path=public,pg_temp as $$ select now() $$;

revoke all on function public.server_now() from public,anon;
grant execute on function public.server_now() to authenticated;
