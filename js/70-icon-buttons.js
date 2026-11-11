/* EducMind · js/70-icon-buttons.js
   Tự gắn biểu tượng cho các nút theo nhãn (iconifyButtons). */
/* Chuyển nút hành động sang icon-only, giữ tên đầy đủ bằng aria-label và tooltip. */
function iconKeyForButton(b,label){
  if(b.classList.contains('nav')){const k=(b.id||'').replace('nav-','');return ({dashboard:'overview',overview:'lessons',classes:'classes',students:'students'})[k]||k}
  if(b.classList.contains('folder-tabs'))return 'more';
  if(b.closest('.folder-tabs'))return ({'Mục tiêu':'target','Bài tập & kiểm tra':'assignments','Chấm điểm & Kết quả':'grade','Ngân hàng câu hỏi':'questions','Mức độ nắm vững':'mastery','Lỗ hổng kiến thức':'gaps','Gợi ý học tập':'recommend'})[label]||'more';
  if(b.closest('.seg'))return ({'Danh sách chấm':'list','Chấm điểm':'grade','Kết quả':'assessments','Bài tập':'assignments','Bài tập':'assessments','Yêu cầu luyện tập':'target','Phân tích':'mastery','Lượt làm':'clock'})[label]||'more';
  if(b.classList.contains('topic-icon-btn'))return /sửa|chỉnh/i.test(label)?'edit':'plus';
  const t=String(label||'').toLocaleLowerCase('vi');
  if(/đăng xuất|log out/.test(t))return 'logout';
  if(/tạo bằng ai|ai soạn|trí tuệ nhân tạo/.test(t))return 'spark';
  if(/đăng nhập|log in/.test(t))return 'user';
  if(/tài khoản|hồ sơ/.test(t))return 'user';
  if(/thông báo/.test(t))return 'bell';
  if(/hủy xuất bản|huỷ xuất bản|ẩn bài|ẩn chủ đề/.test(t))return 'eyeOff';
  if(/xuất bản|phát hành|duyệt/.test(t))return 'check';
  if(/sửa|chỉnh sửa|edit/.test(t))return 'edit';
  if(/xóa|xoá|delete|gỡ câu|bỏ tất cả câu/.test(t))return 'trash';
  if(/lưu|save/.test(t))return 'save';
  if(/mật khẩu|password/.test(t))return 'save';
  if(/^đóng|^xong|^hoàn tất|^đồng ý|^ok$/.test(t))return 'check';
  if(/hủy|huỷ|cancel|bỏ qua|từ chối/.test(t))return 'close';
  if(/cấp thêm|thêm lượt|thêm học sinh|tạo|thêm|mới|new/.test(t))return 'plus';
  if(/thu hồi|khôi phục|hoàn tác|undo|restore/.test(t))return 'undo';
  if(/tải lên|chọn tệp|nhập từ|import/.test(t))return 'upload';
  if(/tải xuống|tải mẫu|download|xuất file/.test(t))return 'download';
  if(/gửi|send/.test(t))return 'send';
  if(/tìm|search/.test(t))return 'search';
  if(/lọc|filter/.test(t))return 'filter';
  if(/chấm|điểm|grade/.test(t))return 'grade';
  if(/kết quả|lượt làm|lịch sử/.test(t))return 'assessments';
  if(/xem|preview|chi tiết|mở|open/.test(t))return 'eye';
  /* hai nút trong màn làm bài trước đây cùng rơi về icon “…” vì không khớp mẫu nào */
  if(/tạm dừng|dừng lại|tạm ngưng|pause/.test(t))return 'pause';
  if(/nộp bài|nộp lại|gửi bài|submit/.test(t))return 'submit';
  if(/tiếp tục|bắt đầu|làm bài|play/.test(t))return 'play';
  if(/cấu hình|thiết lập|settings/.test(t))return 'settings';
  if(/câu hỏi|ngân hàng/.test(t))return 'questions';
  if(/bài kiểm tra|quiz/.test(t))return 'assessments';
  if(/bài tập|assignment/.test(t))return 'assignments';
  if(/học sinh|student/.test(t))return 'students';
  if(/chủ đề|bài học|thư mục|folder/.test(t))return 'lessons';
  if(/nắm vững|mức độ/.test(t))return 'mastery';
  if(/lỗ hổng/.test(t))return 'gaps';
  if(/gợi ý|recommend/.test(t))return 'recommend';
  if(/làm lại|chạy lại|tính lại/.test(t))return 'refresh';
  if(/ngày|hạn|lịch/.test(t))return 'calendar';
  if(/giờ|thời lượng|thời gian/.test(t))return 'clock';
  if(/ai|tạo nháp/.test(t))return 'spark';
  if(/xem thêm|more/.test(t))return 'plus';
  if(/thử|quyền|vai trò/.test(t))return 'lock';
  if(/mục tiêu/.test(t))return 'target';
  return 'more';
}
function iconifyButtons(){
  document.querySelectorAll('#app button.nav').forEach(b=>{const label=(b.textContent||'').replace(/\s+/g,' ').trim();if(label){b.setAttribute('aria-label',label);b.title=label}});
  const buttons=document.querySelectorAll('#app button.btn, #app button.topic-icon-btn, #app button.chip, #app button.mitem');
  buttons.forEach(b=>{
    if(b.dataset.iconified==='1'||b.hasAttribute('data-noicon'))return;
    if(b.closest('.asg-builder'))return;   /* trình tạo bài tập giữ nhãn chữ cho thao tác chính */
    const raw=(b.textContent||'').replace(/\s+/g,' ').trim();
    if(!raw)return; // cards and choices whose text is their content remain readable
    const accessible=b.getAttribute('aria-label')||raw;
    const tooltip=b.getAttribute('title')||accessible;
    const icon=iconKeyForButton(b,raw);
    if(!P[icon])return;
    b.setAttribute('aria-label',accessible);b.setAttribute('title',tooltip);b.classList.add('icon-only');b.dataset.iconified='1';
    b.innerHTML=ic(icon,18)+`<span class='sr'></span>`;b.querySelector('.sr').textContent=accessible;
  });
}
