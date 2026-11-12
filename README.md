# EducMind — Hệ thống quản lý dạy và học

Website quản lý lớp học, nội dung bài học, bài tập, câu hỏi, đề kiểm tra và tiến độ học tập.
Giao diện viết bằng **JavaScript thuần** (không framework, không cần bước build), backend dùng **Supabase**
(PostgreSQL + Auth + REST + Storage + Realtime), toàn bộ mã nguồn lưu trong repository này.

## Chạy website trên máy cá nhân

Trang là tĩnh hoàn toàn, chỉ cần một máy chủ tệp nhỏ để trình duyệt nạp được các tệp JS:

```bash
# trong thư mục gốc của repository
python3 -m http.server 5500
# hoặc: npx serve -l 5500
# hoặc: mở VS Code → cài extension Live Server → chuột phải index.html → Open with Live Server
```

Mở `http://localhost:5500/` trong trình duyệt.

> Cổng 5500 hiện đang được khai báo trong cấu hình Auth của Supabase
> (`site_url` và danh sách URL cho phép), nên hãy chạy đúng cổng này.
> Muốn thay cổng hoặc đưa website lên Internet (GitHub Pages, Vercel, Netlify…),
> cần cập nhật cấu hình Auth của Supabase theo URL mới trước.

## Tài khoản và phân quyền

Hệ thống chỉ dùng **tài khoản thật** đăng ký bằng email (chế độ demo đã được gỡ bỏ):

1. Bấm **Tạo tài khoản**, chọn vai trò **Giáo viên (TEACHER)** hoặc **Học sinh (STUDENT)**
   (vai trò không đổi được sau khi tạo).
2. Mở hộp thư (kể cả thư rác) bấm liên kết **xác nhận email**, rồi quay lại đăng nhập.
3. Giáo viên tạo **Lớp học** — hệ thống sinh **mã lớp 8 ký tự**; học sinh tự đăng ký
   rồi vào lớp bằng mã đó.
4. Giáo viên cũng có thể **tự tạo tài khoản cho học sinh** ngay trong trang lớp học
   (tự đặt mật khẩu giao cho học sinh).

Tải lại trang bao nhiêu lần cũng giữ nguyên đăng nhập và dữ liệu — mọi thứ được lưu
trên Supabase, không còn dữ liệu tạm trong bộ nhớ.

## Cấu trúc mã nguồn

```
index.html                 Trang duy nhất, nạp toàn bộ CSS/JS theo thứ tự số trong tên tệp
css/
  01-base.css … 12-db.css  Kiểu dáng; số càng lớn càng được nạp sau (ghi đè)
js/
  01-sample-data.js … 77-liquid-glass.js
                           Mã giao diện dùng chung (đăng nhập, chủ đề, biểu tượng,
                           nhập/xuất Excel–Word, hộp thoại…); phần giao diện demo cũ
                           không còn được sử dụng (chế độ demo đã gỡ bỏ)
  db/                      Màn hình dữ liệu thật (đăng nhập Supabase), nạp SAU js/75 và TRƯỚC js/76-main.js
    01-core.js             Vào app, đăng xuất, phiên, đồng bộ chuông báo
    02-shell.js            Vỏ ứng dụng: điều hướng theo vai trò, chuông thông báo
    03-classes.js … 13-report.js   Lớp học, nội dung, bài tập, câu hỏi, thi, tiến độ,
                           nhập/xuất, lịch & cần làm, báo cáo
    14-ai.js               AI tạo câu hỏi nháp (giáo viên)
    15-games.js            Trò chơi ôn tập 3 chế độ
    16-live.js             Realtime cho chuông thông báo (tự fallback polling)
  vendor/
    supabase-js.min.js     Thư viện Supabase ghim sẵn trong repo — không phụ thuộc CDN
supabase/
  migrations/              32 migration SQL của backend — nguồn chuẩn cho cấu trúc cơ sở dữ liệu
```

Quy ước: tệp **số nhỏ nạp trước**, tệp số lớn có thể dùng hàm/định nghĩa của tệp số nhỏ.
`js/03-supabase.js` chứa địa chỉ dự án Supabase, khóa công khai và `EducMindDB` —
mọi lệnh đọc/ghi cơ sở dữ liệu đều đi qua đối tượng này (mỗi hàm = một lệnh tới Supabase).

## Thiết lập backend Supabase

1. Tạo dự án Supabase (miễn phí là đủ).
2. Chạy toàn bộ tệp trong `supabase/migrations/` theo thứ tự thời gian trong tên tệp
   (dùng Supabase CLI `supabase db push`, hoặc mở SQL Editor và chạy tuần tự từng tệp).
3. Sửa `js/03-supabase.js`: điền `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY`
   (chỉ dùng **khóa công khai** publishable; mọi phân quyền do **RLS** trong cơ sở dữ liệu quyết định).
4. Trong Authentication → URL Configuration của Supabase: đặt `site_url` là địa chỉ website
   (mặc định `http://localhost:5500`) và thêm URL đó vào danh sách cho phép.
5. Hai **Storage bucket** `educmind-resources` (tài liệu bài học) và `educmind-submissions`
   (bài nộp của học sinh) đã được migration tạo sẵn kèm policy đọc/ghi; nếu tự tạo lại thì
   để trống `allowed_mime_types` để nhận mọi định dạng tệp.

Lưu ý bảo mật của backend:

- Bảng do máy chủ tự ghi bằng trigger (`learning_evidence`, `mastery`, `knowledge_gaps`,
  `content_revisions`, `notifications`): người dùng **chỉ được đọc**, mọi thay đổi được
  trigger ghi lại (ví dụ `content_revisions` là nhật ký chỉnh sửa nội dung — chỉ máy chủ ghi).
- Các thao tác nhiều bước (tạo lớp, vào lớp, bắt đầu/nộp bài kiểm tra, tạo tài khoản học sinh,
  sinh câu hỏi AI…) gọi **RPC** để máy chủ kiểm tra và ghi trong một giao dịch.
- `public.server_now()` trả về giờ máy chủ để tính hạn nộp và đồng hồ làm bài,
  không phụ thuộc đồng hồ trên máy người dùng.
- Câu hỏi trò chơi chỉ học sinh đọc được qua RPC `game_questions`, **không lộ câu hỏi
  đang dùng cho bài kiểm tra chưa đóng**.

## Tính năng hiện có

### Giáo viên

- Tạo/lưu lớp (mã lớp tự sinh), thêm học sinh bằng email, mã lớp,
  hoặc **tự tạo tài khoản cho học sinh** (tự đặt mật khẩu).
- Soạn chủ đề – bài học – mục tiêu; **tải tệp tài nguyên** (mọi định dạng: doc, docx, xlsx, pptx,
  PDF, ảnh, video, âm thanh, tệp code `.h/.cpp/.py/…` — tối đa 50 MB) và **liên kết**
  (YouTube, Canva, trang web) theo bài học; **xem trước** ảnh/PDF/video/âm thanh/tệp mã
  ngay trong trình duyệt — tệp Office và liên kết khác bấm là tải xuống hoặc mở trang web.
- Bài tập: giao đề, **rubric nhiều tiêu chí**, chấm điểm theo tiêu chí, cho phép nộp lại,
  thêm **lượt làm bù** cho từng học sinh; **xem trước tệp bài nộp** của học sinh ngay khi chấm.
- Ngân hàng câu hỏi (5 dạng, theo độ khó và cấp Bloom, gắn mục tiêu) — nhập/xuất **Excel**.
- Đề kiểm tra: chọn câu từ ngân hàng, cửa sổ mở/đóng, chấm tự động và chấm tay,
  tự cộng dồn điểm từng câu (không cần nhập tổng).
- **AI tạo câu hỏi nháp** cho một bài học (tối đa 20 câu/lượt, 5 lượt/ngày theo giờ Việt Nam),
  duyệt / sửa-và-duyệt / từ chối trước khi đưa vào ngân hàng; có thông báo khi AI xong.
- **Lịch & việc cần làm** tự động chốt theo hạn nộp và trạng thái chấm.
- **Báo cáo tiến bộ**: tổng hợp + chi tiết từng học sinh, xuất **Excel** (kể cả sheet
  Bảng điểm), **Word** và **in báo cáo** (bản in đã tối ưu cho máy in).
- **Thùng rác**: xóa mềm chủ đề/bài học/bài tập/câu hỏi và **khôi phục** lại.
- Xem lịch sử chơi của lớp; mức độ nắm vững, lỗ hổng kiến thức, gợi ý học tập;
  thông báo **Realtime** (tự cập nhật chuông, tự fallback polling 10 giây).

### Học sinh

- Vào lớp bằng mã lớp; xem bài học, mục tiêu và tài liệu đã xuất bản.
- Nộp/nộp lại bài tập bằng **tệp đính kèm** hoặc văn bản; **xem trước** tệp đã nộp; xem điểm,
  nhận xét, rubric.
- Làm bài kiểm tra có đồng hồ đếm ngược (tự lưu, tự nộp khi hết giờ, làm nhiều lượt
  theo số lượt giáo viên đặt — kể cả lượt bù).
- **Trò chơi ôn tập** 3 chế độ: Nhanh (60 giây), Đua tốc độ (10 câu × 20 giây),
  Sinh tồn (3 mạng) — chơi bằng câu hỏi trắc nghiệm của lớp, không ảnh hưởng điểm chính thức.
- Xem tiến độ, mức nắm vững, lỗ hổng kiến thức, đề xuất luyện tập, lịch & cần làm,
  báo cáo tiến bộ của bản thân; nhận thông báo Realtime.
