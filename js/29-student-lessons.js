/* EducMind · js/29-student-lessons.js
   Trang Bài học của học sinh: danh sách theo chủ đề, không gian bài học, xem và tải tài liệu. */
function studentResourceKind(r){
  const ext=String(r.name||'').split('.').pop().toLowerCase();
  if(['mp4','mov','webm','m4v','avi'].includes(ext))return 'Video';
  if(['ppt','pptx','key'].includes(ext))return 'Slide';
  if(['png','jpg','jpeg','gif','webp'].includes(ext))return 'Hình ảnh';
  return 'Tài liệu';
}
function studentResourcePreview(r){
  if(studentResourceKind(r)!=='Video'||!r.blob)return '';
  if(!r.studentVideoUrl)r.studentVideoUrl=URL.createObjectURL(r.blob);
  return `<video class='student-resource-video' controls playsinline preload='metadata' src='${r.studentVideoUrl}' aria-label='Video học tập: ${esc(r.name)}'></video>`;
}
function lessonStu(c,l,li){
  const nObj=(l.objs||[]).length;
  return `<div class='student-lesson' id='ls-${li}'>
    <button type='button' class='student-lesson-head' data-lesson='${li}' onclick="stuOpenLesson(${li})" aria-label="Mở bài ${esc(l.name)}"><span class='student-lesson-name'>${esc(l.name)}</span>${nObj?`<span class='muted' style='flex:none;font-size:12px'>${nObj} mục tiêu</span>`:''}${ic('arrow',17)}</button>
  </div>`;
}
/* Bấm một bài học -> mở trang bài học riêng (chỉ còn 2 tab Mục tiêu / Tài liệu học tập) */
let stuLessonView=null,stuLessonTab='goals';
function stuOpenLesson(li){
  stuLessonView={cid:current,li};stuLessonTab='goals';
  if(page!=='lessons')page='lessons';
  render();window.scrollTo(0,0);
}
function stuLessonBack(){
  const c=selected(),v=stuLessonView,l=v?c.lessonsData[v.li]:null,t=l?topicOf(c,l):null;
  stuLessonView=null;
  if(t&&t.id)stuTopicState[t.id]=true;
  render();
  const el=t?document.getElementById('stopic-'+esc(t.id)):null;
  if(el&&el.scrollIntoView)el.scrollIntoView({block:'center'});
  else window.scrollTo(0,0);
}
function stuLessonTabSet(k){
  stuLessonTab=k;
  /* Chỉ vẽ lại vùng nội dung của tab, giữ nguyên khung bài học (không nhấp nháy) */
  const c=selected(),v=stuLessonView,l=v?c.lessonsData[v.li]:null,body=document.querySelector('.lesson-workspace-body');
  if(l&&body){
    body.innerHTML=stuLessonBody(c,l);
    const tabs=[...document.querySelectorAll('.lesson-workspace-head .folder-tabs button')],
      i=STU_LESSON_TABS.findIndex(x=>x[0]===k);
    tabs.forEach(b=>{b.removeAttribute('aria-current');b.setAttribute('aria-selected','false')});
    if(tabs[i]){tabs[i].setAttribute('aria-selected','true');tabs[i].setAttribute('aria-current','page')}
    if(typeof iconifyButtons==='function')iconifyButtons();
    return;
  }
  render();
}
const STU_LESSON_TABS=[['goals','Mục tiêu','target'],['res','Tài liệu','lessons']];
function stuLessonBody(c,l){
  const s=me(),nObj=(l.objs||[]).length;
  const goals=`<div class='panel' style='margin:12px 0 0'><h2 style='font-size:15px'>Mục tiêu học tập</h2>${nObj?`<ul style='margin:8px 0 0;padding-left:20px'>${l.objs.map(o=>`<li id='stu-goal-${o.idx}'>${esc(o.code)} · ${esc(o.desc)}</li>`).join('')}</ul>`:`<div class='muted'>Chưa có mục tiêu được công bố.</div>`}</div>${s&&PR(c).on?pStuCheck(c,s,l):''}`;
  let resHtml='';
  if(l.res&&l.res.length){
      const items=l.res.map((r,i)=>{
      const ext=String(r.name||'').split('.').pop().toLowerCase();
      const fIcon=fileIcon(ext);
      const rid=resId(r);
      const isLink=r.type==='link';
      const clickable = isLink 
        ? `onclick="event.stopPropagation();window.open('${r.url}','_blank')"` 
        : `onclick="event.stopPropagation();previewRes('${rid}')"`;
      return `<div class='item' style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)'>
        <span class='ic' style='width:24px;height:24px;flex:none'>${ic(fIcon,18)}</span>
        <div style='min-width:0' ${clickable} title='${isLink?'Mở liên kết':'Bấm để xem trước / tải về'}'>
          <div style='font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>${esc(r.name)}</div>
          <div class='muted' style='font-size:.8125rem'>${isLink?'Liên kết':r.type||'Tài liệu'}${isLink?'':(' · '+r.size||'–')}</div>
        </div>
        <span class='spacer'></span>
        ${isLink?`<button type='button' class='btn light mini' data-iconified='1' onclick="event.stopPropagation();window.open('${r.url}','_blank')" aria-label='Mở ${esc(r.name)}'>${ic('external',16)}<span class='sr'>Mở liên kết</span></button>`:`<button type='button' class='btn light mini' data-iconified='1' onclick='dlRes("${rid}")' aria-label='Tải ${esc(r.name)}' title='Tải tài liệu'>${ic('download',16)}<span class='sr'>Tải về</span></button>`}<button type='button' class='btn light mini danger-soft' data-iconified='1' onclick='stuDelRes(${i})' aria-label='Xoá ${esc(r.name)}' title='Xoá tài liệu'>${ic('trash',16)}</button>
      </div>`;
    }).join('');
    resHtml=`<div class='panel' style='margin:12px 0 0'><h2 style='font-size:15px'>Tài liệu học tập</h2><div id='resPreviewBox' style='margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--fill)'></div><div class='student-resources' style='margin-top:8px'>${items}</div></div>`;
  } else {
    resHtml=`<div class='panel' style='margin:12px 0 0'><h2 style='font-size:15px'>Tài liệu học tập</h2><div class='muted'>Chưa có tài liệu được đính kèm.</div></div>`;
  }
  const res=resHtml;
  return stuLessonTab==='res'?res:goals;
}




function stuLessonWorkspace(c,l){
  const t=topicOf(c,l),nObj=(l.objs||[]).length;
  const tabs=STU_LESSON_TABS.map(([k,label,icon])=>`<button type='button' role='tab' aria-selected='${stuLessonTab===k}' ${stuLessonTab===k?"aria-current='page'":''} onclick="stuLessonTabSet('${k}')">${ic(icon,16)}<span>${label}</span></button>`).join('');
  return `<div class='folder-wrap'>
    <nav class='folder-crumb' aria-label='Vị trí thư mục'><button onclick='stuLessonBack()'>Bài học</button><span>›</span><button onclick='stuLessonBack()'>${esc(t.title)}</button><span>›</span><b>${esc(l.name)}</b></nav>
    <section class='panel lesson-workspace'>
      <div class='lesson-workspace-head'>
        <div class='row between' style='flex-wrap:wrap'><div><h2>${esc(l.name)}</h2><p class='lead' style='margin:4px 0 0'>${esc(t.title)} · ${nObj?nObj+' mục tiêu học tập':'chưa có mục tiêu'}</p></div></div>
        <div class='folder-tabs split-2' role='tablist' aria-label='Nội dung bài học'>${tabs}</div>
      </div>
      <div class='lesson-workspace-body'>${stuLessonBody(c,l)}</div>
    </section>
  </div>`;
}
/* Trạng thái mở/thu gọn chủ đề ở góc nhìn học sinh (mặc định mở) */
const stuTopicState={};
const stuTopicOpen=id=>stuTopicState[id]!==false;
function stuTopicToggle(id){
  const open=!stuTopicOpen(id);stuTopicState[id]=open;
  const head=document.querySelector(".student-topic-head[data-topic='"+id+"']"),panel=document.getElementById('stless-'+id);
  if(!head||!panel){render();return}
  head.setAttribute('aria-expanded',open?'true':'false');
  panel.hidden=!open;
}
function sLessons(){
  const c=selected();
  if(stuLessonView&&stuLessonView.cid===c.id){
    const lv=c.lessonsData[stuLessonView.li];
    if(lv&&lv.status==='Đã xuất bản'&&!c.topicDel)return stuLessonWorkspace(c,lv);
    stuLessonView=null;
  }
  const topics=c.topics.filter(t=>t.status==='Đã xuất bản');
  const body=topics.map((t,ti)=>{
    const L=c.lessonsData.filter(l=>l.tid===t.id&&l.status==='Đã xuất bản');
    if(!L.length)return '';
    const open=stuTopicOpen(t.id);
    return `<section class='panel student-topic-block' id='stopic-${esc(t.id)}'>
      <button type='button' class='student-topic-head' data-topic='${esc(t.id)}' aria-expanded='${open?'true':'false'}' aria-controls='stless-${esc(t.id)}' onclick="stuTopicToggle('${esc(t.id)}')">
        <span class='student-topic-mark' aria-hidden='true'>${String(ti+1).padStart(2,'0')}</span>
        <span class='student-topic-title' role='heading' aria-level='2'>${esc(t.title)}</span>
        <span class='pill plain'>${L.length} bài học</span>
      </button><div class='student-topic-lessons' id='stless-${esc(t.id)}' ${open?'':'hidden'}>${t.desc?`<p class='lead'>${esc(t.desc)}</p>`:''}${L.map(l=>lessonStu(c,l,c.lessonsData.indexOf(l))).join('')}</div></section>`;
  }).join('');
  const docs=c.cres.length?`<section class='panel' id='cdocs' tabindex='-1'><h2 style='font-size:15px'>Tài liệu chung của lớp</h2>${c.cres.map(r=>`<div class='row between' style='padding:4px 0'><span>${esc(r.name)} <span class='muted'>· ${fsize(r.size)}</span></span><button class='btn light' onclick='dlRes("${resId(r)}")'>Tải về</button></div>`).join('')}</section>`:'';
  return (body||`<section class='panel'><h2>Bài học</h2><div class='empty'>Chưa có bài học nào được xuất bản.</div></section>`)+docs;
}

/* --- AC-S01.3: tải tài liệu thật (tệp giáo viên đính kèm trong phiên này; tệp mẫu sinh tệp .txt giải thích) --- */
const RESREG={};
let RID=0;
function resId(r){if(!r.rid){r.rid='R'+(++RID);RESREG[r.rid]=r}return r.rid}
function dlRes(id){
  const r=RESREG[id];if(!r)return;
  const real=!!r.blob,blob=real?r.blob:new Blob(['Tệp mẫu của prototype: '+r.name+'\nNội dung thật chỉ có khi giáo viên đính kèm tệp từ máy tính.'],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=real?r.name:r.name+'.txt';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(real?'Đã tải về: '+r.name:'Đã tải tệp mẫu (tệp này chưa có nội dung thật): '+r.name+'.txt');
}
