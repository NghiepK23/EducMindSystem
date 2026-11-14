/* EducMind · js/32-auth-flows.js
   Luồng đăng nhập demo, quên mật khẩu và đặt lại mật khẩu. */
/* quickLogin (đăng nhập demo) đã gỡ bỏ. */
let mailFor='';
function goLogin(){authMode='login';authErr='';authMsg='';mailFor='';render()}
function goForgot(){authMode='forgot';authErr='';authMsg='';mailFor='';render()}
function openLink(i){authTok=MAIL[i].raw;authMode='reset';authErr='';authMsg='';render()}
function doLogin(e,p){
  if(p==null){backendLogin();return}
  const em=(e||document.getElementById('em').value||'').trim().toLowerCase(),pw=p;
  authEmail=em;mailFor='';const a=ACCT[em];
  if(!a||a.deleted||a.pw==null||a.pw!==hashPw(pw)){authErr='Email hoặc mật khẩu không đúng.';authMsg='';render();return}
  let cl=null;
  if(a.role==='STUDENT'){cl=classes.find(x=>x.students.some(s=>s.email===em));if(!cl){authErr='Tài khoản chưa thuộc lớp nào. Hãy liên hệ giáo viên.';authMsg='';render();return}}
  sess={email:em,role:a.role==='TEACHER'?'T':'S',t:Date.now()};role=sess.role;logged=true;authErr='';authMsg='';authEmail='';
  if(cl){current=cl.id;page='lessons'}else{page='overview';const vc=visClasses();if(!vc.some(x=>x.id===current)&&vc[0])current=vc[0].id}
  taking=false;stuLessonView=null;stuLessonTab='goals';folderTopicId=null;folderLessonName=null;folderModule='goals';focusId='pageTitle';render();window.scrollTo(0,0);
  if(a.mustChange)openNotifs();
}
function doForgot(){
  const em=(document.getElementById('em').value||'').trim().toLowerCase();authEmail=em;
  if(supabaseClient&&authMode==='forgot'&&!sess?.backend){
    backendBusy=true;authErr='';authMsg='';render();
    supabaseClient.auth.resetPasswordForEmail(em,{redirectTo:location.href.split('#')[0]}).then(({error})=>{
      backendBusy=false;authMode=error?'forgot':'verify-recovery';
      authErr=error?'Không gửi được mã đặt lại mật khẩu: '+backendErrorText(error):'';
      authMsg=error?'':'Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi.';
      render();
    });return;
  }
  mailFor='';if(ACCT[em]&&!ACCT[em].deleted){sendReset(em,false);mailFor=em}
  authMode='login';authErr='';authMsg='Nếu email tồn tại trong hệ thống, đường dẫn đặt lại mật khẩu đã được gửi. Đường dẫn có hiệu lực '+RESET_MIN+' phút.';render();
}
async function verifyBackendCode(purpose){
  if(!supabaseClient)return;
  const token=(document.getElementById('auth-code')?.value||'').trim();
  if(!/^\d{6,10}$/.test(token)){authErr='Nhập mã gồm 6–10 chữ số trong email.';render();return}
  const email=authEmail.trim().toLowerCase();
  backendBusy=true;authErr='';authMsg='';render();
  const {data,error}=await supabaseClient.auth.verifyOtp({email,token,type:purpose==='signup'?'email':'recovery'});
  backendBusy=false;
  if(error){authErr='Mã xác nhận không hợp lệ hoặc đã hết hạn: '+backendErrorText(error);render();return}
  if(purpose==='recovery'){
    if(!data.session){authErr='Mã đã được xác nhận nhưng chưa mở được phiên đặt lại mật khẩu. Hãy gửi mã mới.';authMode='login';render();return}
    backendRecovery=true;authMode='reset';authErr='';authMsg='Mã đã xác nhận. Hãy đặt mật khẩu mới.';render();return;
  }
  if(!data.session){authErr='Mã đã xác nhận nhưng chưa mở được phiên đăng nhập. Hãy thử đăng nhập lại.';authMode='login';render();return}
  authSignupName='';await activateBackendSession(data.session);
}
async function resendBackendCode(purpose){
  if(!supabaseClient)return;
  const email=authEmail.trim().toLowerCase();
  backendBusy=true;authErr='';authMsg='';render();
  const result=purpose==='signup'
    ? await supabaseClient.auth.resend({type:'signup',email})
    : await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('#')[0]});
  backendBusy=false;
  if(result.error){authErr='Không gửi lại được mã: '+backendErrorText(result.error);render();return}
  authMsg=purpose==='signup'?'Nếu tài khoản chưa được xác nhận, mã xác nhận đã được gửi lại.':'Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi lại.';
  render();
}
function doReset(){
  const n=document.getElementById('np').value,n2=document.getElementById('np2').value;
  if(backendRecovery&&supabaseClient){if(n.length<PW_MIN){authErr='Mật khẩu mới phải có ít nhất '+PW_MIN+' ký tự.';render();return}if(n!==n2){authErr='Hai lần nhập mật khẩu không khớp.';render();return}backendBusy=true;authErr='';render();supabaseClient.auth.updateUser({password:n}).then(async({error})=>{backendBusy=false;if(error){authErr='Không cập nhật được mật khẩu: '+backendErrorText(error);render();return}backendRecovery=false;await supabaseClient.auth.signOut();logged=false;sess=null;role='T';authMode='login';authEmail='';authMsg='Đã cập nhật mật khẩu. Hãy đăng nhập lại.';render()});return}
  const t=tokRec();
  if(!t||t.used||simNow()>t.exp){authMode='login';authTok=null;authMsg='';mailFor='';authErr='Mã đặt lại không đúng, đã dùng hoặc đã hết hạn. Hãy gửi lại yêu cầu mới.';render();return}
  if(n.length<PW_MIN){authErr='Mật khẩu mới phải có ít nhất '+PW_MIN+' ký tự.';render();return}
  if(n!==n2){authErr='Hai lần nhập mật khẩu không khớp.';render();return}
  ACCT[t.email].pw=hashPw(n);ACCT[t.email].mustChange=false;dropSetpwNotif(t.email);mailFor='';t.used=true;authTok=null;authMode='login';authErr='';authEmail=t.email;authMsg='Đã đặt mật khẩu. Hãy đăng nhập bằng mật khẩu mới.';render();
}
