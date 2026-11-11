/* EducMind · js/21-quiz-attempts.js
   Lượt làm bài kiểm tra: chấm tự động, nộp bài, trang làm bài và kết quả của học sinh. */
/* --- Chấm và hoàn tất lượt làm (US-S03, US-T15) --- */
function autoScore(q,w,a){
  if(!isObj(q))return null;if(a==null)return 0;
  if(q.type==='MULTIPLE_CHOICE')return [...a].sort().join()===[...q.ans].sort().join()?w:0;
  return a===q.ans?w:0;
}
function completeAttempt(c,s,att){
  const Q=c.quiz.qs,mx=qMax(c);
  att.status='GRADED';att.total=Q.reduce((n,x)=>n+(att.sc[x.qid]||0),0);att.ratio=att.total/mx;
  const g=s.atts.filter(x=>x.status==='GRADED');s.att.last=g[g.length-1].ratio;s.att.best=Math.max(...g.map(x=>x.ratio));
  const others=g.filter(x=>x!==att&&!x.seed).map(x=>x.ratio),top=Math.max(-1,...others),before=s.mastery.slice(),al={};
  Q.forEach(x=>{const q=qOf(c,x.qid);q.objs.forEach(j=>{const a=al[j]||(al[j]=[0,0]);a[0]+=(att.sc[x.qid]||0)/q.objs.length;a[1]+=x.w/q.objs.length})});
  if(att.ratio>=top)Object.keys(al).forEach(k=>{const j=+k,sc=al[k][0]/al[k][1],e=s.ev[j].find(x=>x.key==='Q');if(e){e.s=sc;e.day=today}else s.ev[j].push({s:sc,day:today,src:'Bài tập',key:'Q'});recalcPair(s,j)});
  recalcClass(c);
  LOG.unshift('Bài tập: lượt '+att.n+' của '+s.name+' ('+c.id+') đã chấm xong, '+att.total.toFixed(1)+'/'+mx+'; mức nắm vững '+Object.keys(al).map(k=>pct(before[k])+'%→'+pct(s.mastery[k])+'%').join(', '));
}
function submitAttempt(c,s){
  const att=s.att.cur;att.status='SUBMITTED';att.at=stamp();att.sc={};att.fb={};
  c.quiz.qs.forEach(x=>{att.sc[x.qid]=autoScore(qOf(c,x.qid),x.w,att.ans[x.qid])});
  s.att.cur=null;
  if(c.quiz.qs.every(x=>att.sc[x.qid]!=null))completeAttempt(c,s,att);
  return att;
}
/* --- Học sinh làm bài --- */
function startQuiz(){
  const c=selected(),s=me(),q=c.quiz;
  if(!s.att.cur){
    if(q.deleted||q.status!=='Đã xuất bản'||!scopeLive(c,q)){toast('Bài tập chưa mở.');return}
    if(!qWindow(c)){toast('Chưa đến hoặc đã quá thời gian làm bài.');return}
    if(s.att.used>=c.maxAtt){toast('Em đã dùng hết số lần làm.');return}
    const t=simNow(),att={n:s.atts.length+1,status:'IN_PROGRESS',ans:{},presentation:q.gameMode||'classic',gameIndex:0,start:t,end:Math.min(t+q.dur*60000,dmy(q.close,23,59))};
    s.atts.push(att);s.att.used++;s.att.cur=att;
  }
  taking=true;render();
}
function setAns(qi,v){const s=me();s.att.cur.ans[selected().quiz.qs[qi].qid]=v}
function togAns(qi,oi,on){const s=me(),id=selected().quiz.qs[qi].qid,r=s.att.cur.ans[id]||[];s.att.cur.ans[id]=on?[...r,oi]:r.filter(x=>x!==oi)}
function finishQuiz(){
  const c=selected(),s=me(),recKeys=recKeysForTarget(c,s,'assessment'),att=submitAttempt(c,s);markRecKeys(s,recKeys,'assessment-completed');taking=false;render();
  toast(att.status==='GRADED'?'Đã nộp bài. Điểm lượt này: '+att.total.toFixed(1)+'/'+qMax(c)+'.':'Đã nộp bài. Còn câu chờ giáo viên chấm.');
}
function sQuiz(){
  const c=selected(),s=me(),q=c.quiz,a=s.att;
  if(q.deleted||q.status!=='Đã xuất bản'||!scopeLive(c,q))return `<section class='panel'><h2>Bài kiểm tra</h2><div class='empty'>Hiện chưa có bài kiểm tra nào đang mở.</div></section>`;
  if(a.cur&&simNow()>a.cur.end){submitAttempt(c,s);taking=false;toast('Hết hạn của lượt làm: hệ thống đã tự nộp các câu đã lưu.')}
  if(a.cur&&taking){
    if((a.cur.presentation||q.gameMode)==='race')return quizRaceHtml(c,q,a.cur);
    const inp=(x,qi)=>{const qq=qOf(c,x.qid),v=a.cur.ans[x.qid];
      if(qq.type==='MULTIPLE_CHOICE')return qq.opts.map((o,oi)=>`<label style='display:block;padding:3px 0'><input type='checkbox' ${(v||[]).includes(oi)?'checked':''} onchange='togAns(${qi},${oi},this.checked)'> ${esc(o)}</label>`).join('');
      if(qq.type==='SHORT_ANSWER')return `<input style='width:100%' value='${esc(v||'')}' oninput='setAns(${qi},this.value)' aria-label='Câu trả lời'>`;
      if(qq.type==='ESSAY')return `<textarea rows='5' style='width:100%' oninput='setAns(${qi},this.value)' aria-label='Câu trả lời'>${esc(v||'')}</textarea>`;
      return qq.opts.map((o,oi)=>`<label style='display:block;padding:3px 0'><input type='radio' name='q${qi}' ${v===oi?'checked':''} onchange='setAns(${qi},${oi})'> ${esc(o)}</label>`).join('')};
    return `<section class='panel'><h2>${esc(q.name)}</h2><p class='lead'>Lượt ${a.cur.n}/${c.maxAtt} · ${q.dur} phút. Câu trả lời được lưu ngay khi chọn; nếu thoát, em quay lại làm tiếp mà không tốn thêm lượt. Hết thời gian, hệ thống tự nộp các câu đã lưu.</p>${cdHtml(a)}${q.qs.map((x,qi)=>`<fieldset class='item' style='display:block;border-left:0;border-right:0;border-bottom:0;padding:12px 0'><legend><b>Câu ${qi+1} (${x.w} điểm).</b> ${esc(qOf(c,x.qid).content)}</legend>${inp(x,qi)}</fieldset>`).join('')}<div class='row'><button class='btn' onclick='finishQuiz()'>Nộp bài</button><button class='btn light' onclick='taking=false;render()'>Tạm dừng</button></div>${clockTool()}</section>`;
  }
  const o=offOf(c,s),pend=s.atts.filter(t=>t.status==='SUBMITTED').length;
  return `<section class='panel' id='qz' tabindex='-1' aria-labelledby='h-sq'><h2 id='h-sq'>${esc(q.name)}</h2><p class='lead'>${q.dur} phút · tối đa ${c.maxAtt} lượt · mở ${q.open} đến ${q.close} · phạm vi: ${esc(scopeLbl(c,q.scope))} · em đã dùng ${a.used}/${c.maxAtt} lượt.</p>${o!=null?`<p style='margin:0 0 6px'>Điểm chính thức (lượt cao nhất): <b>${o.toFixed(1)}/${qMax(c)}</b></p>`:''}${pend?`<p class='muted' style='margin:0 0 10px'>${pend} lượt đang chờ giáo viên chấm.</p>`:''}<div class='row'>${a.cur?`<button class='btn' onclick='startQuiz()'>Tiếp tục làm bài (không tốn thêm lượt)</button>`:!qWindow(c)?`<span class='muted'>Hiện ngoài thời gian làm bài.</span>`:a.used<c.maxAtt?`<button class='btn' onclick='startQuiz()'>Bắt đầu làm bài</button>`:`<span class='muted'>Em đã dùng hết số lần làm.</span>`}</div>${clockTool()}</section>`;
}
function quizResultsHtml(){
  const c=selected(),s=me(),mx=qMax(c),o=offOf(c,s);
  if(!s.atts.length)return `<section class='panel'><h2>Kết quả bài kiểm tra</h2><p class='muted' style='margin:0'>Em chưa làm bài kiểm tra nào.</p></section>`;
  return `<section class='panel'><h2>Kết quả bài kiểm tra</h2><p class='lead'>${esc(c.quiz.name)}${c.quiz.deleted?' (đã xóa · chỉ đọc)':''}. Điểm chính thức là lượt cao nhất: <b>${o==null?'chưa có':o.toFixed(1)+'/'+mx}</b></p>${s.atts.map(t=>`<details class='item' style='display:block'><summary><b>Lượt ${t.n}</b> · ${t.status==='GRADED'?'Điểm '+t.total.toFixed(1)+'/'+mx:t.status==='SUBMITTED'?'Chờ chấm: còn '+c.quiz.qs.filter(x=>t.sc[x.qid]==null).length+' câu':'Đang làm'}${o!=null&&t.status==='GRADED'&&t.total===o?' · lượt cao nhất':''}</summary>${t.status==='GRADED'&&!t.seed?c.quiz.qs.map((x,i)=>`<div style='padding:3px 0'>Câu ${i+1}: <b>${t.sc[x.qid]}/${x.w}</b>${t.fb[x.qid]?' · Nhận xét: '+esc(t.fb[x.qid]):''}</div>`).join(''):`<p class='muted' style='margin:6px 0 0'>${t.seed?'Dữ liệu minh họa, không có chi tiết từng câu.':'Chi tiết từng câu hiện sau khi lượt được chấm xong.'}</p>`}</details>`).join('')}</section>`;
}
function sResults(){const h=sResultsA(),i=h.indexOf("<section class='panel'><h2>Kết quả bài kiểm tra</h2>");return (i>0?h.slice(0,i):h)+quizResultsHtml()}
