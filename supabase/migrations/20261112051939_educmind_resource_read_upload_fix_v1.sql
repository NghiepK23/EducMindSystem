-- Sửa lỗi: giáo viên không tải được tài liệu lên kho educmind-resources.
-- Dịch vụ Storage ghi dòng storage.objects bằng "insert ... returning" dưới quyền người dùng, mà RETURNING
-- phải vượt qua chính sách SELECT educmind_resource_read. Chính sách cũ chỉ cho đọc khi bảng resources đã
-- có dòng tương ứng — thời điểm vừa tải tệp thì dòng đó chưa tồn tại nên mọi lần tải lên đều bị từ chối
-- ("new row violates row-level security policy"). Cho phép cả giáo viên quản lý lớp đọc mọi tệp trong thư
-- mục của lớp mình; học sinh giữ nguyên đường đọc cũ qua can_read_resource (bài đã xuất bản).

drop policy if exists educmind_resource_read on storage.objects;
create policy educmind_resource_read on storage.objects for select to authenticated
  using (bucket_id='educmind-resources'
         and (public.can_read_resource(name)
              or public.can_manage_class((storage.foldername(name))[1]::uuid)));
