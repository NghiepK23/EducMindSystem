/* EducMind · js/33-login-screen.js
   Màn hình đăng nhập (authHtml), ảnh nền đăng nhập và ảnh nền ứng dụng. */
const LOGIN_BG_KEY='educmind.login.background.v1';
let authBgOpen=false;
function loginBgValue(){try{return localStorage.getItem(LOGIN_BG_KEY)||''}catch(e){return ''}}
function applyLoginBackground(){
  const el=document.querySelector('.login-wrap');if(!el)return;
  const src=loginBgValue();
  if(!src){el.style.backgroundImage='none';return}
  const escaped=src.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\n\r]/g,'');
  el.style.backgroundImage='linear-gradient(135deg,rgba(11,22,40,.10),rgba(11,22,40,.02)),url("'+escaped+'")';
  el.style.backgroundPosition='center,center';el.style.backgroundSize='cover,cover';el.style.backgroundRepeat='no-repeat,no-repeat';
}
function loginBgStatus(message){const el=document.getElementById('login-bg-status');if(el)el.textContent=message}
function toggleLoginBgPanel(){
  const panel=document.getElementById('login-bg-panel'),btn=document.getElementById('login-bg-trigger');if(!panel)return;
  authBgOpen=!authBgOpen;panel.hidden=!authBgOpen;if(btn)btn.setAttribute('aria-expanded',String(authBgOpen));
}
function storeLoginBackground(value){
  try{localStorage.setItem(LOGIN_BG_KEY,value);applyLoginBackground();loginBgStatus('Nền đăng nhập đã được cập nhật và lưu trên thiết bị này.');return true}
  catch(e){loginBgStatus('Không lưu được ảnh nền. Hãy dùng ảnh nhỏ hơn hoặc giải phóng dung lượng trình duyệt.');return false}
}
function loginBgImageUrl(raw){
  const u=new URL(raw),host=u.hostname.toLowerCase();if(!['http:','https:'].includes(u.protocol))throw new Error('protocol');
  if((host==='pexels.com'||host.endsWith('.pexels.com'))&&!host.startsWith('images.')){
    const m=u.pathname.match(/-(\d+)\/?$/);if(!m)throw new Error('pexels-page');
    return 'https://images.pexels.com/photos/'+m[1]+'/pexels-photo-'+m[1]+'.jpeg?auto=compress&cs=tinysrgb&w=1920';
  }
  if((host==='unsplash.com'||host.endsWith('.unsplash.com'))&&!host.startsWith('images.'))throw new Error('unsplash-page');
  return u.href;
}
function applyLoginBgUrl(){
  const input=document.getElementById('login-bg-url'),raw=(input&&input.value||'').trim();if(!raw){loginBgStatus('Hãy dán liên kết ảnh trực tiếp.');return}
  let url;try{url=loginBgImageUrl(raw)}catch(e){
    loginBgStatus(e.message==='pexels-page'?'Không tìm thấy mã ảnh trong liên kết Pexels. Hãy dùng liên kết trang ảnh hoặc URL CDN trực tiếp.':e.message==='unsplash-page'?'Đây là link trang Unsplash, không phải tệp ảnh. Mở ảnh, nhấp phải và chọn “Sao chép địa chỉ hình ảnh”, rồi dán URL images.unsplash.com.':'Liên kết chưa hợp lệ. Hãy dùng URL công khai bắt đầu bằng http:// hoặc https://.');return
  }
  loginBgStatus('Đang kiểm tra ảnh…');const probe=new Image();probe.onload=()=>{storeLoginBackground(url)};
  probe.onerror=()=>loginBgStatus('Không tải được ảnh từ liên kết này (có thể đây là trang web, không phải ảnh, hoặc bản xem trước đang chặn mạng). Hãy dùng địa chỉ ảnh trực tiếp hoặc tải ảnh về rồi chọn “Tải ảnh lên”.');
  probe.src=url;
}
function uploadLoginBg(file){
  if(!file)return;if(!/^image\/(png|jpeg|webp|gif)$/i.test(file.type)){loginBgStatus('Hãy chọn ảnh PNG, JPG, WEBP hoặc GIF.');return}
  if(file.size>15*1024*1024){loginBgStatus('Ảnh tải lên cần nhỏ hơn 15 MB.');return}
  const reader=new FileReader();reader.onerror=()=>loginBgStatus('Không đọc được tệp ảnh.');
  reader.onload=()=>{const img=new Image();img.onerror=()=>loginBgStatus('Tệp này không phải ảnh hợp lệ.');img.onload=()=>{
    try{const maxW=1920,maxH=1200,scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const cx=canvas.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(img,0,0,w,h);storeLoginBackground(canvas.toDataURL('image/jpeg',.84))}
    catch(e){loginBgStatus('Không thể xử lý ảnh này. Hãy thử PNG, JPG hoặc WEBP khác.')}
  };img.src=String(reader.result||'')};reader.readAsDataURL(file)
}
function clearLoginBackground(){try{localStorage.removeItem(LOGIN_BG_KEY)}catch(e){}applyLoginBackground();loginBgStatus('Đã xóa ảnh nền và trở về màu nền mặc định.')}
function loginBackgroundControls(){return `<div class='login-bg-controls'><button type='button' class='login-bg-trigger' id='login-bg-trigger' aria-expanded='${authBgOpen}' aria-controls='login-bg-panel' onclick='toggleLoginBgPanel()'><span aria-hidden='true'>▧</span> Đổi ảnh nền</button><section class='login-bg-panel' id='login-bg-panel' aria-labelledby='login-bg-title' ${authBgOpen?'':'hidden'}><h2 id='login-bg-title'>Ảnh nền đăng nhập</h2><p>Dán URL ảnh trực tiếp hoặc link trang ảnh Pexels (hệ thống sẽ thử chuyển sang CDN). Với Unsplash, hãy mở ảnh rồi chọn “Sao chép địa chỉ hình ảnh”. Nếu preview chặn mạng, tải ảnh về và upload. Ảnh lưu trên trình duyệt này.</p><label for='login-bg-url'>Liên kết ảnh</label><input id='login-bg-url' type='url' placeholder='https://images.unsplash.com/photo-…' inputmode='url'><div class='login-bg-links'>Tìm ảnh tại <a href='https://unsplash.com/' target='_blank' rel='noopener noreferrer'>Unsplash</a><a href='https://www.pexels.com/' target='_blank' rel='noopener noreferrer'>Pexels</a></div><div class='login-bg-actions'><button type='button' class='btn' onclick='applyLoginBgUrl()'>Dùng liên kết</button><button type='button' class='btn light' onclick='clearLoginBackground()'>Xóa nền</button></div><label for='login-bg-file'>Hoặc tải ảnh lên</label><input id='login-bg-file' type='file' accept='image/png,image/jpeg,image/webp,image/gif' onchange='uploadLoginBg(this.files&&this.files[0]);this.value=""'><div class='login-bg-status' id='login-bg-status' role='status'></div></section></div>`}
const LOGIN_CARD_THEME_KEY='educmind.login-card.theme';
function loginCardDarkEnabled(){try{return localStorage.getItem(LOGIN_CARD_THEME_KEY)==='dark'}catch(e){return false}}
function loginCardThemeIcon(dark){return dark?`<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='4'/><path d='M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42'/></svg>`:`<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M20.8 13A8.5 8.5 0 0 1 11 3.2 8.7 8.7 0 1 0 20.8 13Z'/><path d='M16.5 3.5v3m-1.5-1.5h3'/></svg>`}
function loginCardThemeButton(){const dark=loginCardDarkEnabled();return `<button type='button' class='login-theme-toggle' id='login-card-theme-toggle' aria-label='${dark?'Bật chế độ sáng':'Bật chế độ tối'} riêng cho thẻ đăng nhập' title='${dark?'Bật chế độ sáng':'Bật chế độ tối'} cho thẻ đăng nhập' aria-pressed='${dark}' onclick='toggleLoginCardTheme()'>${loginCardThemeIcon(dark)}</button>`}
function toggleLoginCardTheme(){
  const card=document.querySelector('.login'),btn=document.getElementById('login-card-theme-toggle');if(!card)return;
  const dark=!card.classList.contains('login-dark');card.classList.toggle('login-dark',dark);
  try{localStorage.setItem(LOGIN_CARD_THEME_KEY,dark?'dark':'light')}catch(e){}
  if(btn){btn.setAttribute('aria-pressed',String(dark));btn.setAttribute('aria-label',(dark?'Bật chế độ sáng':'Bật chế độ tối')+' riêng cho thẻ đăng nhập');btn.title=(dark?'Bật chế độ sáng':'Bật chế độ tối')+' cho thẻ đăng nhập';btn.innerHTML=loginCardThemeIcon(dark)}
}
function authHtml(){
  document.title='Đăng nhập | EducMind';
  const logo=brandLogoHtml();
  const err=authErr?`<div class='notice' role='alert' style='background:var(--err-bg);color:var(--err-ink)'>${ic('alert',16)}<div>${esc(authErr)}</div></div>`:'',msg=authMsg?`<div class='notice' role='status'>${ic('info',16)}<div>${esc(authMsg)}</div></div>`:'';
  const back=`<button class='btn light' type='button' style='width:100%;justify-content:center;margin-top:8px' onclick='goLogin()'>Quay lại đăng nhập</button>`;
  let b;
  if(authMode==='forgot')b=`<h1 id='pageTitle' tabindex='-1'>Quên mật khẩu</h1><p class='sub'>Nhập email, hệ thống sẽ gửi đường dẫn đặt lại mật khẩu.</p>${err}<form onsubmit='doForgot();return false'><div class='field'><label for='em'>Email</label><input id='em' type='email' value="${esc(authEmail)}" autocomplete='username'></div><button class='btn' id='loginBtn' type='submit'>Gửi đường dẫn</button></form>${back}`;
  else if(authMode==='signup')b=`<h1 id='pageTitle' tabindex='-1'>Tạo tài khoản</h1><p class='sub'>Chọn đúng vai trò: vai trò không đổi được sau khi tạo tài khoản.</p>${err}${msg}<form onsubmit='backendSignup();return false' novalidate><fieldset class='su-role'><legend>Tôi là</legend><label><input type='radio' name='su-role' value='STUDENT' ${authSignupRole!=='TEACHER'?'checked':''}><span>Học sinh</span></label><label><input type='radio' name='su-role' value='TEACHER' ${authSignupRole==='TEACHER'?'checked':''}><span>Giáo viên</span></label></fieldset><div class='field'><label for='su-name'>Họ và tên</label><input id='su-name' autocomplete='name' value="${esc(authSignupName)}" required></div><div class='field'><label for='em'>Email</label><input id='em' type='email' value="${esc(authEmail)}" autocomplete='email' required></div><div class='field'><label for='pw'>Mật khẩu</label><input id='pw' type='password' autocomplete='new-password' aria-describedby='pw-hint' required><div class='muted' id='pw-hint' style='font-size:.78rem'>Tối thiểu ${PW_MIN} ký tự.</div></div><div class='field'><label for='pw2'>Nhập lại mật khẩu</label><input id='pw2' type='password' autocomplete='new-password' required></div><button class='btn' type='submit' ${backendBusy?'disabled':''}>${backendBusy?'Đang tạo…':'Tạo tài khoản'}</button></form>${back}`;
  else if(authMode==='reset')b=`<h1 id='pageTitle' tabindex='-1'>Đặt mật khẩu mới</h1><p class='sub'>Mật khẩu tối thiểu ${PW_MIN} ký tự. Mỗi đường dẫn chỉ dùng được một lần.</p>${err}<form onsubmit='doReset();return false'><div class='field'><label for='np'>Mật khẩu mới</label><input id='np' type='password' autocomplete='new-password'></div><div class='field'><label for='np2'>Nhập lại mật khẩu mới</label><input id='np2' type='password' autocomplete='new-password'></div><button class='btn' id='loginBtn' type='submit'>Lưu mật khẩu</button></form>${back}`;
  else{
    const mm=MAIL.map((m,i)=>({m,i})).filter(x=>mailFor&&x.m.to===mailFor).slice(0,3),mb=mm.length?`<div style='margin-top:18px'><b style='font-size:13px'>Hộp thư mô phỏng của ${esc(mailFor)}</b><div class='muted' style='font-size:12px'>Chỉ để thử nghiệm: thực tế thư chỉ gửi vào hộp thư của chính chủ tài khoản, không hiển thị ở trang đăng nhập.</div>${mm.map(({m,i})=>{const t=TOKS.find(x=>x.hash===hashPw(m.raw)),st=t.used?'Đã dùng hoặc bị thay thế':simNow()>t.exp?'Đã hết hạn':'Còn hiệu lực';return `<div class='item' style='display:block;padding:9px 0'><b>${esc(m.subject)}</b><div class='muted'>Gửi tới ${esc(m.to)} · ${st}</div><button class='btn light' type='button' style='margin-top:6px' onclick='openLink(${i})'>Mở đường dẫn</button></div>`}).join('')}</div>`:'';
    b=`<h1 id='pageTitle' tabindex='-1'>Đăng nhập</h1><p class='sub'>Đăng nhập bằng email và mật khẩu bạn đã đăng ký — dữ liệu được lưu trên máy chủ, giữ nguyên khi tải lại trang.</p>${msg}${err}<form onsubmit='doLogin();return false'><div class='field'><label for='em'>Email</label><input id='em' type='email' value="${esc(authEmail)}" autocomplete='username' required></div><div class='field'><label for='pw'>Mật khẩu</label><input id='pw' type='password' autocomplete='current-password' required></div><button class='btn' id='loginBtn' type='submit' ${backendBusy?'disabled':''}>${backendBusy?'Đang đăng nhập…':'Đăng nhập'}</button></form><button class='btn light' type='button' style='width:100%;justify-content:center;margin-top:8px' onclick='authMode="signup";authErr="";authMsg="";render()'>Tạo tài khoản</button><button class='btn light' type='button' style='width:100%;justify-content:center;margin-top:8px' onclick='goForgot()'>Quên mật khẩu?</button><div class='row login-quick-actions' style='margin-top:16px'>${quickList().map((q,i)=>`<button class='btn light' type='button' id='quickLogin-${i}'>${esc(q.label)} · dùng thử</button>`).join('')}</div><p class='muted' style='font-size:.78rem;margin-top:8px'>⚠️ Tài khoản mẫu chỉ để xem thử giao diện: dữ liệu nằm trong bộ nhớ, <b>không được lưu</b> — tải lại trang là mất. Muốn dùng lâu dài, hãy bấm “Tạo tài khoản”.</p>${mb}`;
  }
  app.innerHTML=`<main class='login-wrap'><div class='login ${loginCardDarkEnabled()?'login-dark':''}'>${logo}${loginCardThemeButton()}${b}</div>${loginBackgroundControls()}</main>`;
  applyLoginBackground();
  quickList().forEach((q,i)=>{const btn=document.getElementById('quickLogin-'+i);if(btn)btn.addEventListener('click',()=>quickLogin(i))});
  return true;
}
/* Nền riêng của layer 4, lưu cục bộ theo từng tài khoản giáo viên/học sinh. */
function layer4BackgroundKey(){return 'educmind.layer4-background:'+String((sess&&sess.email)||'guest').toLowerCase()}
function layer4BackgroundData(){try{return localStorage.getItem(layer4BackgroundKey())||''}catch(e){return ''}}
function applyLayer4Background(){
  const layout=document.querySelector('#app .layout');
  if(!layout)return;
  const data=layer4BackgroundData();
  // Keep the image tied to the viewport, not to #main's changing content height.
  layout.style.removeProperty('background-image');
  layout.style.removeProperty('background-size');
  layout.style.removeProperty('background-position');
  layout.style.removeProperty('background-repeat');
  if(data&&/^data:image\//i.test(data))layout.style.setProperty('--layer4-bg-image',`url("${data}")`);
  else layout.style.removeProperty('--layer4-bg-image');
}
function clearLayer4Background(){
  try{localStorage.removeItem(layer4BackgroundKey())}catch(e){}
  applyLayer4Background();toast('Đã xóa ảnh nền của layer 4.');openAccount();
}
