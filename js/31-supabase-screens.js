/* EducMind · js/31-supabase-screens.js
   Đăng nhập / đăng ký bằng Supabase và khôi phục phiên. Sau khi đăng nhập, các màn hình dữ liệu thật nằm trong js/db/. */
/* Giữ lại họ tên và vai trò đã nhập ở biểu mẫu đăng ký khi biểu mẫu được vẽ lại (ví dụ sau một lỗi nhập liệu). */
let authSignupName='',authSignupRole='STUDENT';
function backendErrorText(e){
  const m=String(e?.message||'');
  if(/Invalid login credentials/i.test(m))return 'Email hoặc mật khẩu không đúng.';
  if(/Email not confirmed/i.test(m))return 'Email chưa được xác nhận. Hãy mở thư và nhập mã xác nhận rồi đăng nhập lại.';
  if(/User already registered/i.test(m))return 'Email này đã có tài khoản.';
  if(/Password should be at least/i.test(m))return 'Mật khẩu quá ngắn.';
  if(/rate limit|too many requests|over_email_send_rate_limit/i.test(m))return 'Hệ thống gửi quá nhiều thư trong thời gian ngắn. Hãy thử lại sau ít phút.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Không kết nối được Supabase. Hãy kiểm tra mạng rồi thử lại.';
  return m||'Không thể kết nối Supabase. Hãy kiểm tra mạng và cấu hình Auth.';
}
async function backendLogin(){
  if(!supabaseClient){authErr='Không tải được Supabase SDK. Hãy kết nối Internet rồi tải lại trang.';render();return}
  const em=(document.getElementById('em')?.value||'').trim().toLowerCase(),pw=document.getElementById('pw')?.value||'';
  authEmail=em;authErr='';authMsg='';
  if(!em||!pw){authErr='Nhập email và mật khẩu.';render();return}
  backendBusy=true;render();
  const {data,error}=await supabaseClient.auth.signInWithPassword({email:em,password:pw});
  backendBusy=false;
  if(error){authErr='Đăng nhập thất bại: '+backendErrorText(error);render();return}
  await activateBackendSession(data.session);
}
/* Đăng ký: người dùng tự chọn vai trò (học sinh hoặc giáo viên). Máy chủ ghi vai trò vào hồ sơ một lần duy nhất khi tạo tài khoản. */
async function backendSignup(){
  if(!supabaseClient){authErr='Không tải được Supabase SDK. Hãy kết nối Internet rồi tải lại trang.';render();return}
  const name=(document.getElementById('su-name')?.value||'').trim(),email=(document.getElementById('em')?.value||'').trim().toLowerCase(),
    pw=document.getElementById('pw')?.value||'',pw2=document.getElementById('pw2')?.value||'',
    suRole=document.querySelector('input[name="su-role"]:checked')?.value==='TEACHER'?'TEACHER':'STUDENT';
  authEmail=email;authSignupName=name;authSignupRole=suRole;
  if(!name){authErr='Nhập họ và tên.';render();return}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){authErr='Nhập đúng địa chỉ email.';render();return}
  if(pw.length<PW_MIN){authErr='Mật khẩu cần ít nhất '+PW_MIN+' ký tự.';render();return}
  if(pw!==pw2){authErr='Hai mật khẩu không khớp.';render();return}
  backendBusy=true;authErr='';authMsg='';render();
  const {data,error}=await supabaseClient.auth.signUp({email,password:pw,options:{data:{full_name:name,role:suRole},emailRedirectTo:location.href.split('#')[0]}});
  backendBusy=false;
  if(error){authErr='Không tạo được tài khoản: '+backendErrorText(error);render();return}
  if(data.session){authSignupName='';await activateBackendSession(data.session);return}
  /* Supabase trả về người dùng không có "identities" khi email đã được đăng ký từ trước: không có thư nào được gửi. */
  if(data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){
    authMode='login';authMsg='';authErr='Email '+email+' đã có tài khoản. Hãy đăng nhập, hoặc bấm “Quên mật khẩu?” nếu không nhớ mật khẩu.';render();return;
  }
  authMode='verify-signup';
  authMsg='Đã tạo tài khoản '+(suRole==='TEACHER'?'giáo viên':'học sinh')+'. Hãy nhập mã xác nhận trong thư gửi tới '+email+'.';render();
}
async function activateBackendSession(session){
  if(!session?.user){authErr='Không nhận được phiên đăng nhập.';render();return}
  /* Yêu cầu khôi phục mật khẩu: không vào app, hiện màn hình đặt mật khẩu mới. */
  if(backendRecovery){authMode='reset';render();return}
  /* Hồ sơ (bảng profiles) cho biết vai trò. Chỉ khi đọc được hồ sơ mới coi là đã đăng nhập. */
  const {data:profile,error}=await supabaseClient.from('profiles').select('id,email,full_name,role').eq('id',session.user.id).maybeSingle();
  if(error||!profile){
    await supabaseClient.auth.signOut();
    authErr='Không đọc được hồ sơ tài khoản'+(error?': '+backendErrorText(error):'. Tài khoản chưa có hồ sơ trong bảng profiles.');render();return;
  }
  sess={email:profile.email||session.user.email,role:profile.role==='TEACHER'?'T':'S',t:Date.now(),backend:true,userId:profile.id};
  role=sess.role;logged=true;dlg=null;authErr='';authMsg='';authEmail='';
  await dbStart(profile);
}
async function restoreBackendSession(){
  if(!supabaseClient||backendRecovery)return;
  const {data,error}=await supabaseClient.auth.getSession();
  if(error||!data.session||backendRecovery)return;
  await activateBackendSession(data.session);
}
