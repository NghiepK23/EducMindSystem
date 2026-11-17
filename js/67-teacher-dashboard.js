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
function dashboardGreeting(date=new Date()){
  const hour=date.getHours();
  return hour<12?'Chào buổi sáng':hour<18?'Chào buổi chiều':'Chào buổi tối';
}
function dashboardPage(){
  const c=selected(),pendingAsg=c.assignments.reduce((n,a)=>n+a.subs.filter(b=>b&&b.has&&b.score==null).length,0);
  const pendingQuiz=c.quiz.deleted?0:c.students.reduce((n,s)=>n+s.atts.filter(t=>t.status==='SUBMITTED').length,0);
  const open=openGaps(c),lessonsN=c.lessonsData.length;
  const tasks=c.assignments.map((a,i)=>({a,i,n:a.subs.filter(b=>b&&b.has&&b.score==null).length})).filter(x=>x.n).sort((x,y)=>y.n-x.n).slice(0,5);
  const published=c.assignments.filter(a=>a.status==='Đã xuất bản'&&scopeLive(c,a));
  const submitted=new Set();
  published.forEach((a,ai)=>(a.subs||[]).forEach((s,i)=>{if(s&&s.has)submitted.add(ai+'|'+i)}));
  const completionTotal=published.length*c.students.length;
  const completion=completionTotal?Math.min(100,Math.round(submitted.size/completionTotal*100)):null;
  const studentsToSupport=new Map();
  open.forEach(({s,j})=>{const item=studentsToSupport.get(s.id)||{s,goals:[]};item.goals.push(j);studentsToSupport.set(s.id,item)});
  const measured=c.students.flatMap(s=>s.mastery.filter(v=>v!=null));
  const classMastery=measured.length?Math.round(mean(measured)*100):null;
  const quizScores=c.students.filter(s=>s.att.used>0&&Number.isFinite(s.att.best)).map(s=>s.att.best);
  const quizAverage=quizScores.length?Math.round(mean(quizScores)*100):null;
  const quizTarget=c.quiz.deleted?null:{q:c.quiz,n:pendingQuiz};
  const actionRows=tasks.map(({a,i,n})=>`<div class='td-task'><span class='td-task-icon'>${ic('assignments',18)}</span><div class='td-task-copy'><b>${esc(a.name)}</b><small>${n} bài chờ chấm · ${esc(scopeLbl(c,a.scope))}</small></div><button class='btn light mini' onclick="${dashboardContext(c,a.scope,'grading','asg',i)}">Mở chấm</button></div>`).join('');
  const quizRow=quizTarget&&quizTarget.n?`<div class='td-task'><span class='td-task-icon is-violet'>${ic('assessments',18)}</span><div class='td-task-copy'><b>${esc(quizTarget.q.name)}</b><small>${quizTarget.n} lượt kiểm tra chờ đánh giá · ${esc(scopeLbl(c,quizTarget.q.scope))}</small></div><button class='btn light mini' onclick="${dashboardContext(c,quizTarget.q.scope,'grading','quiz',0,'result')}">Mở kết quả</button></div>`:'';
  const helpRows=[...studentsToSupport.values()].slice(0,4).map(({s,goals})=>`<div class='td-insight'><span class='td-insight-mark is-warn'>${ic('alert',16)}</span><span><b>${esc(s.name)}</b><small>${goals.length} mục tiêu cần củng cố</small></span><button class='btn light mini' onclick="setPage('gaps')">Theo dõi</button></div>`).join('');
  const assignmentRows=published.slice(0,5).map(a=>{
    const done=(a.subs||[]).filter(s=>s&&s.has).length,total=c.students.length,rate=total?Math.min(100,Math.round(done/total*100)):null;
    return `<div class='td-chart-row'><span class='td-chart-label' title='${esc(a.name)}'>${esc(a.name)}</span><span class='td-chart-track' role='img' aria-label='${rate==null?'Chưa có học sinh trong lớp':done+' trên '+total+' học sinh đã nộp'}'><i style='width:${rate||0}%'></i></span><b>${rate==null?'—':rate+'%'}</b><small>${done}/${total} đã nộp</small></div>`;
  }).join('');
  const recent=c.students.flatMap(s=>s.ev.flatMap((events,j)=>events.map(e=>({s,j,e})))).sort((a,b)=>b.e.day-a.e.day).slice(0,4).map(({s,j,e})=>`<div class='td-activity-row'><span class='td-activity-dot ${tier(e.s)}'></span><span><b>${esc(s.name)} · ${esc(gl(c,j))}</b><small>${esc(e.src||'Hoạt động học tập')} · ${pct(e.s)}%${e.day===today?' · Hôm nay':e.day===today-1?' · Hôm qua':''}</small></span></div>`).join('');
  const dueSoon=c.assignments.filter(a=>a.status==='Đã xuất bản'&&scopeLive(c,a)&&dueMs(a)>=simNow()&&dueMs(a)<=simNow()+7*864e5).slice(0,3).map(a=>`<div class='td-deadline-row'><span class='td-deadline-icon'>${ic('calendar',16)}</span><span><b>${esc(a.name)}</b><small>Hạn ${esc(a.due)} · ${esc(scopeLbl(c,a.scope))}</small></span></div>`).join('');
  return `<div class='teacher-dashboard'>
    <section class='td-welcome'>
      <div class='td-welcome-copy'><span class='td-eyebrow'>TEACHER COMMAND CENTER · ${esc(c.id)}</span><h2>${dashboardGreeting()}, ${esc(acctName())}</h2><p>Toàn cảnh lớp học, bài tập và những học sinh cần được đồng hành hôm nay.</p>
        <div class='td-welcome-actions'><button class='btn' onclick="setPage('assignments')">${ic('assignments',17)}Tạo bài tập</button><button class='btn light' onclick="setPage('overview')">${ic('lessons',17)}Soạn bài</button></div>
      </div><span class='td-welcome-art' aria-hidden='true'><img src='assets/student-characters.png' alt=''></span>
    </section>
    <section class='td-metrics' aria-label='Tổng quan lớp học'>
      <article class='td-metric'><span class='td-metric-icon'>${ic('classes',19)}</span><span class='td-metric-label'>Lớp phụ trách</span><b>${visClasses().length}</b><small>${esc(c.id)} đang được chọn</small></article>
      <article class='td-metric'><span class='td-metric-icon is-violet'>${ic('assignments',19)}</span><span class='td-metric-label'>Bài tập đang hoạt động</span><b>${published.length}</b><small>Trong lớp đang chọn</small></article>
      <article class='td-metric'><span class='td-metric-icon is-good'>${ic('trend',19)}</span><span class='td-metric-label'>Tỷ lệ hoàn thành</span><b>${completion==null?'—':completion+'%'}</b><small>${completion==null?'Chưa có bài tập hoặc học sinh':submitted.size+' / '+completionTotal+' lượt nộp'}</small></article>
      <article class='td-metric'><span class='td-metric-icon is-warn'>${ic('students',19)}</span><span class='td-metric-label'>Học sinh cần hỗ trợ</span><b>${studentsToSupport.size}</b><small>Theo các mục tiêu đang mở</small></article>
    </section>
    <div class='td-dashboard-grid'>
      <section class='panel td-panel td-analytics'><header class='td-section-head'><div><span class='td-eyebrow'>LEARNING ANALYTICS</span><h3>Tiến độ và kết quả lớp học</h3></div><button class='btn light mini' onclick="setPage('report')">Báo cáo chi tiết</button></header>
        <div class='td-analytics-summary'><div><span>Bài tập đã giao</span><b>${published.length}</b></div><div><span>Tổng lượt đã nộp</span><b>${submitted.size}</b></div><div><span>Mức nắm vững TB</span><b>${classMastery==null?'—':classMastery+'%'}</b></div><div><span>Điểm kiểm tra TB</span><b>${quizAverage==null?'—':quizAverage+'%'}</b></div></div>
        <h4>Tỷ lệ nộp theo bài tập</h4>${assignmentRows||`<div class='td-empty'>Chưa có bài tập đã xuất bản để phân tích.</div>`}
      </section>
      <section class='panel td-panel td-priorities'><header class='td-section-head'><div><span class='td-eyebrow'>CẦN XỬ LÝ</span><h3>Việc cần ưu tiên</h3></div><span class='td-count'>${pendingAsg+pendingQuiz}</span></header>
        <p class='td-panel-note'>Bài tập chờ chấm và lượt kiểm tra cần đánh giá.</p>${actionRows}${quizRow}${!actionRows&&!quizRow?`<div class='td-empty'>Không có bài nộp nào đang chờ chấm.</div>`:''}
      </section>
      <section class='panel td-panel td-insights'><header class='td-section-head'><div><span class='td-eyebrow'>TEACHING INSIGHTS</span><h3>Học sinh cần đồng hành</h3></div><button class='btn light mini' onclick="setPage('gaps')">Mở phân tích</button></header>
        ${helpRows||`<div class='td-empty'>Chưa ghi nhận mục tiêu nào đang cần củng cố.</div>`}
        ${classMastery==null?`<p class='td-panel-note'>Lớp sẽ có phân tích tiến bộ khi ghi nhận thêm kết quả học tập.</p>`:`<div class='td-class-progress'><span>Mức nắm vững của lớp</span><b>${classMastery}%</b><span class='td-chart-track'><i style='width:${classMastery}%'></i></span></div>`}
      </section>
      <section class='panel td-panel td-deadlines'><header class='td-section-head'><div><span class='td-eyebrow'>7 NGÀY TỚI</span><h3>Hạn nộp sắp đến</h3></div><button class='btn light mini' onclick="setPage('calendar')">Lịch</button></header>
        ${dueSoon||`<div class='td-empty'>Không có hạn nộp nào trong 7 ngày tới.</div>`}
      </section>
      <section class='panel td-panel td-recent'><header class='td-section-head'><div><span class='td-eyebrow'>RECENT ACTIVITY</span><h3>Hoạt động gần đây</h3></div></header>
        ${recent||`<div class='td-empty'>Chưa có hoạt động học tập được ghi nhận.</div>`}
      </section>
      <section class='td-ai-card'><span class='td-ai-icon'>${ic('spark',18)}</span><span><b>EducMind AI</b><small>Khởi tạo câu hỏi từ mục tiêu học tập, giáo viên duyệt trước khi sử dụng.</small></span><button class='btn light mini' onclick="setPage('questions')">Khám phá AI</button></section>
    </div>
  </div>`;
}
