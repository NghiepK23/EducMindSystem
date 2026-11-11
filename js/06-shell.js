/* EducMind · js/06-shell.js
   Điều hướng (đăng nhập demo, đăng xuất, đổi trang, đổi lớp) và khung giao diện: thanh trên, thanh bên. */
/* ===== Điều hướng ===== */
function login(){logged=true;focusId='pageTitle';render()}
function logout(){const wasBackend=!!(sess&&sess.backend);logged=false;role='T';sess=null;dlg=null;taking=false;authMode='login';authErr='';authMsg='';focusId='loginBtn';stuLessonView=null;stuLessonTab='goals';folderTopicId=null;folderLessonName=null;folderModule='goals';if(wasBackend&&supabaseClient)supabaseClient.auth.signOut().catch(console.error);render()}
function setPage(p,keepFolder){if(p!=='assignments')redo=null;if(role==='S'&&p==='lessons')stuLessonView=null;if(role==='T'&&!keepFolder&&!STANDALONE_PAGES.includes(p)){folderTopicId=null;folderLessonName=null;folderModule=p==='overview'?'goals':p}if(role==='T'&&p==='dashboard'){folderTopicId=null;folderLessonName=null;folderModule='goals'}page=p;focusId='nav-'+(role==='T'&&!STANDALONE_PAGES.includes(p)?(p==='dashboard'?'dashboard':'overview'):p);render();window.scrollTo(0,0)}
function toggleSidebar(){sidebarCollapsed=!sidebarCollapsed;render()}
function setClass(id,fromSelect){if(!visClasses().some(x=>x.id===id)){toast('Bị từ chối: lớp '+id+' không thuộc quyền của bạn.');return}current=id;page='overview';folderTopicId=null;folderLessonName=null;folderModule='goals';focusId=fromSelect?'classSelect':'pageTitle';render();window.scrollTo(0,0)}

/* ===== Khung giao diện ===== */
function shell(content){
  const c=selected();
  const persistentToggle=app.querySelector('.side-toggle');
  const _vk=role+"|"+page+"|"+current,_ve=_vk!==window.__vk?" enter":"";window.__vk=_vk;
  app.innerHTML=`
  <header class="top">
    ${brandLogoHtml()}
    <span class="spacer"></span>
    <div class='user'>${avatarHtml()}<span>${esc(acctName())}${role==='S'?' · lớp '+esc(c.id):' · Giáo viên Tin học'}</span></div>${notifBtn()}${themeBtn()}<button class='btn light' onclick='openAccount()'>Tài khoản</button>
    <button class="btn light" onclick="logout()">${ic('logout',16)}Đăng xuất</button>
  </header>
  <div class="layout ${role==='T'?'teacher-layout':''} ${sidebarCollapsed?'sidebar-collapsed':''} ${dlg?'has-dialog':''}" style="--sidebar-width:${sidebarWidth}px">
    <nav class="side" aria-label="Điều hướng chính">
      ${role==='S'?NAVS.map(([g,items])=>`<div class="grp${g?'':' grp-bare'}">${g?`<h2>${g}</h2>`:''}<div class="items">${items.map(([k,v])=>`<button class="nav" id="nav-${k}" ${page===k?'aria-current="page"':''} aria-label="${v}" title="${v}" onclick="setPage('${k}')">${ic(k,17)}<span>${v}</span></button>`).join('')}</div></div>`).join(''):NAV.map(([g,items])=>`<div class="grp${g?'':' grp-bare'}">${g?`<h2>${g}</h2>`:''}<div class="items">${items.map(([k,v])=>`<button class="nav" id="nav-${k}" ${(page===k||(k==='overview'&&!STANDALONE_PAGES.includes(page)))?'aria-current="page"':''} aria-label="${v}" title="${v}" onclick="setPage('${k}')">${ic(navIcon[k]||k,18)}<span>${v}</span></button>`).join('')}</div></div>`).join('')}
    </nav>
    <button type="button" class="side-toggle" onclick="toggleSidebar()" aria-label="${sidebarCollapsed?'Mở rộng':'Thu gọn'} thanh điều hướng" title="${sidebarCollapsed?'Mở rộng':'Thu gọn'} thanh điều hướng" aria-expanded="${!sidebarCollapsed}"><span aria-hidden="true">${sidebarCollapsed?'»':'«'}</span></button>
    <main class="main" id="main">
      <div class="head">
        <div>
          <h1 id="pageTitle" tabindex="-1">${title()}</h1>
          ${page==='classes'?'<p class="sub">Một tài khoản giáo viên quản lý nhiều lớp, dữ liệu từng lớp được tách biệt.</p>':''}
        </div>
        ${role==='T'?`<div class="selectbox class-select">
          <label for="classSelect">Lớp đang chọn</label>
          <select id="classSelect" onchange="setClass(this.value,true)">${visClasses().map(x=>`<option value="${x.id}" ${x.id===current?'selected':''}>${x.id}</option>`).join('')}</select>
        </div>`:''}
      </div>
      <div class="view${_ve}">${content}</div>${dlgHtml()}
    </main>
  </div>`;
  const freshToggle=app.querySelector('.side-toggle');
  if(persistentToggle&&freshToggle){
    const expanded=!sidebarCollapsed;
    if(persistentToggle.getAttribute('aria-expanded')!==String(expanded)){
      const label=(expanded?'Thu gọn':'Mở rộng')+' thanh điều hướng';
      persistentToggle.setAttribute('aria-label',label);
      persistentToggle.title=label;
      persistentToggle.setAttribute('aria-expanded',String(expanded));
      const glyph=persistentToggle.querySelector('span[aria-hidden="true"]');
      if(glyph)glyph.textContent=sidebarCollapsed?'»':'«';
    }
    freshToggle.replaceWith(persistentToggle);
  }
  applyLayer4Background();
}
function metric(icon,label,value,hint,isText){
  return `<div class="card metric"><span class="mi">${ic(icon,20)}</span><div><div class="label">${label}</div><strong class="${isText?'text':''}">${value}</strong><div class="hint">${hint}</div></div></div>`;
}
const note=t=>`<div class="notice">${ic('info',16)}<div>${t}</div></div>`;
