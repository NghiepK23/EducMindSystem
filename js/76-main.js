/* EducMind · js/76-main.js
   Khởi động ứng dụng: vẽ màn hình đầu tiên và khôi phục phiên Supabase.
   Lưu ý: Tệp cuối cùng của ứng dụng. Mọi hàm và dữ liệu phải được nạp trước tệp này. */
/* Mọi tệp đã nạp xong: từ đây mới vẽ giao diện và khôi phục phiên đăng nhập Supabase (nếu có). */
appReady=true;
render();
restoreBackendSession().catch(e=>{console.error('Supabase session restore:',e);authErr='Không khôi phục được phiên Supabase.';render()});


/* Đóng preview khi click ra ngoài khung resPreviewBox */
document.addEventListener('click',(e)=>{
  const box=document.getElementById('resPreviewBox');
  if(!box || !box.dataset.previewId)return;
  if(box.contains(e.target))return;
  const oldUrl=box.dataset.previewUrl;
  if(oldUrl)URL.revokeObjectURL(oldUrl);
  box.innerHTML='';
  delete box.dataset.previewId;
  delete box.dataset.previewUrl;
});
