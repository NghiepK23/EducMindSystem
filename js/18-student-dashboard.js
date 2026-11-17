/* EducMind · js/18-student-dashboard.js
   Trang Tổng quan của học sinh. */
function studentDashOpenAssignment(i){page='assignments';focusId='as-'+i;render();requestAnimationFrame(()=>document.getElementById('as-'+i)?.scrollIntoView({block:'center',behavior:'smooth'}))}
function studentDashOpenGoal(j){page='mastery';focusId='mastery-goal-'+j;render();requestAnimationFrame(()=>document.getElementById('mastery-goal-'+j)?.scrollIntoView({block:'center',behavior:'smooth'}))}
function studentMasteryDonut(counts,total){
  if(!total)return `<div class='sd-chart-empty'><span>${ic('target',20)}</span><b>Chưa có mục tiêu học tập</b><small>Kết quả sẽ xuất hiện khi lớp công bố mục tiêu.</small></div>`;
  const parts=[['good','Đã vững',counts.good,'var(--good-bar)'],['progress','Đang tiến bộ',counts.progress,'var(--prog-bar)'],['need','Cần củng cố',counts.need,'var(--need-bar)'],['unknown','Chưa có dữ liệu',counts.unknown,'var(--track)']];
  let at=0;
  const stops=parts.map(([, ,count,color])=>{const start=at/total*360;at+=count;return `${color} ${start}deg ${at/total*360}deg`}).join(',');
  const known=counts.good+counts.progress+counts.need;
  const label=parts.map(([,name,count])=>`${name}: ${count}`).join(', ');
  return `<div class='sd-mastery-summary'>
    <div class='sd-mastery-donut' style='background:conic-gradient(${stops})' role='img' aria-label='Phân bố ${total} mục tiêu học tập: ${esc(label)}'><div><b>${known}/${total}</b><small>có kết quả</small></div></div>
    <div class='sd-mastery-legend'>${parts.map(([tone,name,count])=>`<div><i class='is-${tone}'></i><span>${name}</span><b>${count}</b><small>${Math.round(count/total*100)}%</small></div>`).join('')}</div>
  </div>`;
}
function studentLearningChart(data,label,emptyMessage){
  const points=data.map((point)=>({label:point.label,value:Number.isFinite(point.value)?Math.max(0,Math.min(100,point.value)):null}));
  if(!points.some((point)=>point.value!=null))return `<div class='sd-chart-empty'><span>${ic('trend',20)}</span><b>${esc(emptyMessage)}</b><small>Điểm sẽ xuất hiện sau khi có kết quả được ghi nhận.</small></div>`;
  const left=42,right=660,top=18,bottom=178,height=bottom-top;
  const x=(index)=>left+index*(right-left)/Math.max(1,points.length-1),y=(value)=>bottom-value*height/100;
  const observed=points.map((point,index)=>point.value==null?null:{x:x(index),y:y(point.value),...point}).filter(Boolean);
  const path=observed.map((point,index)=>{const px=point.x.toFixed(1),py=point.y.toFixed(1);if(!index)return `M${px} ${py}`;const prev=observed[index-1],mid=((prev.x+point.x)/2).toFixed(1);return `C${mid} ${prev.y.toFixed(1)} ${mid} ${py} ${px} ${py}`}).join(' ');
  const areas=observed.length>1?`<path class='sd-chart-area' d='${path} L${observed[observed.length-1].x} ${bottom} L${observed[0].x} ${bottom} Z'/>`:'';
  const lines=observed.length>1?`<path class='sd-chart-line' d='${path}'/>`:'';
  const markers=observed.map((point)=>`<circle class='sd-chart-point' cx='${point.x}' cy='${point.y}' r='4'><title>${esc(label)} · ${esc(point.label)}: ${Math.round(point.value)}%</title></circle>`).join('');
  const grid=[0,25,50,75,100].map((value)=>{const yy=y(value);return `<line class='sd-chart-grid-line' x1='${left}' y1='${yy}' x2='${right}' y2='${yy}'/><text class='sd-chart-axis-label' x='${left-9}' y='${yy+4}' text-anchor='end'>${value}</text>`}).join('');
  const dayLabels=points.map((point,index)=>`<text class='sd-chart-axis-label' x='${x(index)}' y='207' text-anchor='middle'>${esc(point.label)}</text>`).join('');
  const summary=points.map((point)=>`${point.label} ${point.value==null?'chưa có điểm':Math.round(point.value)+'%'}`).join('; ');
  return `<svg class='sd-learning-chart' viewBox='0 0 680 220' role='img' aria-label='${esc(`${label} trong 7 ngày qua: ${summary}`)}'>
    <defs><linearGradient id='sd-learning-area' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#9862ff' stop-opacity='.34'/><stop offset='1' stop-color='#9862ff' stop-opacity='0'/></linearGradient></defs>
    ${grid}${areas}${lines}${markers}${dayLabels}
  </svg>`;
}
function sDashboard(){
  const c=selected(),s=me();
  if(!s)return `<section class='panel'><h2>Tổng quan học tập</h2><div class='empty'>Chưa tìm thấy hồ sơ học sinh trong lớp đang chọn.</div></section>`;
  const si=c.students.indexOf(s),goalIds=goalsIn(c),goalRows=goalIds.map(j=>({j,m:s.mastery[j],events:(s.ev[j]||[])}));
  const measured=goalRows.filter(x=>x.m!=null),openGaps=goalRows.filter(x=>s.gaps[x.j]&&s.gaps[x.j].status==='OPEN');
  const counts={good:measured.filter(x=>x.m>=.7).length,progress:measured.filter(x=>x.m>=.4&&x.m<.7).length,review:measured.filter(x=>x.m<.4).length};
  const chartDays=Array.from({length:7},(_,i)=>today-6+i),scoresByDay=new Map(chartDays.map(day=>[day,[]]));
  goalRows.forEach(({events})=>events.forEach(e=>{if(scoresByDay.has(e.day)&&Number.isFinite(e.s))scoresByDay.get(e.day).push(e.s*100)}));
  const chartLabels=chartDays.map(day=>{const d=new Date(simNow()-(today-day)*864e5);return ['CN','T2','T3','T4','T5','T6','T7'][d.getDay()]});
  const progressChart=studentLearningChart(chartDays.map((day,i)=>{const scores=scoresByDay.get(day);return{label:chartLabels[i],value:scores.length?mean(scores):null}}),'Điểm bằng chứng học tập','Chưa có bằng chứng trong 7 ngày qua');
  const masteryChart=studentMasteryDonut({good:counts.good,progress:counts.progress,need:counts.review,unknown:goalIds.length-measured.length},goalIds.length);
  const published=c.assignments.map((a,i)=>({a,i,b:(a.subs||[])[si]||{has:false,score:null}})).filter(x=>x.a.status==='Đã xuất bản'&&scopeLive(c,x.a)&&!pAsgBlock(c,s,x.a));
  const todo=published.filter(x=>!x.b.has&&inWin(x.a)).sort((x,y)=>dueMs(x.a)-dueMs(y.a));
  const late=published.filter(x=>!x.b.has&&!inWin(x.a));
  const waiting=published.filter(x=>x.b.has&&x.b.score==null);
  const graded=published.filter(x=>x.b.has&&x.b.score!=null);
  const quizVisible=!c.quiz.deleted&&scopeLive(c,c.quiz),quizOpen=quizVisible&&qWindow(c),quizPending=s.atts.filter(x=>x.status==='SUBMITTED').length;
  const assignedTotal=published.length+(quizVisible?1:0),completedTotal=graded.length+waiting.length+(quizVisible&&s.att.used?1:0);
  const scoreValues=graded.map(x=>Number(x.b.score)/Math.max(1,Number(x.a.max))).filter(Number.isFinite);
  if(quizVisible&&s.att.used&&Number.isFinite(s.att.best))scoreValues.push(s.att.best);
  const averageScore=scoreValues.length?Math.round(mean(scoreValues)*100):null;
  const completionPercent=assignedTotal?Math.min(100,Math.round(completedTotal/assignedTotal*100)):null;
  const lastDay=lastEv(s),daysAgo=lastDay<0?null:Math.max(0,today-lastDay);
  const recent=goalRows.flatMap(x=>x.events.map(e=>({j:x.j,e}))).sort((a,b)=>(b.e.day||0)-(a.e.day||0)).slice(0,4);
  const recs=activeRecs(c,s).slice(0,3);
  const next=todo.length?`<button class='btn' data-noicon='1' onclick="setPage('assignments')">Làm bài tập tiếp theo ${ic('arrow',16)}</button>`:quizOpen&&s.att.cur?`<button class='btn' data-noicon='1' onclick="setPage('assessments')">Tiếp tục bài kiểm tra ${ic('arrow',16)}</button>`:openGaps.length?`<button class='btn' data-noicon='1' onclick="setPage('gaps')">Ôn mục tiêu cần củng cố ${ic('arrow',16)}</button>`:recs.length?`<button class='btn' data-noicon='1' onclick="setPage('recommend')">Theo gợi ý cá nhân ${ic('arrow',16)}</button>`:`<button class='btn' data-noicon='1' onclick="setPage('lessons')">Tiếp tục bài học ${ic('arrow',16)}</button>`;
  const taskRows=todo.slice(0,4).map(({a,i})=>`<button type='button' class='sd-task' aria-label='Mở bài tập ${esc(a.name)}' onclick="studentDashOpenAssignment(${i})"><span class='sd-task-icon'>${ic('assignments',18)}</span><span><b>${esc(a.name)}</b><small>${esc(a.due?'Hạn nộp '+a.due:'Chưa có hạn nộp')} · ${esc(scopeLbl(c,a.scope))}</small></span></button>`).join('');
  const recentRows=recent.map(({j,e})=>{const ago=Math.max(0,today-(e.day==null?today:e.day));return `<button type='button' class='sd-recent-row' aria-label='Kết quả mục tiêu ${esc(gl(c,j))}' onclick="setPage('results')"><span class='sd-recent-icon ${tier(e.s)}'>${ic('trend',16)}</span><span><b>${esc(gl(c,j))}</b><small>${esc(e.src||'Hoạt động học tập')} · ${ago===0?'Hôm nay':ago===1?'Hôm qua':ago+' ngày trước'}</small></span><span class='pill ${tier(e.s)}'>${TIER[tier(e.s)].label}</span></button>`}).join('');
  const gapRows=openGaps.slice(0,3).map(({j,m})=>`<button type='button' class='sd-gap-row' aria-label='Ôn mục tiêu ${esc(gl(c,j))}' onclick="openGapTarget(${j},'lesson')"><span><b>${esc(gl(c,j))}</b><small>${esc((lessonOf(c,j)||{}).name||'Mục tiêu học tập')} · ${m==null?'Chưa đủ dữ liệu':TIER[tier(m)].label}</small></span></button>`).join('');
  const recRows=recs.map((r,i)=>`<button type='button' class='sd-rec-row' aria-label='Bắt đầu gợi ý ${esc(r[0])}: ${esc(r[2])}' onclick="recAct(${i},true)"><span><span class='pill ${r[1]}'>${esc(r[0])}</span><b>${esc(r[2])}</b><small>${esc(SR[r[0]]||'Gợi ý được tạo từ tiến độ của em.')}</small></span></button>`).join('');
  const quizCard=quizVisible?`<section class='panel sd-quiz-card' role='link' tabindex='0' aria-label='Mở bài kiểm tra ${esc(c.quiz.name)}' onclick="setPage('assessments')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setPage('assessments')}"><div><span class='sd-eyebrow'>BÀI KIỂM TRA CỦA EM</span><h3>${esc(c.quiz.name)}</h3><p>${s.att.cur?'Em đang có một lượt làm dở. Câu trả lời đã lưu.':quizOpen?'Bài đang mở · '+Math.max(0,c.maxAtt-s.att.used)+' lượt còn lại.':quizPending?quizPending+' lượt đang chờ giáo viên chấm.':s.att.used?'Em đã làm '+s.att.used+'/'+c.maxAtt+' lượt.':'Bài hiện chưa mở.'}</p></div></section>`:'';
  return `<div class='student-dashboard'>
    <section class='panel sd-welcome'><div class='sd-welcome-copy'><span class='sd-eyebrow'>TỔNG QUAN CỦA RIÊNG EM · ${esc(c.id)}</span><h2>Chào ${esc(s.name||sess.email)}!</h2><p>${esc(c.topic||'Môn học Tin học')} · Đây là tiến độ và các bước tiếp theo dựa trên bài học, bài nộp và mục tiêu của em.</p>${next}</div><span class='sd-welcome-art' aria-hidden='true'><img src='assets/student-characters.png' alt=''></span></section>
    <section class='sd-metrics' aria-label='Tóm tắt tiến độ cá nhân'>
      <article class='sd-metric'><span class='sd-metric-icon'>${ic('check',18)}</span><b>${completedTotal}<small> / ${assignedTotal}</small></b><span>Bài đã hoàn thành</span>${completionPercent==null?'':`<span class='sd-metric-progress' role='progressbar' aria-label='Tỷ lệ hoàn thành' aria-valuemin='0' aria-valuemax='100' aria-valuenow='${completionPercent}'><i style='width:${completionPercent}%'></i></span>`}</article>
      <article class='sd-metric'><span class='sd-metric-icon is-good'>${ic('trend',18)}</span><b>${averageScore==null?'—':averageScore+'%'}</b><span>${averageScore==null?'Chưa có điểm đã chấm':'Điểm trung bình bài đã chấm'}</span></article>
      <article class='sd-metric'><span class='sd-metric-icon is-violet'>${ic('classes',18)}</span><b>—</b><span>Thứ hạng chưa có dữ liệu</span></article>
      <article class='sd-metric'><span class='sd-metric-icon is-cyan'>${ic('clock',18)}</span><b>—</b><span>Chưa có dữ liệu thời gian học</span></article>
    </section>
    <div class='sd-dashboard-grid'>
      <section class='panel sd-progress'><div class='sd-section-head'><div><span class='sd-eyebrow'>TIẾN ĐỘ CÁ NHÂN</span><h3>Tiến độ học tập</h3></div><span class='sd-chart-period'>7 ngày</span></div>
        <div class='sd-chart-legend'><span><i></i>Điểm bằng chứng học tập</span></div>${progressChart}
        ${goalIds.length?`<div class='sd-goal-breakdown'><div class='sd-subsection-title'>Mức nắm vững theo mục tiêu</div><div class='sd-progress-summary'><span>${counts.review} cần ôn</span><span>${counts.progress} đang tiến bộ</span><span>${counts.good} đã vững</span></div><div class='sd-goal-list'>${goalRows.slice(0,5).map(({j,m})=>`<button type='button' class='sd-goal-row' aria-label='Mở tiến độ mục tiêu ${esc(gl(c,j))}: ${m==null?'chưa có dữ liệu':TIER[tier(m)].label+' '+pct(m)+'%'}' onclick="studentDashOpenGoal(${j})"><span class='sd-goal-dot ${m==null?'':tier(m)}'></span><span class='sd-goal-copy'><b>${esc(gl(c,j))}</b>${m==null?'':`<span class='sd-goal-track' aria-hidden='true'><i class='${tier(m)}' style='width:${pct(m)}%'></i></span>`}</span><span class='sd-goal-meta'><span class='pill ${m==null?'plain':tier(m)}'>${m==null?'Chưa có dữ liệu':TIER[tier(m)].label}</span><b class='sd-goal-percent'>${m==null?'—':pct(m)+'%'}</b></span></button>`).join('')}</div></div>`:`<div class='empty'>Chưa có mục tiêu nào được công bố trong lớp.</div>`}
      </section>
      <section class='panel sd-activity'><div class='sd-section-head'><div><span class='sd-eyebrow'>DẤU MỐC GẦN ĐÂY</span><h3>Hoạt động học tập</h3></div></div>
        ${recentRows||`<div class='sd-empty'>Chưa có bằng chứng học tập nào. Bắt đầu một bài học hoặc hoàn thành bài tập để hệ thống theo dõi tiến độ riêng của em.</div>`}<div class='sd-activity-foot'>${graded.length} bài đã được chấm${waiting.length?' · '+waiting.length+' bài chờ phản hồi':''} · ${daysAgo==null?'Chưa có hoạt động ghi nhận':daysAgo===0?'Hoạt động mới nhất hôm nay':daysAgo===1?'Hoạt động mới nhất hôm qua':'Hoạt động mới nhất '+daysAgo+' ngày trước'}</div>
      </section>
      <section class='panel sd-tasks'><div class='sd-section-head'><div><span class='sd-eyebrow'>ƯU TIÊN TIẾP THEO</span><h3>Việc em cần làm</h3></div></div>
        ${taskRows||late.length?taskRows+late.slice(0,2).map(({a,i})=>`<button type='button' class='sd-task is-late' aria-label='Mở bài tập quá hạn ${esc(a.name)}' onclick="studentDashOpenAssignment(${i})"><span class='sd-task-icon'>${ic('clock',18)}</span><span><b>${esc(a.name)}</b><small>Đã qua hạn nộp ${esc(a.due||'')}</small></span></button>`).join(''):`<div class='sd-empty'>${todo.length||late.length?'':'Hiện không có bài tập cần nộp. Hãy tiếp tục bài học hoặc xem gợi ý cá nhân.'}</div>`}
        ${quizCard}
      </section>
      <section class='panel sd-gaps'><div class='sd-section-head'><div><span class='sd-eyebrow'>CÁ NHÂN HÓA</span><h3>Điểm cần củng cố</h3></div></div>
        <div class='sd-subsection-title'>Mức nắm vững theo mục tiêu</div>${masteryChart}
        ${gapRows||`<div class='sd-empty'>Hiện chưa có mục tiêu nào được đánh dấu cần củng cố. Hệ thống sẽ cập nhật sau khi có thêm bài làm và bằng chứng học tập.</div>`}
        ${recRows?`<div class='sd-recommendations'><b>Gợi ý phù hợp với tiến độ</b>${recRows}</div>`:''}
      </section>
      <section class='panel sd-motivation'><div class='sd-section-head'><div><span class='sd-eyebrow'>MỤC TIÊU CỦA EM</span><h3>Mỗi bước tiến đều đáng ghi nhận</h3></div></div>
        <p>${measured.length?`Em đã có tiến độ ở ${measured.length} / ${goalIds.length} mục tiêu. Hãy tiếp tục với một hoạt động phù hợp nhé.`:'Bắt đầu một bài học hoặc bài tập để EducMind theo dõi tiến độ của em.'}</p>${next}
      </section>
    </div>
  </div>`;
}
