/* EducMind · js/09-render.js
   Hàm render(): chọn màn hình theo trạng thái đăng nhập, vai trò và trang hiện tại. */
/* ===== Hiển thị ===== */
/* Tay nắm thu gọn bám đúng mép phải của thẻ điều hướng, luôn ở giữa chiều cao cửa sổ */
function placeSideToggle(){
  const t=document.querySelector('.side-toggle'),n=document.querySelector('.side');
  if(!t||!n){return}
  const r=n.getBoundingClientRect();
  if(window.innerWidth<=900){
    t.style.removeProperty('--tog-x');
    const y=Math.round(r.top+(r.height-(t.offsetHeight||40))/2)+'px';
    if(t.style.getPropertyValue('--tog-y')!==y)t.style.setProperty('--tog-y',y);
    return;
  }
  t.style.removeProperty('--tog-y');
  const half=t.offsetWidth/2||15,x=Math.round(r.right-half)+'px';
  if(t.style.getPropertyValue('--tog-x')!==x)t.style.setProperty('--tog-x',x);
}
addEventListener('resize',()=>requestAnimationFrame(placeSideToggle));
addEventListener('scroll',()=>{if(window.innerWidth<=900)requestAnimationFrame(placeSideToggle)},{passive:true});
function render(){authGuard();scanEvents();
  try{
    if(logged&&sess?.backend){renderBackendHome()}
    else if(!logged&&authHtml()){}else if(!logged){
      document.title='Đăng nhập | EducMind';
      app.innerHTML=`<main class="login-wrap"><div class="login">
        ${brandLogoHtml()}
        <h1 id="pageTitle" tabindex="-1">Đăng nhập giáo viên</h1>
        
        <div class="field"><label for="em">Email</label><input id="em" value="co.lan@educmind.vn" readonly></div>
        <div class="field"><label for="pw">Mật khẩu demo</label><input id="pw" value="demo123" readonly></div>
        <button class="btn" id="loginBtn" onclick="login()">Đăng nhập với cô Lan</button>
        ${note('Tài khoản duy nhất: cô Lan · Giáo viên Tin học. Dữ liệu 8 lớp là dữ liệu mẫu để kiểm tra luồng chuyển lớp.')}
      </div></main>`;
    }else{
      const content=role==='S'?studentPage():(role==='T'&&page==='dashboard'?dashboardPage():(role==='T'&&!STANDALONE_PAGES.includes(page)?folderWorkspace():({calendar:calendarPage,history:revisionPage,report:progressReportPage,data:dataExchangePage,overview,classes:()=>classPage2(),students,lessons:lessonsPage,assignments:assignmentsPage,grading:gradingPage,questions:questionsPage,mastery:assessPage,gaps:assessPage,recommend:assessPage})[page]()));
      shell(content);
      iconifyButtons();
      document.title=title()+' · '+current+' | EducMind';
      const act=document.querySelector('.nav[aria-current="page"]');
      if(act&&act.scrollIntoView)act.scrollIntoView({inline:'center',block:'nearest'});
    }
    if(focusId){const el=document.getElementById(focusId);if(el)el.focus({preventScroll:true});focusId=null}
    if(flashId){const f=document.getElementById(flashId);if(f){f.classList.add('flash');f.scrollIntoView({block:'center'});setTimeout(()=>f.classList.remove('flash'),3500)}flashId=null}
    try{requestAnimationFrame(placeSideToggle)}catch(_e){}
  }catch(e){
    console.error('Render error:',e);
    app.innerHTML=`<main class="login-wrap"><div class="login" style="padding:2rem;color:#dc2626"><h2>Lỗi hiển thị</h2><p>${String(e.message||e)}</p><button class="btn" onclick="location.reload()">Tải lại trang</button></div></main>`;
  }
}
