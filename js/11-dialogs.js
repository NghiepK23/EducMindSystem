/* EducMind · js/11-dialogs.js
   Hộp thoại dùng chung (openDlg), ô chọn ngày, thùng rác và thông báo nhanh toast(). */
/* ===== Đợt 2: sửa/xóa mềm (US-T11, US-T12) và tài liệu bài học ===== */
const ALLOWED=['pdf','doc','docx','ppt','pptx','xls','xlsx','txt','png','jpg','jpeg','gif','webp','zip','mp4','mov','webm','m4v','avi','cpp','c','h','hpp','js','html','htm','css','json','xml','csv','md','py','java','php','rb','go','rs','swift','kt','ts','tsx','jsx','sh','bat','sql','log','ini','yaml','yml','toml','gitignore','dockerfile','env','gitattributes','makefile'];
let dlg=null;
const DELCLS=[];
const stamp=()=>(acctName()||'Giáo viên')+' · '+new Date().toLocaleString('vi-VN');
const fsize=b=>b>=1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const esc=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const evCount=(c,j)=>c.students.reduce((n,s)=>n+s.ev[j].length,0);
const delGoal=(c,j)=>c.trash.some(t=>t.objIdx.includes(j));
const gl=(c,j)=>{const t=c.trash.find(x=>(x.objIdx||[]).includes(j));return c.goals[j]+(t?' · '+(t.type==='Mục tiêu'?'Mục tiêu đã xóa':'Bài học đã xóa'):'')};
classes.forEach(c=>{
  c.trash=[];c.quiz.dur=15;const L=c.lessonsData;
  L.forEach((l,li)=>{l.desc='Bài '+(li+1)+' thuộc chủ đề '+c.topic;l.res=[];l.objs=[]});
  c.goals.forEach((g,j)=>L[j<2?0:1].objs.push({code:'LO0'+(j+1),desc:g,idx:j}));
  L[0].res.push({name:'Bài giảng '+L[0].name+'.pptx',size:3.2*1048576});
  c.assignments.forEach((a,ai)=>{a.desc='Làm bài theo yêu cầu: '+a.name;a.allowLate=ai===0});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dlg&&!dlg.force)closeDlg()});
function openDlg(d){if(d&&['Thông báo','Tài khoản của bạn'].includes(d.title))sidebarCollapsed=true;dlg=d;focusId=d.fields&&d.fields.length?'dlg-0':'dlg-ok';render()}
function closeDlg(){if(typeof datePopClose==='function')datePopClose();dlg=null;render()}
/* Ngày: giữ nguyên cách gõ tay dd/mm/yyyy, thêm nút lịch để chọn nhanh bằng cách bấm */
function dateToIso(v){const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v==null?'':v).trim());if(!m)return '';const d=('0'+m[1]).slice(-2),mo=('0'+m[2]).slice(-2);return m[3]+'-'+mo+'-'+d}
function isoToDate(iso){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso==null?'':iso));return m?m[3]+'/'+m[2]+'/'+m[1]:''}
let datePop=null;
/* Mở lịch chọn ngày ngay trong trang: luôn nằm trong khung nhìn, không bị cắt mép */
function dateOpen(txtId){
  const txt=document.getElementById(txtId);
  if(!txt)return;
  if(datePop&&datePop.inputId===txtId){datePopClose();return}
  datePopClose();
  const iso=dateToIso(txt.value),d=iso?new Date(iso+'T00:00:00'):new Date();
  const el=document.createElement('div');
  el.className='datepop';el.setAttribute('role','dialog');el.setAttribute('aria-label','Chọn ngày');
  document.body.appendChild(el);
  datePop={inputId:txtId,el,y:d.getFullYear(),m:d.getMonth()};
  datePopPaint();datePopPlace();
  setTimeout(()=>{
    document.addEventListener('mousedown',datePopOutside,true);
    document.addEventListener('keydown',datePopKey,true);
    window.addEventListener('scroll',datePopPlace,true);
    window.addEventListener('resize',datePopPlace);
  },0);
  const f=el.querySelector('.dp-day[aria-selected="true"]')||el.querySelector('.dp-day:not(.dp-out)');
  if(f)try{f.focus({preventScroll:true})}catch(e){f.focus()}
}
function datePopClose(){
  if(!datePop)return;
  if(datePop.el&&datePop.el.parentNode)datePop.el.parentNode.removeChild(datePop.el);
  document.removeEventListener('mousedown',datePopOutside,true);
  document.removeEventListener('keydown',datePopKey,true);
  window.removeEventListener('scroll',datePopPlace,true);
  window.removeEventListener('resize',datePopPlace);
  datePop=null;
}
function datePopOutside(e){
  if(!datePop||!datePop.el)return;
  if(datePop.el.contains(e.target))return;
  if(e.target.closest&&e.target.closest('.date-btn'))return;
  datePopClose();
}
function datePopKey(e){
  if(!datePop)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();datePopClose();return}
  const step=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:e.key==='ArrowUp'?-7:e.key==='ArrowDown'?7:0;
  if(!step)return;
  const days=[...datePop.el.querySelectorAll('.dp-day')];
  const i=days.indexOf(document.activeElement);
  if(i<0)return;
  e.preventDefault();
  const n=days[Math.min(days.length-1,Math.max(0,i+step))];
  if(n)n.focus({preventScroll:true});
}
function datePopPad(n){return n<10?'0'+n:''+n}
function datePopPaint(){
  if(!datePop)return;
  const y=datePop.y,m=datePop.m;
  const txt=document.getElementById(datePop.inputId),sel=txt?dateToIso(txt.value):'';
  const now=new Date(),tIso=now.getFullYear()+'-'+datePopPad(now.getMonth()+1)+'-'+datePopPad(now.getDate());
  const first=new Date(y,m,1),lead=(first.getDay()+6)%7;         /* tuần bắt đầu từ thứ hai */
  const total=Math.ceil((lead+new Date(y,m+1,0).getDate())/7)*7;
  const dow=['T2','T3','T4','T5','T6','T7','CN'];
  let cells='';
  for(let k=0;k<total;k++){
    const dayNo=k-lead+1;
    const cur=new Date(y,m,dayNo);
    const iso=cur.getFullYear()+'-'+datePopPad(cur.getMonth()+1)+'-'+datePopPad(cur.getDate());
    const out=cur.getMonth()!==m;
    cells+=`<button type='button' class='dp-day${out?' dp-out':''}${iso===sel?'':' '}${iso===tIso?' dp-today':''}' data-iso='${iso}' aria-selected='${iso===sel?'true':'false'}' onclick="datePick('${iso}')">${cur.getDate()}</button>`;
  }
  datePop.el.innerHTML=`<div class='dp-head'><b class='dp-title'>Tháng ${m+1} năm ${y}</b><span class='dp-nav'>`+
    `<button type='button' aria-label='Tháng trước' title='Tháng trước' onclick='dateNav(-1)'><span aria-hidden='true' style='font-size:18px;line-height:1'>‹</span></button>`+
    `<button type='button' aria-label='Tháng sau' title='Tháng sau' onclick='dateNav(1)'><span aria-hidden='true' style='font-size:18px;line-height:1'>›</span></button></span></div>`+
    `<div class='dp-grid'>${dow.map(d=>`<span class='dp-dow'>${d}</span>`).join('')}${cells}</div>`+
    `<div class='dp-foot'><button type='button' class='btn light' onclick="datePick('${tIso}')">Hôm nay</button>`+
    `<button type='button' class='btn light' onclick='datePopClose()'>Đóng</button></div>`;
  datePopPlace();
}
function dateNav(d){
  if(!datePop)return;
  const m=datePop.m+d,y=datePop.y+(m<0?-1:m>11?1:0);
  datePop.m=(m+12)%12;datePop.y=y;datePopPaint();
}
function datePick(iso){
  if(!datePop)return;
  const id=datePop.inputId;
  datePopClose();
  dateSet(id,iso);
}
/* Canh hộp lịch: ưu tiên dưới ô nhập, tự lật lên trên và nép vào trong khi sát mép */
function datePopPlace(){
  if(!datePop||!datePop.el)return;
  const txt=document.getElementById(datePop.inputId);
  if(!txt||!document.body.contains(txt)){datePopClose();return}
  const r=txt.getBoundingClientRect(),el=datePop.el;
  const w=el.offsetWidth||272,h=el.offsetHeight||300,pad=8;
  const box=(txt.closest('.datebox')||txt).getBoundingClientRect();
  let left=Math.min(Math.max(pad,box.right-w),Math.max(pad,window.innerWidth-w-pad));
  let top=box.bottom+6;
  if(top+h>window.innerHeight-pad)top=Math.max(pad,box.top-h-6);
  el.style.left=Math.round(left)+'px';el.style.top=Math.round(top)+'px';
}
function dateSet(txtId,iso){
  const txt=document.getElementById(txtId);
  const v=isoToDate(iso);
  if(!txt||!v)return;
  txt.value=v;
  txt.dispatchEvent(new Event('input',{bubbles:true}));
  txt.dispatchEvent(new Event('change',{bubbles:true}));
}
function submitDlg(){const v={};(dlg.fields||[]).forEach((f,i)=>{const el=document.getElementById('dlg-'+i);if(f.chk){v[f.k]=[...el.querySelectorAll('input:checked')].map(x=>f.chk[+x.value]);f.val=v[f.k];return}v[f.k]=el.value;if(el.files&&el.files[0])v[f.k+'_f']=el.files[0];if(!f.file)f.val=v[f.k]});const e=dlg.ok(v);if(e){dlg.err=e;focusId='dlg-0';render();return}dlg=null;render()}
function dlgHtml(){
  if(!dlg)return'';
  const _e=dlg._seen?'':' enter';
  const _shift=!sidebarCollapsed&&['Thông báo','Tài khoản của bạn'].includes(dlg.title)?' dlg-shift-right':'';
  dlg._seen=true;return `<div class="ov${_e}${_shift}"><form class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t" onsubmit="submitDlg();return false"><h2 id="dlg-t" style="font-size:18px;margin-bottom:8px">${dlg.title}</h2>${dlg.text?`<p class="muted" style="margin:0 0 12px">${dlg.text}</p>`:''}${(dlg.fields||[]).map((f,i)=>`<div class="field"><label for="dlg-${i}">${f.label}</label>${f.chk?`<div id='dlg-${i}'>${f.chk.length?f.chk.map((o,k)=>`<label style='display:block;padding:3px 0;font-weight:400'><input type='checkbox' value='${k}' ${(f.val||[]).includes(o)?'checked':''}> ${esc(o)}</label>`).join(''):`<span class='muted'>Chưa có mục tiêu nào.</span>`}</div>`:f.sel?`<select id='dlg-${i}'${f.onchange?' onchange="'+f.onchange+'"':''}>${f.sel.map(o=>`<option ${o===f.val?'selected':''}>${esc(o)}</option>`).join('')}</select>`:f.file?`<input type='file' id='dlg-${i}' ${f.accept?`accept='${f.accept}'`:''}>`:f.area?`<textarea id="dlg-${i}" rows="3">${esc(f.val)}</textarea>`:(/dd\/mm\/yyyy|ngày/i.test(f.label||'') && !f.sel && !f.file && !f.area
            ? `<span class='datebox'><input id="dlg-${i}" value="${esc(f.val)}" autocomplete='off'><button type='button' class='date-btn' data-iconified='1' aria-label='Chọn ngày từ lịch' title='Chọn ngày từ lịch' onclick="dateOpen('dlg-${i}')">${ic('calendar',16)}</button></span>`
            : (/thời lượng|phút/i.test(f.label||'')
              ? `<input id="dlg-${i}" value="${esc(f.val)}" list='dlg-dur' inputmode='numeric' autocomplete='off'>`
              : `<input id="dlg-${i}" ${f.pw?`type='password'`:''} value="${esc(f.val)}">`))}${f.hint?`<div class="muted" style="font-size:.78rem;margin-top:4px">${f.hint}</div>`:''}</div>`).join('')}<datalist id='dlg-dur'><option value='5'><option value='10'><option value='15'><option value='20'><option value='30'><option value='45'><option value='60'><option value='90'></datalist>${dlg.err?`<div class="notice" role="alert" style="background:var(--err-bg);color:var(--err-ink)">${ic('alert',16)}<div>${dlg.err}</div></div>`:''}<div class="row" style="justify-content:flex-end;margin-top:16px">${dlg.force?`<button type="button" class="btn light" data-noicon onclick="logout()">Đăng xuất</button>`:`<button type="button" class="btn light" data-noicon onclick="closeDlg()">Hủy</button>`}<button type="submit" id="dlg-ok" class="btn ${dlg.danger?'danger':''}" data-noicon>${dlg.okLabel||'Lưu thay đổi'}</button></div></form></div>`;
}
function trashPanel(c,types){
  const t=c.trash.filter(x=>types.includes(x.type));
  return t.length?`<section class="panel" aria-labelledby="h-tr"><h2 id="h-tr" style="font-size:15px">Đã xóa mềm</h2><p class="lead">Dữ liệu vẫn nằm trong cơ sở dữ liệu (deleted_at); điểm và bằng chứng học tập không bị xóa.</p>${t.map(x=>`<div class="item"><div><b>${esc(x.name)}</b> <span class="pill plain">${x.type}</span><div class="muted">${x.note} · ${x.at}</div></div></div>`).join('')}</section>`:'';
}
/* --- Thông báo nhanh (toast) --- */
let toastTimer;
function toast(t){
  const n=document.getElementById('toast');
  n.textContent=t;n.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('show'),2800);
}
