/* EducMind · js/02-state.js
   Trạng thái chung của ứng dụng: lớp đang chọn, trang, vai trò, phiên đăng nhập.
   Lưu ý: Tệp này nạp trước mọi tệp khác có dùng trạng thái. appReady do js/76-main.js bật lên khi mọi tệp đã nạp xong. */
/* ===== Trạng thái ===== */
let current='10A1',page='overview',logged=false,role='T',focusId=null,sidebarCollapsed=false,sidebarWidth=292;
const app=document.getElementById('app');
/* Phiên đăng nhập và trạng thái màn hình đăng nhập (dùng chung cho chế độ demo và Supabase). */
let sess=null,authMode='login',authErr='',authMsg='',authEmail='',authTok=null,NID=0;
/* appReady: js/76-main.js bật cờ này khi mọi tệp đã nạp xong. Sự kiện đến sớm hơn
   (ví dụ mở liên kết đặt lại mật khẩu khi mạng chậm) chỉ ghi nhận trạng thái; màn hình được vẽ ở lần render() đầu tiên. */
let appReady=false;
