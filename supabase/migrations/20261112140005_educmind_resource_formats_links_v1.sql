-- Tài liệu dạy học: mở rộng định dạng tệp và thêm tài liệu dạng liên kết (YouTube, Canva, web).
-- 1) Kho educmind-resources: bỏ giới hạn MIME — chấp nhận mọi định dạng tệp mà giáo viên/học sinh
--    dùng trong dạy học (doc, docx, xlsx, pptx, tệp code, video, âm thanh…); giới hạn còn theo
--    dung lượng 50 MB (file_size_limit đã đặt từ migration tạo bucket). Bài nộp
--    (educmind-submissions) vốn đã cho mọi MIME nên không đổi.
update storage.buckets set allowed_mime_types = null where id = 'educmind-resources';

-- 2) Bảng resources: thêm dạng liên kết (kind = 'LINK', lưu url; kind = 'FILE' như cũ).
--    Liên kết không có tệp trong kho nên storage_path / file_size_bytes được để trống.
alter table public.resources alter column storage_path drop not null;
alter table public.resources alter column file_size_bytes drop not null;
alter table public.resources add column kind text not null default 'FILE';
alter table public.resources add column url text;
alter table public.resources add constraint resources_kind_check check (kind in ('FILE','LINK'));
alter table public.resources add constraint resources_shape_check
  check ((kind = 'FILE' and storage_path is not null and url is null)
      or (kind = 'LINK' and url is not null and storage_path is null));
