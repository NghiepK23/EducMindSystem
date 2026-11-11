/* EducMind · js/16-student-quiz.js
   Học sinh làm bài kiểm tra: lựa chọn đáp án, giao diện “đường đua”, bảng kết quả. */
/* S03: làm bài kiểm tra trực tuyến (câu hỏi mẫu sinh từ mục tiêu) */
const QOPT=['Mô tả đúng nội dung mục tiêu','Chỉ đúng một phần','Không liên quan đến mục tiêu'];
const qs=c=>c.qs||(c.qs=c.goals.map((g,j)=>({text:'Phát biểu nào đúng nhất về mục tiêu “'+g+'”?',ans:j%3,w:2,objs:[j]})).concat([{text:'Tình huống tổng hợp: vận dụng đồng thời hai mục tiêu đầu của lớp.',ans:1,w:2,objs:[0,1]}]));
const optsOf=q=>{const o=[];for(let k=0;k<3;k++)o[(k+q.ans)%3]=QOPT[k];return o};
function gradeAttempt(c,s){
  const cur=s.att.cur,Q=qs(c),al={};let tot=0,max=0;
  Q.forEach((q,qi)=>{const got=cur.a[qi]===q.ans?q.w:0;tot+=got;max+=q.w;q.objs.forEach(j=>{const x=al[j]||(al[j]=[0,0]);x[0]+=got/q.objs.length;x[1]+=q.w/q.objs.length})});
  const r=tot/max,before=s.mastery.slice();s.att.used++;s.att.last=r;s.att.cur=null;s.att.best=Math.max(s.att.best||0,r);
  if(s.att.real==null||r>s.att.real){s.att.real=r;Object.keys(al).forEach(k=>{const j=+k,sc=al[k][0]/al[k][1],e=s.ev[j].find(x=>x.key==='Q');if(e){e.s=sc;e.day=today}else s.ev[j].push({s:sc,day:today,src:'Bài tập',key:'Q'});recalcPair(s,j)})}
  recalcClass(c);
  LOG.unshift('Bài tập của '+s.name+' ('+c.id+') lượt '+s.att.used+': '+pct(r)+'%; mục tiêu: '+Object.keys(al).map(k=>pct(before[k])+'%→'+pct(s.mastery[k])+'%').join(', '));
  return r;
}
function raceTrackHtml(done,total,step){
  const pct=total?Math.round(done/total*100):0,pos=50-pct*.42,span=pct*.42;
  return `<div class='race-arena' role='img' aria-label='Tiến độ kéo co: đội em đã hoàn thành ${done} trên ${total} câu'>
    <div class='race-team-card race-home'><span class='race-team-emoji'>🧑‍🤝‍🧑</span><span class='race-team-name'>ĐỘI EM</span><b class='race-team-count' id='race-home-count'>${done}</b><small>câu đã kéo</small></div>
    <div class='race-tug-zone'><div class='race-road'><span class='race-center-mark'></span><span class='race-fill' id='race-fill' style='left:${pos}%;width:${span}%'></span><span class='race-runner' id='race-runner' style='left:${pos}%' aria-label='Nút dây'>🪢</span></div><div class='race-team-labels'><span>← Kéo về phía đội em</span><span>Đội thử thách →</span></div></div>
    <div class='race-team-card race-rival'><span class='race-team-emoji'>👾</span><span class='race-team-name'>ĐỘI THỬ THÁCH</span><b class='race-team-count' id='race-rival-count'>${total-done}</b><small>câu còn lại</small></div>
  </div><div class='race-track-meta'><span id='race-count'>Chặng ${Math.min(step+1,total)}/${total} · ${done}/${total} câu đã trả lời</span><b id='race-pct'>${pct}%</b></div>`;
}
function raceSync(done,total,step){
  const p=total?Math.round(done/total*100):0,pos=50-p*.42,span=p*.42,fill=document.getElementById('race-fill'),runner=document.getElementById('race-runner'),count=document.getElementById('race-count'),pct=document.getElementById('race-pct'),home=document.getElementById('race-home-count'),rival=document.getElementById('race-rival-count');
  if(fill){fill.style.left=pos+'%';fill.style.width=span+'%'}if(runner)runner.style.left=pos+'%';if(count)count.textContent='Chặng '+Math.min(step+1,total)+'/'+total+' · '+done+'/'+total+' câu đã trả lời';if(pct)pct.textContent=p+'%';if(home)home.textContent=done;if(rival)rival.textContent=Math.max(0,total-done);
}
function raceHint(type){return type==='MULTIPLE_CHOICE'?'Chọn tất cả phương án phù hợp':type==='SHORT_ANSWER'?'Nhập câu trả lời ngắn':type==='ESSAY'?'Viết câu trả lời của em':'Chạm vào một đáp án để chọn'}
function raceAnswerState(q,v){
  if(!q)return 'Hãy chọn câu trả lời để kéo dây.';
  if(q.type==='MULTIPLE_CHOICE'){const n=Array.isArray(v)?v.length:0;return n?n+' phương án đã chọn':'Chưa chọn phương án nào'}
  if(q.type==='SHORT_ANSWER'||q.type==='ESSAY')return String(v||'').trim()?'Đã nhập câu trả lời':'Chưa nhập câu trả lời';
  return v==null?'Chưa chọn đáp án':'Đã chọn một đáp án';
}
function raceSetStatus(text){const el=document.getElementById('race-answer-status');if(el)el.textContent=text}
function raceOptions(opts,value,multi,qi,handler,disabled){
  return `<div class='race-options'>${opts.map((o,oi)=>{const on=multi?(Array.isArray(value)&&value.includes(oi)):value===oi;return `<button type='button' class='race-choice ${on?'selected':''}' data-choice='${oi%4}' ${disabled?'disabled':''} aria-pressed='${on}' onclick='${handler}(${qi},${oi})'><span class='race-key'>${String.fromCharCode(65+oi)}</span><span class='race-option-text'>${esc(o)}</span><span class='race-check' aria-hidden='true'>${on?'✓':'+'}</span></button>`}).join('')}</div>`;
}
function quizRaceSet(qi,v){const s=me();setAns(qi,v);const c=selected(),Q=c.quiz.qs,done=Q.filter(x=>quizHasAnswer(qOf(c,x.qid),s.att.cur.ans[x.qid])).length;raceSync(done,Q.length,s.att.cur.gameIndex||0);raceSetStatus(raceAnswerState(qOf(c,Q[qi].qid),v))}
function quizRaceToggle(qi,oi){const s=me(),c=selected(),id=c.quiz.qs[qi].qid,r=s.att.cur.ans[id]||[];s.att.cur.ans[id]=r.includes(oi)?r.filter(x=>x!==oi):r.concat([oi]);render()}
function quizRaceChoose(qi,oi){quizRaceSet(qi,oi);render()}
function quizHasAnswer(q,v){if(!q)return false;if(q.type==='MULTIPLE_CHOICE')return Array.isArray(v)&&v.length>0;if(q.type==='SHORT_ANSWER'||q.type==='ESSAY')return typeof v==='string'&&v.trim()!=='';return v!==undefined&&v!==null}
function quizRaceMove(dir){const s=me(),c=selected(),att=s.att.cur,Q=c.quiz.qs;if(!att)return;const i=att.gameIndex||0;
  if(dir<0){att.gameIndex=Math.max(0,i-1);render();return}
  const q=qOf(c,Q[i].qid);if(!quizHasAnswer(q,att.ans[Q[i].qid])){toast('Hãy trả lời câu này trước khi tiếp tục.');return}
  if(i>=Q.length-1){finishQuiz();return}att.gameIndex=i+1;render();
}
function quizRaceHtml(c,q,att){
  const Q=q.qs,total=Q.length;if(!total)return `<section class='panel'><h2>${esc(q.name)}</h2><div class='empty'>Bài chưa có câu hỏi.</div></section>`;
  if(!Number.isInteger(att.gameIndex))att.gameIndex=0;att.gameIndex=Math.max(0,Math.min(total-1,att.gameIndex));
  const qi=att.gameIndex,x=Q[qi],qq=qOf(c,x.qid),v=att.ans[x.qid],done=Q.filter(y=>quizHasAnswer(qOf(c,y.qid),att.ans[y.qid])).length;
  let answer='';
  if(qq.type==='MULTIPLE_CHOICE')answer=raceOptions(qq.opts,v,true,qi,'quizRaceToggle',false);
  else if(qq.type==='SHORT_ANSWER')answer=`<input class='race-text' value='${esc(v||'')}' oninput='quizRaceSet(${qi},this.value)' aria-label='Câu trả lời'>`;
  else if(qq.type==='ESSAY')answer=`<textarea class='race-textarea' rows='5' oninput='quizRaceSet(${qi},this.value)' aria-label='Câu trả lời'>${esc(v||'')}</textarea>`;
  else answer=raceOptions(qq.opts,v,false,qi,'quizRaceChoose',false);
  return `<section class='panel race-game' aria-labelledby='race-title'><div class='race-banner'><div class='row between'><span class='race-tag'><span aria-hidden='true'>⚡</span> THỬ THÁCH · ${esc(q.name)}</span><div class='race-timer'>${cdHtml({cur:att})}</div></div><h2 id='race-title'><span aria-hidden='true'>🪢</span> Kéo co tri thức</h2><p>Mỗi câu đã trả lời kéo nút dây một nhịp về phía đội em. Hãy chinh phục đủ ${total} chặng để hoàn thành thử thách!</p>${raceTrackHtml(done,total,qi)}</div><div class='race-content'><div class='race-round-banner'><span class='race-round-number'>${String(qi+1).padStart(2,'0')}</span><span><b>CHẶNG ${qi+1} / ${total}</b><small>${x.w} điểm · ${raceHint(qq.type)}</small></span><span class='race-round-chip'>${done}/${total} xong</span></div><h3 class='race-question'>${esc(qq.content)}</h3>${answer}<div class='race-answer-status' id='race-answer-status' aria-live='polite'>${raceAnswerState(qq,v)}</div><div class='race-nav'><button class='btn light race-prev' type='button' data-noicon='1' aria-label='Câu trước' onclick='quizRaceMove(-1)' ${qi===0?'disabled':''}>${ic('arrowLeft',18)}<span>Câu trước</span></button><span class='muted'>Chọn đáp án rồi kéo tiếp</span><button class='btn race-next' type='button' data-noicon='1' aria-label='${qi===total-1?'Nộp bài':'Câu tiếp theo'}' onclick='quizRaceMove(1)'>${qi===total-1?'Chốt lượt · Nộp bài':'Kéo dây · Câu tiếp theo'}${ic('arrow',18)}</button></div>${clockTool()}</div></section>`;
}
/* S04: kết quả */
function sResultsA(){
  const c=selected(),s=me(),si=c.students.indexOf(s),a0=s.att,off=a0.best==null?a0.last:a0.best;
  const rows=c.assignments.map((a,i)=>({a,i,deleted:false})).filter(x=>x.a.status==='Đã xuất bản')
    .concat(c.trash.filter(t=>t.ref).map(t=>({a:t.ref,i:c.assignments.indexOf(t.ref),deleted:true})))
    .filter(x=>x.a.subs&&x.a.subs[si]&&x.a.subs[si].has);
  const resultCard=({a,i,deleted})=>{const b=a.subs[si],score=b.score!=null,wait=!score;
    return `<article class='student-task-card student-result-card ${score?'is-graded':'is-waiting'}' id='result-${i}' tabindex='-1'><div class='student-task-head'><div class='student-task-type-icon ${a.gameMode==='survival'?'is-survival':''}' aria-hidden='true'>${a.gameMode==='survival'?'🏝️':a.kind==='QUIZ'?'✎':'▤'}</div><div class='student-task-title'><div class='student-task-eyebrow'><span>${b.presentation==='survival'?'Sinh tồn tri thức':b.presentation==='race'?'Kéo co tri thức':b.presentation==='blitz'?'Combo chớp nhoáng':a.kind==='QUIZ'?'Ôn luyện câu hỏi':'Bài nộp'}</span><span class='pill ${deleted?'plain':score?'good':'prog'}'>${deleted?'Đã xóa · chỉ đọc':score?'Đã chấm':'Đang chờ chấm'}</span></div><h3>${esc(a.name)}</h3>${a.desc?`<p>${esc(a.desc)}</p>`:''}</div>${score?`<div class='student-task-score'><span>Kết quả</span><b>${esc(b.score)}<small> / ${esc(a.max)}</small></b></div>`:`<div class='student-result-pending'>Chờ chấm</div>`}</div><div class='student-task-meta'><span><b>${a.kind==='QUIZ'?(a.qs||[]).length+' câu hỏi':'Bài nộp'}</b></span><span>Đã nộp ${esc(b.status==='LATE'?'trễ':'đúng hạn')}</span><span>${pTriesOf(b)}/${pMax(a,b)} lượt đã dùng</span></div>${b.text||b.file?`<div class='student-task-submission'><span class='student-task-submission-label'>Bài nộp</span><span>${esc(b.text||'Đã gửi bài')}${b.file?' · '+esc(typeof b.file==='string'?b.file:b.file.name||'tệp đính kèm'):''}</span></div>`:''}${score&&b.fb?`<div class='student-task-feedback'><b>Nhận xét</b><span>${esc(b.fb)}</span></div>`:''}${score?rubricResultHtml(b):''}${pHist(a,b)}${qaView(b,false)}${!deleted&&score&&i>=0?`<div class='student-result-actions'>${pRedoBtn(c,s,a,i)}</div>`:''}</article>`;
  };
  return `<section class='panel student-results-page' aria-labelledby='h-sr'><header class='student-results-header'><div><span class='student-page-eyebrow'>${esc(c.id)} · ${esc(c.topic||'Lớp học')}</span><h2 id='h-sr'>Kết quả bài tập</h2><p>Điểm, nhận xét và bài làm đã nộp của em. Mở “Xem bài làm” để xem từng câu.</p></div><div class='student-assignment-summary' aria-label='Tóm tắt kết quả'><div><b>${rows.length}</b><span>Đã nộp</span></div><div><b>${rows.filter(x=>x.a.subs[si].score==null).length}</b><span>Chờ chấm</span></div><div><b>${rows.filter(x=>x.a.subs[si].score!=null).length}</b><span>Đã có điểm</span></div></div></header>${rows.length?`<div class='student-result-list'>${rows.map(resultCard).join('')}</div>`:`<div class='student-task-empty'><span aria-hidden='true'>📊</span><h3>Chưa có bài nộp</h3><p>Các bài em nộp và kết quả chấm sẽ xuất hiện tại đây.</p></div>`}</section><section class='panel'><h2>Kết quả bài kiểm tra</h2>${a0.used?`<p style='margin:0'>${esc(c.quiz.name)}${c.quiz.deleted?' (đã xóa · chỉ đọc)':''}: đã làm ${a0.used}/${c.maxAtt} lượt · lượt gần nhất <b>${pct(a0.last)}%</b> · điểm chính thức <b>${pct(off)}%</b> (lượt cao nhất)</p>`:`<p class='muted' style='margin:0'>Em chưa làm bài kiểm tra nào.</p>`}</section>`;
}
