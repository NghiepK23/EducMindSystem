/* EducMind · js/69-folder-workspace.js
   Thư mục học tập: tiêu đề, đường dẫn, chọn chủ đề / bài học, khung làm việc. */
function folderTitle(){
  const c=selected(),t=c&&c.topics.find(x=>x.id===folderTopicId),l=t&&c.lessonsData.find(x=>x.name===folderLessonName&&x.tid===t.id);
  if(!t)return 'Thư mục học tập';if(!l)return t.title;return l.name;
}
function folderCrumb(c,t,l){return `<nav class='folder-crumb' aria-label='Vị trí thư mục'><button onclick='folderGoRoot()'>Chủ đề</button>${t?`<span>›</span><button onclick='folderGoTopic()'>${esc(t.title)}</button>`:''}${l?`<span>›</span><b>${esc(l.name)}</b>`:''}</nav>`}
function folderGoRoot(){folderTopicId=null;folderLessonName=null;folderModule='goals';page='overview';render();window.scrollTo(0,0)}
function folderGoTopic(){folderLessonName=null;folderModule='goals';page='lessons';render();window.scrollTo(0,0)}
function folderPickTopic(id){folderTopicId=id;folderLessonName=null;folderModule='goals';page='lessons';render();window.scrollTo(0,0)}
function folderSelectModule(k){
  const x=FOLDER_MODULES.find(m=>m[0]===k);if(!x)return;
  if(k!=='grading')gradeForce=null;
  folderModule=k;page=x[2];
  /* Chỉ vẽ lại phần nội dung của tab, không dựng lại toàn bộ khung (tránh nhấp nháy, không mất vị trí cuộn) */
  const c=selected(),body=document.querySelector('.lesson-workspace-body');
  if(c&&body){
    const r=folderResolve(c),t=r.t,l=r.l;
    if(t&&l){
      body.innerHTML=folderModuleContent(c,t,l);
      const tabs=[...document.querySelectorAll('.lesson-workspace-head .folder-tabs button')];
      tabs.forEach(b=>b.removeAttribute('aria-current'));
      const i=FOLDER_MODULES.findIndex(m=>m[0]===k);
      if(tabs[i])tabs[i].setAttribute('aria-current','page');
      if(typeof iconifyButtons==='function')iconifyButtons();
      if(document.querySelector('.qgrp')&&typeof asgApplyFilters==='function')asgApplyFilters();
      return;
    }
  }
  render();window.scrollTo(0,0);
}
function folderResolve(c){
  let t=c.topics.find(x=>x.id===folderTopicId);
  if(!t){folderTopicId=null;folderLessonName=null;return {t:null,l:null}}
  let l=folderLessonName&&c.lessonsData.find(x=>x.name===folderLessonName&&x.tid===t.id);
  if(folderLessonName&&!l)folderLessonName=null;
  return {t,l:l||null};
}
function folderTopicCount(c,t){return c.lessonsData.filter(l=>l.tid===t.id).length}
function folderScopeInfo(c,sc0,t,l){
  const scope=scopeObj(c,sc0);
  if(!scope||scope.type==='course')return false;
  if(scope.type==='topic')return !!t&&scope.id===t.id;
  return !!l&&scope.ref===l;
}
function folderPickLesson(name,topicId){
  const c=selected(),l=c.lessonsData.find(x=>x.name===name&&(topicId?x.tid===topicId:true));
  folderTopicId=topicId||(l&&l.tid)||folderTopicId;folderLessonName=name;folderModule='goals';page='lessons';render();window.scrollTo(0,0);
}
/* Xoá bài học ngay tại đầu trang bài học: dùng lại hộp thoại xoá mềm sẵn có, sau đó về danh sách bài học của chủ đề */
function folderDeleteLesson(){
  const c=selected(),{l}=folderResolve(c);
  if(!l)return;
  const i=c.lessonsData.indexOf(l);
  if(i<0)return;
  delLesson(i);
  const ok=dlg&&dlg.ok;
  if(ok)dlg.ok=()=>{const r=ok();folderLessonName=null;page='lessons';return r};
}
/* Sửa tên bài học ngay tại đầu trang bài học (giữ nguyên chủ đề, mục tiêu, tài liệu) */
function folderRenameLesson(){
  const c=selected(),{l}=folderResolve(c);
  if(!l)return;
  const old=l.name;
  openDlg({title:'Sửa tên bài học',text:'Chỉ đổi tiêu đề. Mục tiêu, tài liệu, bài tập và kết quả học tập của bài học được giữ nguyên.',
    fields:[{k:'n',label:'Tiêu đề bài học',val:old}],ok:v=>{
      const n=String(v.n||'').trim();
      if(!n)return 'Bài học phải có tiêu đề.';
      if(n===old)return null;
      if(c.lessonsData.some(x=>x!==l&&x.tid===l.tid&&x.name===n))return 'Chủ đề này đã có bài học trùng tên.';
      l.name=n;l.upd=stamp();
      if(folderLessonName===old)folderLessonName=n;
      if(asgLes===old)asgLes=n;
      toast('Đã đổi tên bài học.');return null}});
}
/* Xoá chủ đề ngay trên danh sách: dùng lại hộp thoại xoá mềm sẵn có, sau đó đóng chủ đề nếu đang mở */
function folderDeleteTopic(ti){
  const c=selected(),t=c.topics[ti];
  if(!t)return;
  const id=t.id;
  delTopic(ti);
  const ok=dlg&&dlg.ok;
  if(ok)dlg.ok=()=>{const r=ok();if(folderTopicId===id){folderTopicId=null;folderLessonName=null}return r};
}
function folderTopicAccordion(c,t,ti,forceOpen){
  const lessons=c.lessonsData.filter(l=>l.tid===t.id);
  const open=forceOpen?'open':'';
  return `<details class='topic-folder' ${open}><summary><span class='topic-mark'>${String(ti+1).padStart(2,'0')}</span><span class='topic-title'>${esc(t.title)}</span><span class='pill plain'>${lessons.length} bài học</span><span class='topic-actions'><button type='button' class='topic-icon-btn' title='Thêm bài học' aria-label='Thêm bài học vào ${esc(t.title)}' onclick='event.preventDefault();event.stopPropagation();newLesson(${ti})'>${ic('plus',16)}</button><button type='button' class='topic-icon-btn' title='Sửa chủ đề' aria-label='Sửa chủ đề ${esc(t.title)}' onclick='event.preventDefault();event.stopPropagation();editTopic(${ti})'>${ic('edit',16)}</button><button type='button' class='topic-icon-btn danger-soft' title='Xoá chủ đề' aria-label='Xoá chủ đề ${esc(t.title)}' onclick='event.preventDefault();event.stopPropagation();folderDeleteTopic(${ti})'>${ic('trash',16)}</button></span></summary><div class='topic-lessons'>${lessons.length?lessons.map(l=>`<button class='folder-lesson-row' onclick="folderPickLesson('${esc(l.name)}','${esc(t.id)}')"><span class='lesson-name'><b>${esc(l.name)}</b><small>${(l.objs||[]).length} mục tiêu cần đạt · ${esc(l.status)}</small></span>${ic('arrow',17)}</button>`).join(''):`<div class='folder-empty'>Chưa có bài học. Dùng nút + để thêm bài học.</div>`}</div></details>`;
}
function folderWorkspace(){
  const c=selected(),{t,l}=folderResolve(c);
  if(!t){
    return `<div class='folder-wrap'><div class='folder-add-row'><button type='button' class='btn icon-only folder-add-only' onclick='newTopic()' aria-label='Thêm chủ đề' title='Thêm chủ đề'>${ic('plus',18)}</button></div>${c.topics.map((x,i)=>folderTopicAccordion(c,x,i,false)).join('')||`<div class='folder-empty'>Chưa có chủ đề. Bấm “Thêm chủ đề” để bắt đầu.</div>`}</div>`;
  }
  if(!l){
    const ti=c.topics.indexOf(t);
    return `<div class='folder-wrap'>${folderCrumb(c,null,null)}${folderTopicAccordion(c,t,ti,true)}</div>`;
  }
  const tabs=FOLDER_MODULES.map(x=>`<button type='button' ${folderModule===x[0]?"aria-current='page'":''} onclick="folderSelectModule('${x[0]}')">${ic(({goals:'target',assignments:'assignments',grading:'grade',questions:'questions',mastery:'mastery',gaps:'gaps',report:'assessments',resources:'file'})[x[0]]||'file',16)}<span>${x[1]}</span></button>`).join('');
  return `<div class='folder-wrap'>${folderCrumb(c,t,l)}<section class='panel lesson-workspace'><div class='lesson-workspace-head'><div class='row between' style='flex-wrap:wrap;gap:10px'><span class='row' style='margin-left:auto;gap:8px;align-items:center;flex-wrap:nowrap'><button type='button' class='btn light mini' onclick='folderRenameLesson()' aria-label='Sửa tên bài học' title='Sửa tên bài học'>${ic('edit',16)}</button><button type='button' class='btn light mini danger-soft' onclick='folderDeleteLesson()' aria-label='Xoá bài học' title='Xoá bài học'>${ic('trash',16)}</button><span class='pill ${l.status==='Nháp'?'plain':'good'}'>${esc(l.status||'Bài học')}</span></span></div><div class='folder-tabs' role='navigation' aria-label='Chức năng của bài học'>${tabs}</div></div><div class='lesson-workspace-body'>${folderModuleContent(c,t,l)}</div></section></div>`;
}
