/* EducMind · js/34-account.js
   Hộp thoại Tài khoản: ảnh đại diện, đổi mật khẩu, kiểm soát vai trò. */
/* --- US-G04: tài khoản, đổi mật khẩu, kiểm soát vai trò --- */
function openAccount(){
  const a=acctRec(),av=avOf();
  const curTheme=(AV_THEMES.find(x=>x[0]===(av.theme||'default'))||AV_THEMES[0])[1];
  openDlg({
    title:'Tài khoản của bạn',
    okLabel:'Lưu thay đổi',
    text:`<span style='display:flex;align-items:center;gap:12px'>${avatarHtml(true)}<span><b style='font-size:14px'>${esc(a.name||sess.email)}</b><br><span class='muted'>${esc(sess.email)}</span></span></span>`
      +`<span style='display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0'><button type='button' class='btn light' data-noicon onclick='changePw()'>Đổi mật khẩu</button>`
      +(av.photo?`<button type='button' class='btn light' data-noicon onclick='clearAvatar()'>Xoá ảnh đại diện</button>`:'')
      +(layer4BackgroundData()?`<button type='button' class='btn light' data-noicon onclick='clearLayer4Background()'>Xóa ảnh nền layer 4</button>`:'')+`</span>`
      +`<span class='muted' style='display:block;font-size:12px;margin:10px 0 0'>Email đăng nhập không thay đổi được. Phiên tự hết hạn sau ${SESS_IDLE} phút không hoạt động.</span>`,
    fields:[
      {k:'n',label:'Tên hiển thị',val:a.name||''},
      {k:'av',label:'Màu ảnh đại diện',sel:AV_THEMES.map(x=>x[1]),val:curTheme},
      {k:'ph',label:'Tải ảnh đại diện lên (tệp ảnh, tối đa 2 MB)',file:true,accept:'image/*'},
      {k:'bg',label:'Ảnh nền cho layer 4 (tối đa 2 MB)',file:true,accept:'image/*'}
    ].concat(role==='T'?[{k:'aik',label:'Khoá API Gemini',val:(a.aiKey||''),pw:true}]:[]),
    ok:v=>{
      const nm=String(v.n||'').trim();
      if(nm.length<2)return 'Tên hiển thị phải có ít nhất 2 ký tự.';
      if(nm.length>60)return 'Tên hiển thị tối đa 60 ký tự.';
      const f=v.ph_f,bg=v.bg_f;
      if(f){
        if(!/^image\//.test(f.type||''))return 'Ảnh đại diện phải là tệp hình ảnh.';
        if(f.size>2*1024*1024)return 'Ảnh đại diện vượt giới hạn 2 MB.';
      }
      if(bg){
        if(!/^image\//.test(bg.type||''))return 'Ảnh nền phải là tệp hình ảnh.';
        if(bg.size>2*1024*1024)return 'Ảnh nền vượt giới hạn 2 MB.';
      }
      const cur=acctRec(),theme=AV_KEYS[AV_THEMES.findIndex(x=>x[1]===v.av)]||'default';
      cur.name=nm;cur.avatar=Object.assign({},cur.avatar||{},{theme});
      if(role==='T')cur.aiKey=String(v.aik||'').trim();
      if(f){
        const rd=new FileReader();
        rd.onload=()=>{cur.avatar=Object.assign({},cur.avatar||{},{photo:rd.result});toast('Đã cập nhật ảnh đại diện.');render()};
        rd.onerror=()=>{toast('Không đọc được tệp ảnh. Thông tin khác đã được lưu.')};
        rd.readAsDataURL(f);
      }
      if(bg){
        const rdBg=new FileReader();
        rdBg.onload=()=>{
          try{localStorage.setItem(layer4BackgroundKey(),String(rdBg.result||''));applyLayer4Background();toast('Đã cập nhật ảnh nền layer 4.')}
          catch(e){toast('Không lưu được ảnh nền trong trình duyệt. Hãy dùng ảnh nhỏ hơn.')}
        };
        rdBg.onerror=()=>toast('Không đọc được tệp ảnh nền.');
        rdBg.readAsDataURL(bg);
      }
      toast('Đã cập nhật thông tin tài khoản.');
      return null;
    }
  });
}
function clearAvatar(){const a=acctRec();if(a&&a.avatar)delete a.avatar.photo;dlg=null;render();toast('Đã xoá ảnh đại diện.')}
function changePw(force){
  const a0=ACCT[sess.email],f=!!force&&!!a0.mustChange;
  openDlg({title:f?'Đặt mật khẩu riêng cho tài khoản':'Đổi mật khẩu',okLabel:f?'Đặt mật khẩu':'Đổi mật khẩu',text:f?'Tài khoản của em được giáo viên tạo với mật khẩu mặc định. Để bảo mật, em cần tự đặt mật khẩu riêng (khác mật khẩu mặc định). Chỉ em biết mật khẩu này; thông báo nhắc đặt mật khẩu sẽ tự mất sau khi em đặt thành công.':'Chỉ đổi được mật khẩu của chính tài khoản đang đăng nhập.',fields:[{k:'o',label:f?'Mật khẩu mặc định hiện tại':'Mật khẩu hiện tại',val:'',pw:true},{k:'n',label:'Mật khẩu mới (tối thiểu '+PW_MIN+' ký tự)',val:'',pw:true},{k:'c',label:'Nhập lại mật khẩu mới',val:'',pw:true}],ok:v=>{
    const a=ACCT[sess.email];
    if(a.pw!==hashPw(v.o))return f?'Mật khẩu mặc định không đúng.':'Mật khẩu hiện tại không đúng.';
    if(v.n.length<PW_MIN)return 'Mật khẩu mới phải có ít nhất '+PW_MIN+' ký tự.';
    if(v.n!==v.c)return 'Hai lần nhập mật khẩu mới không khớp.';
    if(a.pw===hashPw(v.n))return 'Mật khẩu mới phải khác mật khẩu '+(f?'mặc định':'hiện tại')+'.';
    a.pw=hashPw(v.n);a.mustChange=false;dropSetpwNotif(sess.email);toast(f?'Đã đặt mật khẩu riêng. Từ lần sau hãy đăng nhập bằng mật khẩu này.':'Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.');return null}});
}
/* Giữ nguyên logic phân quyền: chỉ bỏ nút thử nghiệm khỏi hộp thoại Tài khoản, hàm vẫn dùng được khi cần kiểm thử. */
function tryOther(){dlg=null;render();toast('Bị từ chối: tài khoản '+(role==='T'?'giáo viên':'học sinh')+' không được truy cập chức năng của '+(role==='T'?'học sinh':'giáo viên')+'.')}
/* Giữ nguyên logic hết hạn phiên (authGuard vẫn kiểm tra sess.exp), chỉ bỏ nút mô phỏng khỏi giao diện. */
function expireSess(){dlg=null;sess.exp=true;render()}
