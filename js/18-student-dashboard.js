/* EducMind · js/18-student-dashboard.js
   Trang Tổng quan của học sinh. */
function studentDashOpenAssignment(i){page='assignments';focusId='as-'+i;render();requestAnimationFrame(()=>document.getElementById('as-'+i)?.scrollIntoView({block:'center',behavior:'smooth'}))}
function studentDashOpenGoal(j){page='mastery';focusId='mastery-goal-'+j;render();requestAnimationFrame(()=>document.getElementById('mastery-goal-'+j)?.scrollIntoView({block:'center',behavior:'smooth'}))}
function sDashboard(){
  const c=selected(),s=me();
  if(!s)return `<section class='panel'><h2>Tổng quan học tập</h2><div class='empty'>Chưa tìm thấy hồ sơ học sinh trong lớp đang chọn.</div></section>`;
  const si=c.students.indexOf(s),goalIds=goalsIn(c),goalRows=goalIds.map(j=>({j,m:s.mastery[j],events:(s.ev[j]||[])}));
  const measured=goalRows.filter(x=>x.m!=null),openGaps=goalRows.filter(x=>s.gaps[x.j]&&s.gaps[x.j].status==='OPEN');
  const counts={good:measured.filter(x=>x.m>=.7).length,progress:measured.filter(x=>x.m>=.4&&x.m<.7).length,review:measured.filter(x=>x.m<.4).length};
  const published=c.assignments.map((a,i)=>({a,i,b:(a.subs||[])[si]||{has:false,score:null}})).filter(x=>x.a.status==='Đã xuất bản'&&scopeLive(c,x.a)&&!pAsgBlock(c,s,x.a));
  const todo=published.filter(x=>!x.b.has&&inWin(x.a)).sort((x,y)=>dueMs(x.a)-dueMs(y.a));
  const late=published.filter(x=>!x.b.has&&!inWin(x.a));
  const waiting=published.filter(x=>x.b.has&&x.b.score==null);
  const graded=published.filter(x=>x.b.has&&x.b.score!=null);
  const quizVisible=!c.quiz.deleted&&scopeLive(c,c.quiz),quizOpen=quizVisible&&qWindow(c),quizPending=s.atts.filter(x=>x.status==='SUBMITTED').length;
  const lastDay=lastEv(s),daysAgo=lastDay<0?null:Math.max(0,today-lastDay);
  const recent=goalRows.flatMap(x=>x.events.map(e=>({j:x.j,e}))).sort((a,b)=>(b.e.day||0)-(a.e.day||0)).slice(0,4);
  const recs=activeRecs(c,s).slice(0,3);
  const next=todo.length?`<button class='btn' data-noicon='1' onclick="setPage('assignments')">Làm bài tập tiếp theo ${ic('arrow',16)}</button>`:quizOpen&&s.att.cur?`<button class='btn' data-noicon='1' onclick="setPage('assessments')">Tiếp tục bài kiểm tra ${ic('arrow',16)}</button>`:openGaps.length?`<button class='btn' data-noicon='1' onclick="setPage('gaps')">Ôn mục tiêu cần củng cố ${ic('arrow',16)}</button>`:recs.length?`<button class='btn' data-noicon='1' onclick="setPage('recommend')">Theo gợi ý cá nhân ${ic('arrow',16)}</button>`:`<button class='btn' data-noicon='1' onclick="setPage('lessons')">Tiếp tục bài học ${ic('arrow',16)}</button>`;
  const taskRows=todo.slice(0,4).map(({a,i})=>`<button type='button' class='sd-task' aria-label='Mở bài tập ${esc(a.name)}' onclick="studentDashOpenAssignment(${i})"><span class='sd-task-icon'>${ic('assignments',18)}</span><span><b>${esc(a.name)}</b><small>${esc(a.due?'Hạn nộp '+a.due:'Chưa có hạn nộp')} · ${esc(scopeLbl(c,a.scope))}</small></span></button>`).join('');
  const recentRows=recent.map(({j,e})=>{const ago=Math.max(0,today-(e.day==null?today:e.day));return `<button type='button' class='sd-recent-row' aria-label='Kết quả mục tiêu ${esc(gl(c,j))}' onclick="setPage('results')"><span class='sd-recent-mark ${tier(e.s)}'></span><span><b>${esc(gl(c,j))}</b><small>${esc(e.src||'Hoạt động học tập')} · ${ago===0?'Hôm nay':ago===1?'Hôm qua':ago+' ngày trước'}</small></span><span class='pill ${tier(e.s)}'>${TIER[tier(e.s)].label}</span></button>`}).join('');
  const gapRows=openGaps.slice(0,3).map(({j,m})=>`<button type='button' class='sd-gap-row' aria-label='Ôn mục tiêu ${esc(gl(c,j))}' onclick="openGapTarget(${j},'lesson')"><span><b>${esc(gl(c,j))}</b><small>${esc((lessonOf(c,j)||{}).name||'Mục tiêu học tập')} · ${m==null?'Chưa đủ dữ liệu':TIER[tier(m)].label}</small></span></button>`).join('');
  const recRows=recs.map((r,i)=>`<button type='button' class='sd-rec-row' aria-label='Bắt đầu gợi ý ${esc(r[0])}: ${esc(r[2])}' onclick="recAct(${i},true)"><span><span class='pill ${r[1]}'>${esc(r[0])}</span><b>${esc(r[2])}</b><small>${esc(SR[r[0]]||'Gợi ý được tạo từ tiến độ của em.')}</small></span></button>`).join('');
  const quizCard=quizVisible?`<section class='panel sd-quiz-card' role='link' tabindex='0' aria-label='Mở bài kiểm tra ${esc(c.quiz.name)}' onclick="setPage('assessments')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setPage('assessments')}"><div><span class='sd-eyebrow'>BÀI KIỂM TRA CỦA EM</span><h3>${esc(c.quiz.name)}</h3><p>${s.att.cur?'Em đang có một lượt làm dở. Câu trả lời đã lưu.':quizOpen?'Bài đang mở · '+Math.max(0,c.maxAtt-s.att.used)+' lượt còn lại.':quizPending?quizPending+' lượt đang chờ giáo viên chấm.':s.att.used?'Em đã làm '+s.att.used+'/'+c.maxAtt+' lượt.':'Bài hiện chưa mở.'}</p></div></section>`:'';
  return `<div class='student-dashboard'>
    <section class='panel sd-welcome'><div><span class='sd-eyebrow'>TỔNG QUAN CỦA RIÊNG EM · ${esc(c.id)}</span><h2>Chào ${esc(s.name||sess.email)}!</h2><p>${esc(c.topic||'Môn học Tin học')} · Đây là tiến độ và các bước tiếp theo dựa trên bài học, bài nộp và mục tiêu của em.</p></div>${next}</section>
    <section class='sd-metrics' aria-label='Tóm tắt tiến độ cá nhân'>
      <article class='sd-metric'><span class='sd-metric-icon'>${ic('target',18)}</span><b>${measured.length}<small> / ${goalIds.length}</small></b><span>Mục tiêu đã có dữ liệu</span></article>
      <article class='sd-metric'><span class='sd-metric-icon is-warn'>${ic('alert',18)}</span><b>${openGaps.length}</b><span>Mục tiêu cần củng cố</span></article>
      <article class='sd-metric'><span class='sd-metric-icon'>${ic('assignments',18)}</span><b>${todo.length}</b><span>Bài tập cần hoàn thành</span></article>
      <article class='sd-metric'><span class='sd-metric-icon is-good'>${ic('check',18)}</span><b>${waiting.length+quizPending}</b><span>Bài đang chờ phản hồi</span></article>
    </section>
    <div class='sd-dashboard-grid'>
      <section class='panel sd-progress'><div class='sd-section-head'><div><span class='sd-eyebrow'>TIẾN ĐỘ CÁ NHÂN</span><h3>Mục tiêu học tập</h3></div></div>
        ${goalIds.length?`<div class='sd-progress-summary'><span>${counts.review} cần ôn</span><span>${counts.progress} đang tiến bộ</span><span>${counts.good} đã vững</span></div><div class='sd-goal-list'>${goalRows.slice(0,5).map(({j,m})=>`<button type='button' class='sd-goal-row' aria-label='Mở tiến độ mục tiêu ${esc(gl(c,j))}' onclick="studentDashOpenGoal(${j})"><span class='sd-goal-dot ${m==null?'':tier(m)}'></span><span><b>${esc(gl(c,j))}</b><small>${m==null?'Chưa có bằng chứng học tập':TIER[tier(m)].label}</small></span><span class='pill ${m==null?'plain':tier(m)}'>${m==null?'Chưa có dữ liệu':TIER[tier(m)].label}</span></button>`).join('')}</div>`:`<div class='empty'>Chưa có mục tiêu nào được công bố trong lớp.</div>`}
      </section>
      <section class='panel sd-tasks'><div class='sd-section-head'><div><span class='sd-eyebrow'>ƯU TIÊN TIẾP THEO</span><h3>Việc em cần làm</h3></div></div>
        ${taskRows||late.length?taskRows+late.slice(0,2).map(({a,i})=>`<button type='button' class='sd-task is-late' aria-label='Mở bài tập quá hạn ${esc(a.name)}' onclick="studentDashOpenAssignment(${i})"><span class='sd-task-icon'>${ic('clock',18)}</span><span><b>${esc(a.name)}</b><small>Đã qua hạn nộp ${esc(a.due||'')}</small></span></button>`).join(''):`<div class='sd-empty'>${todo.length||late.length?'':'Hiện không có bài tập cần nộp. Hãy tiếp tục bài học hoặc xem gợi ý cá nhân.'}</div>`}
        ${quizCard}
      </section>
      <section class='panel sd-activity'><div class='sd-section-head'><div><span class='sd-eyebrow'>DẤU MỐC GẦN ĐÂY</span><h3>Hoạt động học tập</h3></div></div>
        ${recentRows||`<div class='sd-empty'>Chưa có bằng chứng học tập nào. Bắt đầu một bài học hoặc hoàn thành bài tập để hệ thống theo dõi tiến độ riêng của em.</div>`}<div class='sd-activity-foot'>${graded.length} bài đã được chấm${waiting.length?' · '+waiting.length+' bài chờ phản hồi':''} · ${daysAgo==null?'Chưa có hoạt động ghi nhận':daysAgo===0?'Hoạt động mới nhất hôm nay':daysAgo===1?'Hoạt động mới nhất hôm qua':'Hoạt động mới nhất '+daysAgo+' ngày trước'}</div>
      </section>
      <section class='panel sd-gaps'><div class='sd-section-head'><div><span class='sd-eyebrow'>CÁ NHÂN HÓA</span><h3>Điểm cần củng cố</h3></div></div>
        ${gapRows||`<div class='sd-empty'>Hiện chưa có mục tiêu nào được đánh dấu cần củng cố. Hệ thống sẽ cập nhật sau khi có thêm bài làm và bằng chứng học tập.</div>`}
        ${recRows?`<div class='sd-recommendations'><b>Gợi ý phù hợp với tiến độ</b>${recRows}</div>`:''}
      </section>
    </div>
  </div>`;
}
