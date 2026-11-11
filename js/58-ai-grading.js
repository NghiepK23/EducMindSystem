/* EducMind · js/58-ai-grading.js
   AI chấm bài trước, giáo viên xác nhận; trung tâm AI gom mọi việc chờ xác nhận. */
/* ===== AI chấm bài trước, giáo viên xác nhận =====
   Luồng: học sinh nộp → AI tự chấm điểm từng câu + viết nhận xét → giáo viên chỉ
   xem lại, sửa nếu muốn rồi bấm “Xác nhận”. Điểm chỉ được ghi vào bằng chứng học tập
   sau khi giáo viên xác nhận; giáo viên vẫn có thể tự chấm tay nếu muốn. */

/* tách từ khóa có nghĩa từ một câu tiếng Việt */
function aiKeys(txt){
  return String(txt||'').toLowerCase()
    .replace(/[.,;:!?()"'“”‘’/\\\-–—]/g,' ')
    .split(/\s+/)
    .map(w=>w.replace(/^(và|của|các|những|một|cho|trong|được|là|với|khi|để|theo|từ|ra|vào|như|nhưng|hoặc|có|không)$/,''))
    .filter(w=>w.length>=4);
}
/* tỉ lệ khớp từ khóa giữa câu trả lời và mục tiêu mà câu hỏi đo */
function aiMatch(answer,goal){
  const ks=aiKeys(goal),txt=' '+String(answer||'').toLowerCase()+' ';
  if(!ks.length)return 0;
  const hit=ks.filter(k=>txt.indexOf(k)>=0).length;
  return hit/ks.length;
}
/* AI ước lượng điểm + nhận xét cho một câu trả lời tự luận / trả lời ngắn */
function aiAssessSubj(c,q,item,answer){
  const ans=String(answer||'').trim();
  const goalName=(q.objs||[]).map(j=>c.goals[j]).filter(Boolean).join('; ');
  if(!ans)return {got:0,fb:'Bỏ trống câu này.'+(goalName?' Cần trả lời nội dung: '+goalName+'.':'')};
  const m=aiMatch(ans,goalName),len=ans.length;
  let frac=0.3+0.45*m+0.25*Math.min(1,len/220);
  if(q.type==='SHORT_ANSWER')frac=Math.min(frac+0.05,1);
  frac=Math.max(0.15,Math.min(1,frac));
  const got=Math.max(0.5,Math.round(item.w*frac*2)/2);
  let fb;
  if(frac>=0.85)fb='Trả lời đúng trọng tâm'+(goalName?' (“'+goalName+'”)':'')+', diễn đạt rõ.';
  else if(frac>=0.6)fb='Đã nêu được ý chính'+(goalName?' của “'+goalName+'”':'')+', nên bổ sung ví dụ hoặc giải thích thêm.';
  else fb='Còn thiếu ý quan trọng'+(goalName?' so với “'+goalName+'”':'')+'; cần trình bày rõ hơn và thêm ví dụ.';
  if(len<40)fb+=' Câu trả lời còn ngắn.';
  return {got:Math.min(got,item.w),fb};
}
/* AI chấm một bài nộp: trả về điểm từng câu, điểm tổng và nhận xét tổng quát */
function aiReview(c,a,b){
  const per=[],isQ=asgIsQ(a);
  if(isQ){
    (b.qa||[]).forEach((x,i)=>{
      const q=qOf(c,(a.qs||[])[i]?(a.qs[i].qid):null)||{};
      const w=x.w||1,objs=x.objs||[];
      if(isObjT(x.t)){
        const bq=qOf(c,(a.qs||[])[i]?(a.qs[i].qid):null);
        const corr=bq?autoScore(bq,w,rdAnsVal(x,bq)):null;
        const full=corr!=null&&corr>=w;
        const right=bq?(bq.opts||[]).map((o,k)=>[].concat(bq.ans).includes(k)?o:null).filter(Boolean).join(', '):'';
        per.push({got:corr==null?0:corr,fb:full?'Chọn đúng đáp án.':('Chưa đúng'+(right?'; đáp án đúng: '+right:'')+'.')+(objs.length?' Ôn lại: '+objs.map(j=>c.goals[j]).join('; ')+'.':'')});
      }else{
        per.push(aiAssessSubj(c,{objs,type:x.t},x,x.a));
      }
    });
  }else{
    const goals=(a.objs||[]).map(j=>c.goals[j]).filter(Boolean).join('; ');
    const m=aiMatch(b.text||'',goals),len=String(b.text||'').length;
    let frac=0.35+0.45*m+0.2*Math.min(1,len/400);
    frac=Math.max(0.2,Math.min(1,frac));
    const sc=Math.round(a.max*frac*10)/10;
    const words=String(b.text||'').split(/\s+/).filter(Boolean).length;
    per.push({got:sc,fb:'Chấm theo yêu cầu đề bài'+(goals?' (“'+goals+'”)':'')+' · bài làm '+words+' từ'+(b.file?' · có tệp đính kèm':'')+'.'});
  }
  const tw=isQ?per.reduce((n,x,i)=>n+(b.qa[i]?.w||1),0):a.max;
  const tg=per.reduce((n,x)=>n+x.got,0);
  const score=isQ?Math.round(tg/Math.max(tw,1)*a.max*10)/10:tg;
  /* nhận xét tổng quát: điểm mạnh / cần cải thiện theo mục tiêu */
  const byGoal={};
  if(isQ)(b.qa||[]).forEach((x,i)=>{const p=per[i],w=x.w||1;(x.objs||[]).forEach(j=>{const e=byGoal[j]||(byGoal[j]=[0,0]);e[0]+=p.got/((x.objs||[]).length);e[1]+=w/((x.objs||[]).length)})});
  const rates=Object.keys(byGoal).map(j=>({j:+j,r:byGoal[j][0]/Math.max(byGoal[j][1],1)}));
  const strong=rates.filter(x=>x.r>=0.75).map(x=>c.goals[x.j]);
  const weak=rates.filter(x=>x.r<0.6).map(x=>c.goals[x.j]);
  const pctScore=Math.round(score/a.max*100);
  let fb=(pctScore>=85?'Bài làm tốt':pctScore>=60?'Bài làm đạt yêu cầu':'Bài làm còn yếu')+': '+score+'/'+a.max+' điểm ('+pctScore+'%).';
  if(strong.length)fb+=' Nắm chắc: '+strong.slice(0,2).join('; ')+'.';
  if(weak.length)fb+=' Cần cải thiện: '+weak.slice(0,2).join('; ')+'.';
  if(isQ){const blank=(b.qa||[]).filter(x=>!String(x.a||'').trim()).length;if(blank)fb+=' Còn '+blank+' câu bỏ trống.'}
  return {score,fb,per,at:stamp(),by:'AI'};
}
function rdAnsVal(item,bq){
  if(!bq)return null;
  const t=String(item.a==null?'':item.a).trim();
  if(!isObjT(bq.type))return t;
  const opts=bq.opts||[];
  if(bq.type==='MULTIPLE_CHOICE'){const arr=[];opts.forEach((o,k)=>{if(t.split(' · ').indexOf('✓ '+o)>=0||t.indexOf(o)>=0)arr.push(k)});return arr.length?arr:t}
  const k=opts.findIndex(o=>t.indexOf(o)>=0);
  return k>=0?k:t;
}
/* chạy AI cho một bài nộp */
function aiGradeOne(c,ai,si,silent){
  const a=c.assignments[ai],b=a.subs[si];
  if(!b||!b.has)return false;
  b.ai=aiReview(c,a,b);
  b.ai.at=stamp();
  if(!silent)toast('AI đã chấm và viết nhận xét cho '+c.students[si].name+'. Giáo viên xem lại rồi xác nhận.');
  return true;
}
/* chạy AI cho mọi bài đã nộp mà chưa xác nhận */
function aiGradeAll(c,ai){
  const a=c.assignments[ai];let n=0;
  a.subs.forEach((b,si)=>{if(b&&b.has&&b.score==null&&!b.ai){if(aiGradeOne(c,ai,si,true))n++}});
  render();
  toast(n?'AI đã chấm '+n+' bài và soạn nhận xét. Giáo viên xem lại rồi bấm “Xác nhận”.':'Không còn bài nào cần AI chấm.');
}
/* ghi kết quả đã xác nhận vào bài nộp + bằng chứng học tập */
function applyConfirm(c,ai,si,val){
  const a=c.assignments[ai],s=c.students[si],b=a.subs[si],isQ=asgIsQ(a);
  if(val.rubricScores)b.rubricScores=val.rubricScores;
  if(isQ){
    (b.qa||[]).forEach((x,i)=>{x.got=val.per[i]==null?x.got:val.per[i];if(val.pfb&&val.pfb[i]!=null)x.fb=val.pfb[i]});
    if(!asgFinal(c,ai,si)){
      const tw=(b.qa||[]).reduce((n,x)=>n+(x.w||1),0),tg=(b.qa||[]).reduce((n,x)=>n+(x.got||0),0);
      b.score=Math.round(tg/Math.max(tw,1)*a.max*10)/10;
    }
    if(val.score!=null)b.score=val.score;
    if(val.fb!=null)b.fb=val.fb;
  }else{
    const key='A'+a.aid,before=s.mastery.slice();
    b.score=val.score;b.fb=val.fb||'';
    (a.objs||[]).forEach(j=>{if(!s.ev[j])s.ev[j]=[];const r=b.score/a.max,x=s.ev[j].find(e=>e.key===key);
      if(x){x.s=r;x.day=today}else s.ev[j].push({s:r,day:today,src:'Bài tập',key});recalcPair(s,j)});
    LOG.unshift('Xác nhận điểm “'+a.name+'” cho '+s.name+' ('+c.id+'): '+((a.objs||[]).map(j=>c.goals[j]+' '+pct(before[j])+'%→'+pct(s.mastery[j])+'%').join('; ')||'không có mục tiêu gắn'));
  }
  b.gradeSource='AI';b.gradedBy=acctName();b.confirmedAt=stamp();
  recalcClass(c);a.graded=a.subs.filter(x=>x.score!=null).length;
}
/* hộp thoại xem lại kết quả AI rồi xác nhận */
/* ===== Một cửa duy nhất: AI tự động hoá 4–7 và chấm điểm/nhận xét, giáo viên xác nhận =====
   Gộp các nút AI rời (chấm bài, nháp nhận xét, chấp nhận điểm, phân tích lỗi, gợi ý cá nhân hoá)
   vào một khay “AI đã chuẩn bị”. Mọi kết quả ở trạng thái đề xuất cho tới khi giáo viên xác nhận. */
let AIB=null;
function aiPending(c){
  const a=c.assignments[AIB.idx];
  const out=[];
  if(!a)return out;
  a.subs.forEach((b,si)=>{
    if(!b||!b.has)return;
    if(b.score==null)out.push({t:'grade',si,name:c.students[si].name,label:'Chấm điểm & nhận xét',detail:b.ai?('AI đề xuất '+b.ai.score+'/'+a.max):'AI sẽ chấm ngay khi bạn mở'});
  });
  return out;
}
function aiCenterDlg(kind,idx){
  const c=selected();
  const a=c.assignments[idx];
  if(!a){toast('Không tìm thấy bài tập.');return}
  /* mở trung tâm là AI tự chạy cho mọi bài đã nộp mà chưa có đề xuất */
  let ran=0;
  a.subs.forEach((b,si)=>{if(b&&b.has&&b.score==null&&!b.ai){if(aiGradeOne(c,idx,si,true))ran++}});
  const pend=[];
  a.subs.forEach((b,si)=>{if(b&&b.has&&b.score==null)pend.push({si,name:c.students[si].name,b})});
  const rows=pend.length?pend.map(q=>`<div class='ai-card'><div class='ai-card-top'><b>${esc(q.name)}</b>${q.b.ai?`<span class='ai-sc'>AI đề xuất ${q.b.ai.score}/${a.max}</span>`:'<span class="pill need">chưa chấm</span>'}</div>${q.b.ai?`<div class='ai-fb'>${esc(q.b.ai.fb)}</div>`:''}<div class='row' style='justify-content:flex-end;margin-top:8px'><button class='btn mini' data-noicon='1' onclick='dlg=null;confirmDlg(${idx},${q.si})'>Xác nhận</button></div></div>`).join(''):`<div class='ai-card'><b>Tất cả bài đã nộp đều đã được giáo viên xác nhận.</b><div class='ai-fb'>AI không còn việc nào chờ duyệt cho bài này.</div></div>`;
  openDlg({title:'AI đã chuẩn bị · '+esc(a.name),okLabel:'Đóng',
    text:`<div class='ai-card' style='background:var(--brand-soft);color:var(--brand-ink)'><div class='ai-card-top'><b>Tự động hoá cho cả bài</b><span class='row' style='gap:6px'><button class='btn light mini' data-noicon='1' onclick='aiRunAll(${idx})'>Chạy lại AI</button><button class='btn mini' data-noicon='1' onclick='aiConfirmAll(${idx})'>Xác nhận tất cả (${pend.length})</button></span></div><div class='ai-fb' style='color:inherit'>AI chấm điểm, viết nhận xét, phân tích lỗi theo mục tiêu và soạn gợi ý cá nhân hoá. Kết quả chỉ vào điểm chính thức sau khi giáo viên xác nhận.</div></div>${rows}`,
    fields:[],ok:()=>null});
  if(ran)toast('AI đã chấm và soạn nhận xét cho '+ran+' bài. Xem lại rồi xác nhận.');
}
function aiConfirmAll(idx){
  const c=selected();
  /* giáo viên bấm một lần: đóng trung tâm, chốt toàn bộ đề xuất AI cho bài này */
  dlg=null;
  confirmAllAi(c,idx);
}
function aiRunAll(idx){
  const c=selected(),a=c.assignments[idx];if(!a)return;
  let n=0;a.subs.forEach((b,si)=>{if(b&&b.has&&b.score==null){if(!b.ai)aiGradeOne(c,idx,si,true);if(b.ai)n++}});
  render();if(dlg)aiCenterDlg('asg',idx);
  toast(n?'AI đã chấm và soạn nhận xét cho '+n+' bài. Xem lại rồi xác nhận.':'AI không có bài nào mới để chấm.');
}

function confirmDlg(ai,si){
  const c=selected(),a=c.assignments[ai],s=c.students[si],b=a.subs[si],isQ=asgIsQ(a),hasRubric=!isQ&&a.rubric&&a.rubric.length;
  if(!b||!b.has){toast('Học sinh này chưa nộp bài.');return}
  if(!b.ai)aiGradeOne(c,ai,si,true);
  const r=b.ai;
  const per=isQ?(b.qa||[]).map((x,i)=>{const p=(r.per||[])[i]||{got:0,fb:''};return `<div class='ai-row'><div><b>Câu ${i+1}</b> <span class='muted'>· ${x.w} điểm</span><div class='muted' style='margin-top:2px;font-size:.8125rem'>${esc(String(x.a||'(bỏ trống)').slice(0,140))}</div><div class='ai-fb'>${esc(p.fb)}</div></div><span class='ai-sc'>${p.got}/${x.w}</span></div>`}).join(''):'';
  const fields=isQ?[{k:'score',label:'Điểm (0–'+a.max+')',val:r.score},{k:'fb',label:'Nhận xét cho học sinh',val:r.fb||''}]:hasRubric?[...rubricGradeFields(a,b),{k:'fb',label:'Nhận xét chung cho học sinh',val:b.fb||r.fb||'',area:true}]:[{k:'score',label:'Điểm (0–'+a.max+')',val:r.score},{k:'fb',label:'Nhận xét cho học sinh',val:r.fb||''}];
  openDlg({title:'Xác nhận kết quả · '+s.name,
    text:`<div class='ai-box'><div class='row between' style='gap:8px;flex-wrap:wrap'><span>AI đề xuất</span><b>${r.score}/${a.max} điểm</b></div><div class='muted' style='margin-top:6px;font-size:.8125rem;font-weight:400'>${esc(r.fb)}</div></div>
${isQ?`<details class='ai-detail'><summary>Xem chi tiết từng câu (${(b.qa||[]).length} câu)</summary>${per}</details>`:''}${isQ?'':`<details class='ai-detail'><summary>Xem bài làm của học sinh</summary><div class='ai-work'>${esc(b.text||'(không có nội dung)')}${b.file?`<div class='muted' style='margin-top:8px'>Tệp đính kèm: ${esc(b.file.name)}</div>`:''}</div></details>`}
${hasRubric?`<div class='rubric-total-hint'>Dùng rubric để đánh giá từng tiêu chí. Điểm cuối cùng là tổng các tiêu chí (tối đa ${a.max}); điểm tổng AI chỉ là tham khảo.</div>`:`<div class='muted' style='margin-top:10px;font-size:.8125rem'>Sửa lại nếu cần rồi bấm “Xác nhận”. Chỉ sau khi xác nhận, điểm mới được ghi vào kết quả và bằng chứng học tập.</div>`}`,
    okLabel:'Xác nhận',fields,
    ok:v=>{
      if(isQ){
        const raw=String(v.score==null?'':v.score).trim().replace(',','.');const sc=parseFloat(raw);
        if(raw===''||isNaN(sc)||sc<0||sc>a.max)return 'Điểm phải từ 0 đến '+a.max+'.';
        const aiTot=r.per.reduce((n,x)=>n+(x.got||0),0)||1;const perScores=r.per.map(x=>Math.round((x.got||0)/aiTot*sc*100)/100);
        applyConfirm(c,ai,si,{per:perScores,pfb:r.per.map(x=>x.fb),fb:String(v.fb||'').trim(),score:sc});
      }else if(hasRubric){
        const parsed=rubricRead(v,a);if(parsed.error)return parsed.error;
        applyConfirm(c,ai,si,{score:parsed.total,fb:String(v.fb||'').trim(),rubricScores:parsed.scores});
      }else{
        const raw=String(v.score==null?'':v.score).trim().replace(',','.');const sc=parseFloat(raw);
        if(raw===''||isNaN(sc)||sc<0||sc>a.max)return 'Điểm phải từ 0 đến '+a.max+'.';
        applyConfirm(c,ai,si,{score:sc,fb:String(v.fb||'').trim()});
      }
      return null}});
}
/* xác nhận tất cả bài AI đã chấm */
function confirmAllAi(c,ai){
  const a=c.assignments[ai];let n=0;
  a.subs.forEach((b,si)=>{
    if(!b||!b.has||b.score!=null||(!asgIsQ(a)&&a.rubric&&a.rubric.length))return;
    if(!b.ai)aiGradeOne(c,ai,si,true);
    const r=b.ai;if(!r)return;
    if(asgIsQ(a))applyConfirm(c,ai,si,{per:r.per.map(x=>x.got),pfb:r.per.map(x=>x.fb),fb:r.fb});
    else applyConfirm(c,ai,si,{score:r.score,fb:r.fb});
    n++;
  });
  render();toast(n?'Đã xác nhận '+n+' bài theo kết quả AI. Có thể sửa lại từng bài nếu cần.':'Không có bài nào đang chờ xác nhận.');
}
