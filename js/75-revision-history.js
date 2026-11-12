/* EducMind · js/75-revision-history.js
   Lịch sử chỉnh sửa & phiên bản nội dung (chỉ giáo viên).
   Lưu ý: Các lớp bọc ở cuối tệp phải nạp SAU js/54-permissions.js (thứ tự bọc: ghi lịch sử → kiểm tra quyền → hàm gốc). */
/* ===== Lịch sử chỉnh sửa & phiên bản nội dung (teacher-only) ===== */
let REVISION_HISTORY=[];
let revisionClass='all',revisionType='all',revisionSearch='';
const REVISION_KEY='educmind.revisions.v1';
/* Chế độ demo đã gỡ bỏ: xóa nhật ký demo cũ còn lưu trên trình duyệt này. */
try{localStorage.removeItem(REVISION_KEY)}catch(e){}
REVISION_HISTORY=[]
function revisionId(){return 'REV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function revisionScope(c,sc){if(!sc)return 'Cả lớp';if(typeof sc==='string')return sc;if(sc.type==='topic'){const t=(c.topics||[]).find(x=>x.id===sc.id);return t?'Chủ đề: '+t.title:'Chủ đề'}if(sc.type==='lesson')return sc.ref?'Bài học: '+sc.ref.name:'Bài học';return 'Cả lớp'}
function revisionSnapshot(c){
  const cleanRes=l=>(l.res||[]).map(r=>({name:r.name,size:r.size||0}));
  const snap={
    topics:(c.topics||[]).map((t,i)=>({key:String(t.id||'topic-'+i),name:t.title,description:t.desc||'',status:t.status||''})),
    lessons:(c.lessonsData||[]).map((l,i)=>({key:String(l.hid||l.id||('lesson-'+i)),name:l.name,description:l.desc||'',status:l.status||'',topic:l.tid||'',objectives:(l.objs||[]).map(o=>({code:o.code,description:o.desc,index:o.idx})),resources:cleanRes(l)})),
    assignments:(c.assignments||[]).map((a,i)=>({key:String(a.aid||'assignment-'+i),name:a.name,description:a.desc||'',status:a.status||'',kind:a.kind||'WRITTEN',scope:revisionScope(c,a.scope),due:a.due||'',lateClose:a.lateClose||'',max:a.max||0,maxTries:a.maxTries||0,gameMode:a.gameMode||'',objectives:a.objs||[],rubric:(a.rubric||[]).map(x=>({name:x.name,max:x.max,description:x.description||''})),questions:(a.qs||[]).map(x=>({qid:x.qid,weight:x.w}))})),
    questions:(c.bank||[]).map((q,i)=>({key:String(q.id||'question-'+i),name:String(q.content||'').slice(0,160),content:q.content,type:q.type,options:q.opts||[],correctAnswer:q.ans,objectives:q.objs||[],difficulty:q.diff,bloom:q.bloom,source:q.src})),
    assessments:c.quiz&&!c.quiz.deleted?[{key:'quiz:'+c.id,name:c.quiz.name,scope:revisionScope(c,c.quiz.scope),status:c.quiz.status,duration:c.quiz.dur,maxAttempts:c.maxAtt,opens:c.quiz.open,closes:c.quiz.close,questions:(c.quiz.qs||[]).map(x=>({qid:x.qid,weight:x.w}))}]:[],
    grades:(c.assignments||[]).flatMap(a=>(a.subs||[]).map((b,i)=>b&&b.has?({key:String(a.aid||a.name)+'|'+String(c.students[i]&&c.students[i].email||i),name:(c.students[i]&&c.students[i].name||'Học sinh')+' · '+a.name,score:b.score==null?null:b.score,feedback:b.fb||'',rubricScores:(b.rubricScores||[]).map(x=>({name:x.name,max:x.max,score:x.score,comment:x.comment||''})),gradedBy:b.gradedBy||'',confirmedAt:b.confirmedAt||''}):null).filter(Boolean)),
    assessmentGrades:(c.students||[]).flatMap(st=>(st.atts||[]).map(t=>({key:String(st.email)+'|'+String(t.n),name:st.name+' · '+(c.quiz&&c.quiz.name||'Bài kiểm tra')+' · lượt '+t.n,status:t.status,total:t.total==null?null:t.total,answers:Object.keys(t.sc||{}).sort().map(k=>({question:k,score:t.sc[k],feedback:t.fb&&t.fb[k]||''}))})))
  };
  const all={};Object.entries(snap).forEach(([type,items])=>items.forEach(x=>all[type+'|'+x.key]={type,key:type+'|'+x.key,name:x.name||x.title||x.key,data:x}));
  return all;
}
function revisionChanges(before,after){
  const keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]),changes=[];
  keys.forEach(k=>{const b=before&&before[k]?before[k].data:null,a=after&&after[k]?after[k].data:null;if(JSON.stringify(b)!==JSON.stringify(a))changes.push({type:(after&&after[k]||before[k]).type,key:k,name:(after&&after[k]||before[k]).name,before:b,after:a})});
  return changes;
}
function recordRevision(c,action,before,after){
  if(!c)return 0;const changes=revisionChanges(before,after);if(!changes.length)return 0;
  const row={id:revisionId(),classId:c.id,className:c.id,owner:(sess&&sess.email)||c.owner||'',action:String(action||'Cập nhật nội dung'),user:acctName(),at:new Date().toISOString(),changes};
  REVISION_HISTORY.unshift(row);REVISION_HISTORY=REVISION_HISTORY.slice(0,250);
  try{localStorage.setItem(REVISION_KEY,JSON.stringify(REVISION_HISTORY))}catch(e){}
  return changes.length;
}
function revisionTypeLabel(t){return ({topics:'Chủ đề',lessons:'Bài học / mục tiêu',assignments:'Bài tập / rubric',questions:'Câu hỏi',assessments:'Bài kiểm tra',grades:'Điểm bài tập',assessmentGrades:'Điểm bài kiểm tra'})[t]||t}
function revisionInspect(id){
  const r=REVISION_HISTORY.find(x=>x.id===id);if(!r)return;
  const blocks=r.changes.map(x=>`<section style='margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--fill)'><b>${esc(revisionTypeLabel(x.type))} · ${esc(x.name)}</b><div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:9px'><div><b style='font-size:11px'>Trước</b><pre class='revision-json'>${esc(x.before==null?'(chưa có)':JSON.stringify(x.before,null,2))}</pre></div><div><b style='font-size:11px'>Sau</b><pre class='revision-json'>${esc(x.after==null?'(đã xóa)':JSON.stringify(x.after,null,2))}</pre></div></div></section>`).join('');
  const when=new Date(r.at).toLocaleString('vi-VN');
  openDlg({title:'Phiên bản · '+esc(r.action),text:`<div class='revision-detail-meta'><b>${esc(r.className)}</b> · ${esc(r.user)} · ${esc(when)}</div>${blocks}<p class='muted' style='margin:8px 0 0'>Ảnh chụp này chỉ dùng để xem và đối chiếu. Việc khôi phục phiên bản sẽ cần bước kiểm tra an toàn riêng.</p>`,okLabel:'Đóng',ok:()=>null});
}
function revisionPage(){
  const owner=(sess&&sess.email)||selected().owner||'',rows=REVISION_HISTORY.filter(r=>!owner||r.owner===owner);
  const classNames=[...new Set(rows.map(r=>r.classId))];
  const filtered=rows.filter(r=>{
    const hay=(r.action+' '+r.user+' '+r.className+' '+r.changes.map(x=>x.name+' '+revisionTypeLabel(x.type)).join(' ')).toLowerCase();
    return (revisionClass==='all'||r.classId===revisionClass)&&(revisionType==='all'||r.changes.some(x=>x.type===revisionType))&&(!revisionSearch||hay.includes(revisionSearch.toLowerCase()));
  });
  const typeOptions=[['all','Tất cả thay đổi'],['lessons','Bài học / mục tiêu'],['assignments','Bài tập / rubric'],['questions','Câu hỏi'],['assessments','Bài kiểm tra'],['grades','Điểm bài tập'],['assessmentGrades','Điểm bài kiểm tra'],['topics','Chủ đề']];
  return `<div class='revision-page'><section class='panel revision-header'><div><span class='cal-eyebrow'>PHIÊN BẢN NỘI DUNG · NHẬT KÝ ĐIỂM</span><h2>Lịch sử chỉnh sửa</h2><p>Xem ai đã thay đổi nội dung, khi nào, và đối chiếu trạng thái trước/sau. Lịch sử này chỉ dành cho giáo viên.</p></div><span class='revision-count'>${filtered.length}<small> thay đổi</small></span></section><section class='panel revision-filters'><div class='selectbox'><label for='rev-class'>Lớp</label><select id='rev-class' onchange='revisionClass=this.value;render()'><option value='all'>Tất cả lớp</option>${classNames.map(x=>`<option value='${esc(x)}' ${revisionClass===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class='selectbox'><label for='rev-type'>Loại thay đổi</label><select id='rev-type' onchange='revisionType=this.value;render()'>${typeOptions.map(x=>`<option value='${x[0]}' ${revisionType===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div><div class='selectbox revision-search'><label for='rev-find'>Tìm nội dung hoặc người sửa</label><input id='rev-find' value='${esc(revisionSearch)}' placeholder='Nhập tên bài, tiêu chí, học sinh…' oninput='revisionSearch=this.value;revisionListRefresh()'></div><button class='btn light' onclick="revisionSearch='';revisionClass='all';revisionType='all';render()">Xóa lọc</button></section><section class='panel revision-list'><div class='revision-list-head'><h3>Các phiên bản gần đây</h3><span class='pill plain'>Tối đa 250 bản ghi trên thiết bị này</span></div>${filtered.length?filtered.map(r=>`<article class='revision-row'><div class='revision-mark' aria-hidden='true'>${ic(r.changes.some(x=>x.type==='grades'||x.type==='assessmentGrades')?'navGrade':'calendar',17)}</div><div class='revision-row-main'><div class='revision-row-title'><b>${esc(r.action)}</b><span class='pill plain'>${esc(r.className)}</span></div><p>${r.changes.map(x=>`${esc(revisionTypeLabel(x.type))}: ${esc(x.name)}`).join(' · ')}</p><small>${esc(r.user)} · ${new Date(r.at).toLocaleString('vi-VN')} · ${r.changes.length} mục</small></div><button class='btn light mini' onclick="revisionInspect('${r.id}')">Đối chiếu</button></article>`).join(''):`<div class='revision-empty'><b>Chưa có lịch sử chỉnh sửa</b><span>Các thay đổi sẽ được ghi lại từ thời điểm bật tính năng, gồm chỉnh sửa nội dung, xuất bản, rubric và điểm đã chấm.</span></div>`}</section><section class='panel revision-note'><b>Lưu ý về phiên bản</b><p>Lịch sử được ghi từ bây giờ; không thể tạo lại những thay đổi trước đây. Trong bản prototype, nhật ký được lưu trong localStorage của trình duyệt này; khi nối với cơ sở dữ liệu, cần chuyển nhật ký sang lưu trữ phía máy chủ và áp dụng phân quyền tương ứng.</p></section></div>`;
}
function revisionListRefresh(){const q=document.getElementById('rev-find');if(q)q.setAttribute('value',revisionSearch);render()}
/* Tự chụp trạng thái quanh các hộp thoại có thể thay đổi nội dung, rubric hoặc điểm. */
const _openDlgRevision=openDlg;
openDlg=function(d){
  const c=selected&&selected(),title=String(d&&d.title||''),track=c&&role==='T'&&/(Sửa|Tạo|Thêm|Xóa|Rubric|Chấm|Xác nhận|Xuất bản)/i.test(title)&&typeof d.ok==='function';
  if(track){const before=revisionSnapshot(c),ok=d.ok;d.ok=function(v){const result=ok(v);if(result==null||result===undefined){const after=revisionSnapshot(c);recordRevision(c,title,before,after)}return result}}
  return _openDlgRevision(d);
};
function revisionWrap(name,action){
  const original=window[name];if(typeof original!=='function'||original.__revisionWrapped)return;
  const wrapped=function(...args){const c=selected&&selected(),before=c&&role==='T'?revisionSnapshot(c):null,result=original.apply(this,args);if(before){const after=revisionSnapshot(c);recordRevision(c,action,before,after)}return result};
  wrapped.__revisionWrapped=true;window[name]=wrapped;
}
['togglePub','togglePubQ','togAsg','togTopic','moveTopic','asgSaveNew','asgTog','asgGrp','asgRm','asgMove','asgW'].forEach(n=>revisionWrap(n,({togglePub:'Xuất bản / ẩn bài học',togglePubQ:'Xuất bản / ẩn bài kiểm tra',togAsg:'Xuất bản / ẩn bài tập',togTopic:'Xuất bản / ẩn chủ đề',moveTopic:'Sắp xếp lại chủ đề',asgSaveNew:'Tạo bài tập',asgTog:'Thay đổi câu hỏi trong bài tập',asgGrp:'Cập nhật nhóm câu hỏi',asgRm:'Gỡ câu hỏi khỏi bài tập',asgMove:'Sắp xếp câu hỏi',asgW:'Điều chỉnh trọng số câu hỏi'})[n]));
let revisionEditBase=null;
function revisionFlushBuilder(){
  if(!revisionEditBase)return;const c=classes.find(x=>x.id===revisionEditBase.classId);
  if(c)recordRevision(c,revisionEditBase.action,revisionEditBase.before,revisionSnapshot(c));
  revisionEditBase=null;
}
const _asgOpenRevision=window.asgOpen;
window.asgOpen=function(i){
  revisionFlushBuilder();const c=selected(),before=revisionSnapshot(c),result=_asgOpenRevision.apply(this,arguments);
  revisionEditBase={classId:c.id,action:'Sửa bài tập trong trình soạn thảo',before};return result;
};
const _asgCancelRevision=window.asgCancel;
window.asgCancel=function(){const result=_asgCancelRevision.apply(this,arguments);revisionFlushBuilder();return result};
const _setPageRevision=window.setPage;
window.setPage=function(p){if(revisionEditBase&&p!=='assignments')revisionFlushBuilder();return _setPageRevision.apply(this,arguments)};
