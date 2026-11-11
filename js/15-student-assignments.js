/* EducMind · js/15-student-assignments.js
   Trang Bài tập của học sinh: danh sách, nộp bài, xóa bài nộp. */
function sAssign(){
  const c=selected(),s=me(),si=c.students.indexOf(s);
  if(gameLobby&&gameLobby.type==='asg')return survivalLobbyPage(c,c.assignments[gameLobby.ai],gameLobby.ai);
  if(gameLaunch&&gameLaunch.type==='asg')return survivalModePage(c,c.assignments[gameLaunch.ai],gameLaunch.ai);
  {const rp=redoPanel();if(rp)return rp}
  if(survivalResult)return survivalResultPage();
  const L=c.assignments.filter(a=>a.status==='Đã xuất bản'&&scopeLive(c,a));
  const itemFor=a=>{const i=c.assignments.indexOf(a),b=(a.subs||[])[si]||{has:false,score:null,tries:0,extra:0,qa:[],hist:[]},w=inWin(a),pb=pAsgBlock(c,s,a);
    if(pb)return `<div class='student-task-locked'>${pLockedAsg(a,i,pb)}</div>`;
    const graded=b.score!=null,waiting=b.has&&!graded,overdue=!b.has&&!w;
    const status=graded?'Đã chấm':waiting?'Đang chờ chấm':overdue?'Đã hết hạn':'Cần hoàn thành';
    const statusClass=graded?'good':waiting?'prog':overdue?'need':'plain';
    const typeLabel=a.gameMode==='survival'?'Sinh tồn tri thức':asgIsQ(a)?'Bài tập trắc nghiệm':'Nộp tệp / văn bản';
    const countLabel=asgIsQ(a)?(a.qs||[]).length+' câu hỏi':'Bài nộp';
    const act=!b.has?(w?(asgIsQ(a)?`<button class='btn student-task-cta' data-noicon='1' onclick='openAssignmentMode(${i})'>${b.redo?'Tiếp tục · chọn trò chơi':'Chọn trò chơi để bắt đầu'} ${ic('arrow',16)}</button>`:`<button class='btn student-task-cta' data-noicon='1' onclick='submitWork(${i},false)'>Nộp bài</button>`):`<span class='student-task-expired'>Đã quá hạn nộp bài</span>`):graded?`${pRedoBtn(c,s,a,i)}`:waiting?`<span class='student-task-waiting'>Bài đã nộp · chờ giáo viên chấm</span>`:w?`<span class='student-task-expired'>Đã quá thời điểm chỉnh sửa</span>`:`<span class='student-task-expired'>Đã đóng bài nộp</span>`;
    return `<article class='student-task-card ${graded?'is-graded':waiting?'is-waiting':''}' id='as-${i}' tabindex='-1'><div class='student-task-head'><div class='student-task-type-icon ${a.gameMode==='survival'?'is-survival':''}' aria-hidden='true'>${a.gameMode==='survival'?'🏝️':asgIsQ(a)?'✎':'▤'}</div><div class='student-task-title'><div class='student-task-eyebrow'><span>${typeLabel}</span><span class='pill ${statusClass}'>${status}</span></div><h3>${esc(a.name)}</h3>${a.desc?`<p>${esc(a.desc)}</p>`:''}</div>${graded?`<div class='student-task-score'><span>Kết quả</span><b>${esc(b.score)}<small> / ${esc(a.max)}</small></b></div>`:''}</div><div class='student-task-meta'><span><b>${countLabel}</b></span><span>Hạn ${esc(a.due||'—')}</span><span>Tối đa ${esc(a.max)} điểm</span><span>${pTriesOf(b)}/${pMax(a,b)} lượt đã dùng</span></div>${!asgIsQ(a)?rubricPreviewHtml(a):''}${b.has?`<div class='student-task-submission'><span class='student-task-submission-label'>Bài nộp</span><span>${esc(b.text||'Đã gửi bài')}${b.file?' · '+esc(typeof b.file==='string'?b.file:b.file.name||'tệp đính kèm'):''}</span></div>${graded&&b.fb?`<div class='student-task-feedback'><b>Nhận xét</b><span>${esc(b.fb)}</span></div>`:''}${pHist(a,b)}${qaView(b,false)}`:''}<div class='student-task-footer'>${act}</div></article>`;
  };
  const todo=L.filter(a=>{const b=(a.subs||[])[si]||{};return !b.has});
  return `<div class='student-assignments-page'><header class='student-assignments-header'><div><span class='student-page-eyebrow'>${esc(c.id)} · ${esc(c.topic||'Lớp học')}</span><h2 id='h-sa'>Bài tập được giao</h2><p>Danh sách này chỉ gồm bài em chưa nộp. Bài đã nộp và điểm số nằm trong tab “Kết quả học tập”.</p></div><div class='student-assignment-summary' aria-label='Tóm tắt bài tập'><div><b>${todo.length}</b><span>Cần làm</span></div><div><b>${L.length}</b><span>Đã giao</span></div></div></header>${todo.length?`<section class='student-task-section' aria-labelledby='h-todo'><div class='student-task-section-head'><div><h3 id='h-todo'>Việc cần hoàn thành</h3><p>${todo.length} bài chưa nộp</p></div><span class='student-section-count'>${todo.length}</span></div><div class='student-task-list'>${todo.map(itemFor).join('')}</div></section>`:`<section class='student-task-empty'><span aria-hidden='true'>${L.length?'✅':'📚'}</span><h3>${L.length?'Em đã nộp hết bài được giao':'Chưa có bài tập được giao'}</h3><p>${L.length?'Xem điểm và nhận xét trong tab “Kết quả học tập”.':'Bài tập sẽ xuất hiện tại đây khi giáo viên giao bài.'}</p>${L.length?`<button type='button' class='btn student-task-cta' data-noicon='1' onclick="setPage('results')">Mở kết quả học tập</button>`:''}</section>`}</div>`;
}
function submitWork(ai,ed){
  const c=selected(),s=me(),a=c.assignments[ai],b=a.subs[c.students.indexOf(s)];
  openDlg({title:(ed?'Chỉnh sửa bài nộp: ':'Nộp bài: ')+esc(a.name),text:'Nhập bài làm bằng văn bản, đính kèm một tệp (tối đa 50 MB) hoặc dùng cả hai.',okLabel:ed?'Lưu chỉnh sửa':'Nộp bài',fields:[{k:'t',label:'Bài làm',val:b.text||'',area:true},{k:'f',label:'Tệp đính kèm'+(ed&&b.file?' (hiện có: '+esc(b.file)+')':''),file:true}],ok:v=>{
    const t=v.t.trim(),f=v.f_f;
    if(f){if(f.size>52428800)return 'Tệp vượt giới hạn 50 MB.';const ext=f.name.split('.').pop().toLowerCase();if(!ALLOWED.includes(ext))return 'Định dạng .'+ext+' không được phép.'}
    if(!t&&!f&&!(ed&&b.file))return 'Không thể nộp bài trống: hãy nhập bài làm hoặc đính kèm tệp.';
    if(!inWin(a))return 'Đã quá thời hạn nộp bài.';
    const recKeys=recKeysForTarget(c,s,'assignment',ai);
    b.status=simNow()<=dueMs(a)?'SUBMITTED':'LATE';b.text=t;if(f)b.file=f.name;if(ed)b.edited=true;b.has=true;a.submitted=a.subs.filter(x=>x.has).length;markRecKeys(s,recKeys,'assignment-completed');
    toast(b.status==='LATE'?'Đã nộp, tính là nộp trễ.':ed?'Đã lưu chỉnh sửa.':'Đã nộp bài đúng hạn.');return null}});
}
function delWork(ai){
  const c=selected(),s=me(),a=c.assignments[ai],b=a.subs[c.students.indexOf(s)];
  openDlg({title:'Xóa bài nộp?',text:'Em có thể nộp lại nếu còn trong thời hạn. Tệp đính kèm cũ không còn gắn với bài nộp.',danger:true,okLabel:'Xóa bài nộp',ok:()=>{
    if(b.score!=null)return 'Bài đã được chấm, không thể xóa.';
    if(!inWin(a))return 'Đã quá thời hạn, không thể xóa bài nộp.';
    b.has=false;b.text='';b.file=null;b.edited=false;a.submitted=a.subs.filter(x=>x.has).length;toast('Đã xóa bài nộp. Em có thể nộp lại.');return null}});
}
