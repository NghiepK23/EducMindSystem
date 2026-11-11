/* EducMind · js/67-teacher-dashboard.js
   Trang Tổng quan của giáo viên. */
function dashboardOpen(module,topicId,lessonName,kind,index,tab){
  gradeForce=null;
  folderTopicId=topicId||null;folderLessonName=lessonName||null;folderModule=module||'goals';
  if(kind){grItemType=kind;if(kind==='asg')gradeAi=+index||0;grTab=tab||'mark'}
  if(!folderTopicId)page='overview';else if(!folderLessonName)page='lessons';else page=({goals:'lessons',questions:'questions',resources:'resources'})[folderModule]||'lessons';
  if(['assignments','grading','mastery','gaps','recommend'].includes(module)){page=module;folderTopicId=null;folderLessonName=null}
  render();window.scrollTo(0,0);
}
function dashboardContext(c,scope,module,kind,index,tab){
  const suffix=kind?`, '${kind}', ${index||0}${tab?`, '${tab}'`:''}`:'';
  if(scope&&scope.type==='lesson'&&scope.ref){return `dashboardOpen('${module}','${esc(scope.ref.tid)}','${esc(scope.ref.name)}'${suffix})`}
  if(scope&&scope.type==='topic'){
    const t=c.topics.find(x=>x.id===scope.id),l=t&&c.lessonsData.find(x=>x.tid===t.id);
    return t&&l?`dashboardOpen('${module}','${esc(t.id)}','${esc(l.name)}'${suffix})`:`dashboardOpen('goals','${esc(scope.id)}',''${suffix})`;
  }
  const t=c.topics[0],l=t&&c.lessonsData.find(x=>x.tid===t.id);
  return t&&l?`dashboardOpen('${module}','${esc(t.id)}','${esc(l.name)}'${suffix})`:`dashboardOpen('goals','',''${suffix})`;
}
function dashboardPage(){
  const c=selected(),pendingAsg=c.assignments.reduce((n,a)=>n+a.subs.filter(b=>b&&b.has&&b.score==null).length,0);
  const pendingQuiz=c.quiz.deleted?0:c.students.reduce((n,s)=>n+s.atts.filter(t=>t.status==='SUBMITTED').length,0);
  const open=openGaps(c),lessonsN=c.lessonsData.length;
  const tasks=c.assignments.map((a,i)=>({a,i,n:a.subs.filter(b=>b&&b.has&&b.score==null).length})).filter(x=>x.n).sort((x,y)=>y.n-x.n).slice(0,5);
  const quizTarget=c.quiz.deleted?null:{q:c.quiz,n:pendingQuiz};
  const gapPreview=open.slice(0,5);
  const actionRows=tasks.map(({a,i,n})=>`<div class='item'><div><b>${esc(a.name)}</b><div class='muted'>${n} bài chờ chấm · ${esc(scopeLbl(c,a.scope))}</div></div><button class='btn light' onclick="${dashboardContext(c,a.scope,'grading','asg',i)}">Mở chấm điểm</button></div>`).join('');
  const quizRow=quizTarget&&quizTarget.n?`<div class='item'><div><b>${esc(quizTarget.q.name)}</b><div class='muted'>${quizTarget.n} lượt kiểm tra chờ chấm · ${esc(scopeLbl(c,quizTarget.q.scope))}</div></div><button class='btn light' onclick="${dashboardContext(c,quizTarget.q.scope,'grading','quiz',0,'result')}">Mở kết quả</button></div>`:'';
  const gaps=gapPreview.map(x=>{const l=lessonOf(c,x.j),t=l&&c.topics.find(t=>t.id===l.tid);const dest=`setPage('gaps')`;return `<div class='item'><div><b>${esc(x.s.name)}</b><div class='muted'>${esc(codeOf(c,x.j))} · ${esc(c.goals[x.j])} · ${pct(x.s.mastery[x.j])}%</div></div><button class='btn light' onclick="${dest}">Xem lỗ hổng</button></div>`}).join('');
  return `<div class='dashboard'>
    <section class='panel'><div class='grid' style='grid-template-columns:repeat(2,minmax(0,1fr));gap:14px'>${metric('lessons','Chủ đề / bài học',c.topics.length+' / '+lessonsN,'Trong lớp '+esc(c.id))}${metric('assignments','Bài tập chờ chấm',pendingAsg,'Cần giáo viên phản hồi')}${metric('assessments','Lượt kiểm tra chờ chấm',pendingQuiz,'Bài tập tự luận hoặc cần rà soát')}${metric('gaps','Lỗ hổng đang mở',open.length,'Theo dõi mục tiêu cần hỗ trợ')}</div></section>
    <section class='panel'><div class='row between' style='flex-wrap:wrap'><div><h2>Trung tâm điều hướng</h2><p class='lead' style='margin:4px 0 0'>Mở nhanh thư mục học tập, quản lý lớp hoặc xem các việc cần ưu tiên.</p></div><button class='btn' onclick="setPage('overview')">${ic('lessons',16)}Mở thư mục học tập</button></div><div class='folder-grid' style='margin-top:12px'><button class='folder-tile' onclick="setPage('classes')"><span class='folder-icon'>${ic('classes',20)}</span><span><b>Lớp học phụ trách</b><span class='muted'>Xem và quản lý các lớp được giao.</span></span></button><button class='folder-tile' onclick="setPage('students')"><span class='folder-icon'>${ic('students',20)}</span><span><b>Học sinh</b><span class='muted'>Tìm hồ sơ học sinh trong lớp đang chọn.</span></span></button></div></section>
    <section class='panel'><div class='row between' style='flex-wrap:wrap'><div><h2>Đánh giá học tập</h2><p class='lead' style='margin:4px 0 0'>Ba mục phân tích dùng chung cho mọi bài học của lớp.</p></div><span class='row' style='gap:8px'><button class='btn light' onclick="setPage('mastery')">Mức độ nắm vững</button><button class='btn light' onclick="setPage('gaps')">Lỗ hổng kiến thức</button><button class='btn light' onclick="setPage('recommend')">Gợi ý học tập</button></span></div></section>
    <div class='cols'><section class='panel'><h2>Việc cần ưu tiên</h2><p class='lead'>Bài tập và lượt kiểm tra đang chờ giáo viên chấm.</p>${actionRows||quizRow?actionRows+quizRow:`<div class='folder-empty'>Không có lượt nào đang chờ chấm.</div>`}</section><section class='panel'><div class='row between'><div><h2>Lỗ hổng kiến thức</h2><p class='lead' style='margin:4px 0 0'>Các mục tiêu đang cần hỗ trợ.</p></div><button class='btn light' onclick="setPage('overview');folderPickTopic('${esc(c.topics[0]?.id||'')}')">Xem thư mục</button></div>${gaps||`<div class='folder-empty'>Không có lỗ hổng đang mở.</div>`}</section></div>
  </div>`;
}
