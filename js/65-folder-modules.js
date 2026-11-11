/* EducMind · js/65-folder-modules.js
   Thư mục học tập · nội dung từng phần: bài tập, chấm điểm trong bài học. */
function folderModuleContent(c,t,l){
  /* đang soạn bài tập/bài kiểm tra ngay trong bài học: hiện trình tạo thay cho danh sách */
  if(folderModule==='goals')return folderObjectives(c,l);
  if(folderModule==='questions')return folderQuestions(c,l);
  if(folderModule==='resources')return folderResources(c,l);
  return folderObjectives(c,l);
}
function folderAssignments(c,t,l){
  const A=c.assignments.map((a,i)=>({a,i})).filter(x=>folderScopeInfo(c,x.a.scope,t,l)),q=c.quiz;
  const qIn=!q.deleted&&folderScopeInfo(c,q.scope,t,l);
  const cards=A.map(({a,i})=>`<details class='work-card'><summary><span><b>${esc(a.name)}</b> <span class='pill ${a.status==='Nháp'?'plain':'good'}'>${esc(a.status)}</span><div class='muted'>${a.submitted}/${c.count} nộp · ${a.graded} chấm · ${a.max} điểm · hạn ${esc(a.due)}</div></span><span class='pill plain'>Mở</span></summary><p class='muted'>${esc(a.desc||'Bài tập theo bộ câu hỏi đã chọn.')}</p><div class='row'><button class='btn light' onclick='goGrade(${i})'>Chấm điểm & kết quả</button>${asgIsQ(a)?`<button class='btn light' onclick='asgOpen(${i})'>Soạn câu hỏi</button>`:''}<button class='btn light' onclick='editAsg(${i})'>Sửa</button><button class='btn light' onclick='asgPrev(${i})'>Xem trước</button></div></details>`).join('');
  const quizLock=hasAtt(c);
  const quiz=qIn?`<details class='work-card'><summary><span><b>${esc(q.name)}</b> <span class='pill prog'>Bài tập</span><div class='muted'>${q.dur} phút · ${c.maxAtt} lượt tối đa · ${q.qs.length} câu · ${esc(q.status)}</div></span><span class='pill plain'>Mở</span></summary><p class='muted'>Bài tập thuộc ${esc(scopeLbl(c,q.scope))}.</p><div class='row' style='flex-wrap:wrap;gap:8px'><button class='btn light' onclick="asgTab='quiz';folderSelectModule('grading')">Chấm điểm & xem kết quả</button><button class='btn light' onclick='editQuiz()'>Sửa thông số</button><button class='btn light' onclick='togglePubQ()'>${q.status==='Nháp'?'Xuất bản':'Hủy xuất bản'}</button><button class='btn light danger-soft' onclick='delQuiz()' aria-label='Xóa bài kiểm tra' title='Xóa bài kiểm tra'>${ic('trash',16)}</button></div><div style='margin-top:10px'><b style='font-size:.8125rem'>Câu hỏi của bài · ${q.qs.length}</b>${q.qs.length?q.qs.map((x,i)=>{const qq=qOf(c,x.qid);return `<div class='item'><div><b>${i+1}. ${esc(qq.content)}</b><div class='muted'>${QT[qq.type]} · trọng số ${x.w}</div></div>${quizLock?'':`<button class='btn light' onclick='rmQ(${i})' aria-label='Gỡ câu ${i+1}' title='Gỡ câu khỏi bài kiểm tra'>${ic('trash',16)}</button>`}</div>`}).join(''):`<div class='muted'>Chưa có câu hỏi nào: thêm từ ngân hàng câu hỏi của bài học này.</div>`}${quizLock?`<p class='muted' style='margin:6px 0 0'>Bài đã có lượt làm nên không sửa được danh sách câu hỏi.</p>`:`<button class='btn light' data-noicon style='margin-top:8px' onclick='addQ()'>${ic('plus',16)}Thêm từ ngân hàng câu hỏi</button>`}</div></details>`:'';
  return `<section class='panel'><div class='row between' style='flex-wrap:wrap'><div><h2>Bài tập & kiểm tra của bài học</h2><p class='lead' style='margin:4px 0 0'>Chỉ hiển thị bài gắn với bài học này hoặc dùng chung trong chủ đề.</p></div><span class='row' style='gap:8px;flex-wrap:nowrap'><button class='btn' onclick='folderAddAssignment()'>${ic('plus',16)}Tạo bài tập</button></span></div>${cards?cards:`<div class='folder-empty'>Chưa có bài tập nào gắn với bài học này. Bấm nút <b>Tạo bài tập</b> để tạo bài tập cho bài học này.</div>`}</section>`;
}
function folderAddAssignment(){
  const c=selected(),r=folderResolve(c),l=r&&r.l;
  page='assignments';
  addAssignment();                                   /* trình tạo 3 bước */
  const d=asgDraft;
  if(d){
    if(l){d.scopeSel='Bài học: '+l.name;asgLes=l.name;asgAutoName()}
    asgStepN=1;focusId='ab-name';
  }
  render();window.scrollTo(0,0);
}
/* Danh sách bài tập của MỘT bài học — dùng chung cho màn chấm và ô tìm kiếm */
function gradeWorks(c,t,l){
  const works=c.assignments.map((a,i)=>({kind:'asg',i,label:a.name,meta:'Bài tập'})).filter(w=>folderScopeInfo(c,c.assignments[w.i].scope,t,l));
  if(!c.quiz.deleted&&folderScopeInfo(c,c.quiz.scope,t,l))works.push({kind:'quiz',i:0,label:c.quiz.name,meta:'Bài tập'});
  /* Mở từ thông báo: đưa đúng bài cần chấm vào danh sách kể cả khi phạm vi của nó là “Cả lớp”. */
  if(gradeForce==='quiz'&&!c.quiz.deleted&&!works.some(w=>w.kind==='quiz'))works.push({kind:'quiz',i:0,label:c.quiz.name,meta:'Bài tập'});
  if(typeof gradeForce==='number'&&c.assignments[gradeForce]&&!works.some(w=>w.kind==='asg'&&w.i===gradeForce))works.unshift({kind:'asg',i:gradeForce,label:c.assignments[gradeForce].name,meta:'Bài tập'});
  return works;
}
function folderGrading(c,t,l){
  const works=gradeWorks(c,t,l);
  if(!works.some(w=>w.kind===grItemType))grItemType=works[0]?.kind||'asg';
  let sel=works.find(w=>w.kind===grItemType&&(w.kind==='asg'?w.i===gradeAi:true))||works[0];
  if(!sel)return `<section class='panel'><h2>Chấm điểm & Kết quả</h2><div class='folder-empty'>Bài học này chưa có bài tập hoặc bài kiểm tra cần chấm.</div></section>`;
  if(sel.kind==='asg')gradeAi=sel.i;
  const a=sel.kind==='asg'?c.assignments[sel.i]:null,isQ=sel.kind==='quiz';
  const select=`<div class='row grade-tools'><button type='button' class='btn light icon-only grp-btn' data-iconified='1' aria-haspopup='dialog' aria-label='Tìm và chọn bài tập hoặc bài kiểm tra để chấm · đang chọn: ${esc(sel.label)}' title='Tìm và chọn bài để chấm điểm, xem kết quả' onclick='grPickOpen()'>${ic('search',18)}</button></div>`;
  if(grTab!=='mark'&&grTab!=='result')grTab='mark';
  const tabs=`<div class='seg seg-wide' role='tablist' aria-label='Chấm điểm và kết quả của bài đang chọn'><button role='tab' aria-selected='${grTab==='mark'}' onclick="grTabSet('mark')">Chấm điểm</button><button role='tab' aria-selected='${grTab==='result'}' onclick="grTabSet('result')">Kết quả</button></div>`;
  if(grTab==='result'){
    if(isQ)return `<section class='panel' aria-label='Kết quả · ${esc(sel.label)}'>${select}${tabs}${attemptsPanel(c)}</section>`;
    const rows=c.students.map((s,i)=>{const b=a.subs[i]||{};return `<tr><td class='student'>${esc(s.name)}</td><td>${b.has?'<span class="pill prog">Đã nộp</span>':'<span class="pill plain">Chưa nộp</span>'}</td><td>${b.score==null?'–':`<b>${b.score}/${a.max}</b>`}</td><td>${pTriesOf(b)}</td><td>${esc(b.fb||'–')}</td></tr>`}).join('');
    return `<section class='panel' aria-label='Kết quả · ${esc(a.name)}'>${select}${tabs}<div class='tablewrap'><table><thead><tr><th>Học sinh</th><th>Trạng thái</th><th>Điểm</th><th>Lượt làm</th><th>Nhận xét</th></tr></thead><tbody>${rows}</tbody></table></div></section>${triesPanel(c)}`;
  }
  if(isQ)return `<section class='panel' aria-label='Phân tích bài kiểm tra · ${esc(sel.label)}'>${select}${tabs}${anSection(c,'quiz',0)}</section>`;
  return `<section class='panel' aria-label='Chấm điểm · ${esc(a.name)}'>${select}${tabs}${grList(c,sel.i,a)}</section>`;
}
/* ===== Thư mục học tập: mọi nội dung giáo viên đi theo Chủ đề > Bài học > chức năng ===== */
let folderTopicId=null,folderLessonName=null,folderModule='goals';
const FOLDER_MODULES=[
  ['goals','Mục tiêu','lessons'],
  ['resources','Tài liệu','resources']
];
function folderGradePick(v){const p=String(v).split(':');grItemType=p[0];gradeAi=+p[1]||0;grTab='mark';gradeForce=null;render()}
