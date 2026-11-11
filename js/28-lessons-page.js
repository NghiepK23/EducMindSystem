/* EducMind · js/28-lessons-page.js
   Trang Bài học và mục tiêu của giáo viên: chủ đề → bài học → mục tiêu. */
/* --- Trang Bài học và mục tiêu: bố cục master–detail, hai tab --- */
/* --- Menu “…” gom thao tác khi khối chật: đóng khi bấm chọn hoặc bấm ra ngoài --- */
function mclose(el){const d=el&&el.closest?el.closest('details.dotmenu'):null;if(d)d.removeAttribute('open')}
document.addEventListener('click',e=>{const t=e.target;if(!t.closest||!t.closest('.dotmenu'))document.querySelectorAll('details.dotmenu[open]').forEach(d=>d.removeAttribute('open'))});
/* --- Trang Bài học và mục tiêu: khối chủ đề → bài học → mục tiêu --- */
function lessonsPage(){
  const c=selected();
  const head=`<section class='panel' style='padding:18px 22px'><div class='row between' style='flex-wrap:wrap;gap:10px'><div><h2 style='margin:0'>Khóa học Tin học · ${esc(c.id)}</h2><div class='muted' style='margin-top:4px'>${c.topics.length} chủ đề · ${c.lessonsData.length} bài học · ${c.goals.length} mục tiêu học tập${c.topicDel?' · chủ đề đang bị xóa mềm':''}</div></div><button class='btn' onclick='newTopic()'>${ic('plus',16)}Tạo chủ đề</button></div></section>`;
  const objs=(l,li)=>l.objs.length?`<div class='tablewrap'><table><thead><tr><th scope='col'>Mã</th><th scope='col'>Mục tiêu học tập</th><th scope='col'>Bằng chứng</th><th scope='col'>Nắm vững TB lớp</th><th scope='col'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${l.objs.map((o,oi)=>{const v=c.students.map(s=>s.mastery[o.idx]).filter(x=>x!=null);return `<tr><td><span class='codebadge'>${esc(o.code)}</span></td><td style='min-width:200px'>${esc(o.desc)}</td><td>${evCount(c,o.idx)}</td><td>${v.length?pct(mean(v))+'%':'<span class="muted">Chưa có dữ liệu</span>'}</td><td><span class='row' style='flex-wrap:nowrap'><button class='btn light mini' onclick='editObj(${li},${oi})' aria-label='Sửa mục tiêu ${esc(o.code)}'>Sửa</button><button class='btn light mini' onclick='delObj(${li},${oi})' aria-label='Xóa mục tiêu ${esc(o.code)}'>Xóa</button></span></td></tr>`}).join('')}</tbody></table></div>`:`<div class='muted' style='padding:2px 0'>Chưa có mục tiêu nào ở bài học này.</div>`;
  const res=(l,li)=>l.res.length?l.res.map((r,ri)=>`<div class='row between' style='padding:5px 0'><span style='min-width:0'><b style='font-size:.8125rem'>${esc(r.name)}</b> <span class='muted'>· ${fsize(r.size)}</span></span><span class='row' style='flex-wrap:nowrap'><button class='btn light mini' onclick='pickFile(${li},${ri})'>Thay</button><button class='btn light mini' onclick='delRes(${li},${ri})'>Xóa</button></span></div>`).join(''):`<div class='muted' style='font-size:.8125rem'>Chưa có tài liệu nào.</div>`;
  const lesson=(l,li)=>`<details class='lesblk' ${l.status==='Nháp'?'':'open'} style='border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:10px 0;background:var(--fill)'>
<summary class='row between' style='cursor:pointer'><span class='row' style='gap:8px;min-width:0'><span class='dot ${l.status==='Nháp'?'draft':''}' aria-hidden='true'></span><b>${esc(l.name)}</b><span class='pill ${l.status==='Nháp'?'plain':'good'}'>${l.status}</span><span class='muted'>${l.objs.length} mục tiêu · ${l.res.length} tài liệu</span></span></summary>
<details class='dotmenu'><summary class='btn light mini' aria-label='Thao tác cho bài học ${esc(l.name)}' aria-haspopup='true'>${ic('more',16)}</summary><div class='dotmenu-pop' role='menu'><button class='mitem' role='menuitem' onclick='mclose(this);addObj(${li})'>Thêm mục tiêu</button><button class='mitem' role='menuitem' onclick='mclose(this);pickFile(${li},-1)'>Đính kèm tài liệu</button><button class='mitem' role='menuitem' onclick='mclose(this);togglePub(${li})'>${l.status==='Nháp'?'Xuất bản':'Hủy xuất bản'}</button><button class='mitem' role='menuitem' onclick='mclose(this);editLesson(${li})'>Sửa bài học</button><button class='mitem' role='menuitem' onclick='mclose(this);delLesson(${li})'>Xóa bài học</button></div></details>
<div class='muted' style='margin:6px 0'>${esc(l.desc||'Chưa có mô tả')}${l.upd?' · sửa gần nhất '+esc(l.upd):''}</div>
<div class='row lesacts' style='margin:0 0 10px'><button class='btn light mini' onclick='addObj(${li})'>${ic('plus',13)}Thêm mục tiêu</button><button class='btn light mini' onclick='pickFile(${li},-1)'>Đính kèm tài liệu</button><button class='btn light mini' onclick='togglePub(${li})'>${l.status==='Nháp'?'Xuất bản':'Hủy xuất bản'}</button><button class='btn light mini' onclick='editLesson(${li})'>Sửa bài học</button><button class='btn light mini' onclick='delLesson(${li})'>Xóa bài học</button></div>
${objs(l,li)}
<div style='margin-top:10px'><div class='muted' style='font:600 .71875rem/1.2 var(--font-head);letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px'>Tài liệu của bài học</div>${res(l,li)}</div>
</details>`;
  const topic=(t,ti)=>{
    const Ls=c.lessonsData.map((l,li)=>({l,li})).filter(x=>x.l.tid===t.id);
    return `<section class='panel' style='padding:16px 20px' aria-labelledby='tp-${ti}'><div class='row between' style='flex-wrap:wrap;gap:8px'><div style='min-width:0'><div class='muted' style='font:600 .71875rem/1.2 var(--font-head);letter-spacing:.04em;text-transform:uppercase'>Chủ đề ${ti+1}</div><h2 id='tp-${ti}' style='margin:3px 0 0'>${esc(t.title)}</h2><div class='muted' style='margin-top:3px'>${Ls.length} bài học · ${Ls.reduce((n,x)=>n+x.l.objs.length,0)} mục tiêu</div></div><span class='pill ${t.status==='Nháp'?'plain':'good'}'>${t.status}</span></div>
<div class='row' style='margin:10px 0 2px'><button class='btn light mini' onclick='newLesson(${ti})'>${ic('plus',13)}Thêm bài học</button><button class='btn light mini' onclick='editTopic(${ti})'>Sửa chủ đề</button><button class='btn light mini' onclick='togTopic(${ti})'>${t.status==='Nháp'?'Xuất bản':'Về nháp'}</button><button class='btn light mini' onclick='moveTopic(${ti},-1)'>Lên</button><button class='btn light mini' onclick='moveTopic(${ti},1)'>Xuống</button><button class='btn light mini' onclick='delTopic(${ti})'>Xóa chủ đề</button></div>
${Ls.length?Ls.map(x=>lesson(x.l,x.li)).join(''):`<div class='empty'>Chủ đề chưa có bài học nào. Thêm bài học để bắt đầu xây dựng mục tiêu.</div>`}</section>`;
  };
  const docs=`<section class='panel' aria-labelledby='h-cd'><div class='row between'><h2 id='h-cd'>Tài liệu chung của lớp (${c.cres.length})</h2><button class='btn light' onclick='pickCourseFile(-1)'>${ic('plus',16)}Đính kèm tài liệu chung</button></div>${c.cres.length?c.cres.map((r,ri)=>`<div class='item'><div style='min-width:0'><b>${esc(r.name)}</b><div class='muted'>${fsize(r.size)}</div></div><span class='row' style='flex-wrap:nowrap'><button class='btn light' onclick='pickCourseFile(${ri})'>Thay tệp</button><button class='btn light' onclick='delCourseFile(${ri})'>Xóa</button></span></div>`).join(''):`<div class='empty'>Chưa có tài liệu chung của lớp.</div>`}</section>`;
  return head+c.topics.map((t,ti)=>topic(t,ti)).join('')+docs+trashPanel(c,['Bài học','Tài liệu','Chủ đề','Mục tiêu']);
}
function newTopic(){
  const c=selected();
  openDlg({title:'Tạo chủ đề',text:'Chủ đề mới ở trạng thái nháp; học sinh chưa thấy cho đến khi xuất bản.',okLabel:'Tạo chủ đề',fields:[{k:'t',label:'Tiêu đề',val:''},{k:'d',label:'Mô tả (không bắt buộc)',val:'',area:true}],ok:v=>{
    if(!v.t.trim())return 'Chủ đề không có tiêu đề thì không lưu được.';
    c.topics.push({id:'T'+(TID++),title:v.t.trim(),desc:v.d.trim(),status:'Nháp'});syncTopic(c);toast('Đã tạo chủ đề (nháp)');return null}});
}
function editTopic(ti){
  const c=selected(),t=c.topics[ti];
  openDlg({title:'Sửa chủ đề',fields:[{k:'t',label:'Tiêu đề',val:t.title},{k:'d',label:'Mô tả',val:t.desc||'',area:true}],ok:v=>{
    if(!v.t.trim())return 'Chủ đề không có tiêu đề thì không lưu được.';t.title=v.t.trim();t.desc=v.d.trim();syncTopic(c);toast('Đã lưu chủ đề');return null}});
}
function togTopic(ti){const c=selected(),t=c.topics[ti];t.status=t.status==='Nháp'?'Đã xuất bản':'Nháp';toast(t.status==='Nháp'?'Đã hủy xuất bản; học sinh không còn thấy chủ đề và các bài học bên trong.':'Đã xuất bản chủ đề');render()}
function moveTopic(ti,d){const c=selected(),j=ti+d;if(j<0||j>=c.topics.length)return;const t=c.topics[ti];c.topics[ti]=c.topics[j];c.topics[j]=t;syncTopic(c);focusId='pageTitle';render()}
function delTopic(ti){
  const c=selected(),t=c.topics[ti],Ls=c.lessonsData.filter(l=>l.tid===t.id),n=Ls.reduce((s,l)=>s+l.objs.reduce((m,o)=>m+evCount(c,o.idx),0),0);
  openDlg({title:'Xóa chủ đề “'+esc(t.title)+'”?',text:'Chủ đề còn '+Ls.length+' bài học'+(n?' và '+n+' bằng chứng học tập':'')+'. Học sinh không còn thấy chủ đề và các bài học bên trong; bằng chứng, mức nắm vững vẫn được giữ, gợi ý liên quan hết hiệu lực.',danger:true,okLabel:'Xóa chủ đề',ok:()=>{
    Ls.forEach(l=>{trashLesson(c,l);c.lessonsData.splice(c.lessonsData.indexOf(l),1)});
    c.trash.unshift({type:'Chủ đề',name:t.title,note:'Chủ đề và các bài học bên trong không còn hiển thị cho học sinh',objIdx:[],at:stamp()});
    c.topics.splice(ti,1);syncTopic(c);LOG.unshift('Xóa chủ đề “'+t.title+'” ('+c.id+'): gợi ý liên quan chuyển sang hết hiệu lực');toast('Đã xóa mềm chủ đề');return null}});
}
function newLesson(ti){
  const c=selected(),t=c.topics[ti];
  openDlg({title:'Tạo bài học trong “'+esc(t.title)+'”',text:'Bài học mới ở trạng thái nháp và thuộc đúng chủ đề này. Bài học chưa có mục tiêu thì không xuất bản được.',okLabel:'Tạo bài học',fields:[{k:'n',label:'Tiêu đề',val:''},{k:'d',label:'Mô tả',val:'',area:true},{k:'g',label:'Mục tiêu học tập (mỗi dòng: MÃ | mô tả, ví dụ LO10 | Nhận biết địa chỉ IP)',val:'',area:true}],ok:v=>{
    if(!v.n.trim())return 'Bài học phải có tiêu đề.';
    const seen=new Set(),list=[];
    const lines=v.g.split(NL).map(x=>x.trim()).filter(Boolean);
    for(let k=0;k<lines.length;k++){
      const ln=lines[k],p=ln.indexOf('|'),code=(p<0?ln:ln.slice(0,p)).trim().toUpperCase(),d=p<0?'':ln.slice(p+1).trim();
      if(!code||!d)return 'Dòng '+(k+1)+': nhập theo dạng MÃ | mô tả.';
      if(seen.has(code))return 'Mã '+esc(code)+' bị trùng trong cùng bài học.';
      seen.add(code);list.push([code,d]);
    }
    const l={name:v.n.trim(),desc:v.d.trim(),status:'Nháp',goals:[],res:[],objs:[],tid:t.id,upd:stamp()};
    list.forEach(x=>l.objs.push({code:x[0],desc:x[1],idx:addGoal(c,x[1])}));
    c.lessonsData.push(l);toast('Đã tạo bài học (nháp) với '+l.objs.length+' mục tiêu');return null}});
}
function addObj(li){
  const c=selected(),l=c.lessonsData[li];
  openDlg({title:'Thêm mục tiêu cho “'+esc(l.name)+'”',okLabel:'Thêm mục tiêu',fields:[{k:'c',label:'Mã mục tiêu',val:''},{k:'d',label:'Mô tả',val:'',area:true}],ok:v=>{
    const code=v.c.trim().toUpperCase();
    if(!code||!v.d.trim())return 'Mã và mô tả không được để trống.';
    if((l.objs||[]).some(o=>String(o.code||'').toUpperCase()===code))return 'Bài học này đã có mã '+esc(code)+': mỗi mã dùng một lần trong bài học.';
    const jj=addGoal(c,v.d.trim());reviveGoal(c,jj);l.objs.push({code,desc:v.d.trim(),idx:jj});l.upd=stamp();toast('Đã thêm mục tiêu; chưa có bằng chứng nên hiển thị “Chưa có dữ liệu”.');return null}});
}
