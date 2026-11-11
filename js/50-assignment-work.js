/* EducMind · js/50-assignment-work.js
   Bài tập hai loại QUIZ / FILE: học sinh làm bài, luyện tập lại, nộp; giáo viên chấm theo từng câu. */
/* ===== Bài tập hai loại: QUIZ (bộ câu hỏi) và FILE (nộp tệp / văn bản) =====
   QUIZ: giáo viên dựng danh sách câu hỏi (ngân hàng, soạn mới, AI) có thứ tự và điểm từng câu. Khi học sinh bắt đầu,
   hệ thống chụp lại ĐỦ các câu theo ĐÚNG thứ tự đó. Câu trắc nghiệm tự chấm, câu tự luận / trả lời ngắn do giáo viên chấm.
   Bằng chứng học tập ghi theo từng mục tiêu từ điểm các câu thuộc mục tiêu đó. Luyện tập lại = làm lại toàn bộ bộ câu hỏi. */
const asgIsQ=a=>a.kind==='QUIZ';
const asgWork=a=>a.subs.some(b=>b&&(b.has||b.redo));
const asgSum=a=>+((a.qs||[]).reduce((n,x)=>n+x.w,0)).toFixed(2);
const objLabels=c=>{const all=[];c.lessonsData.forEach(l=>(l.objs||[]).forEach(o=>all.push({code:o.code,j:o.idx,lesson:l.name})));
  const cnt={};all.forEach(x=>cnt[x.code]=(cnt[x.code]||0)+1);
  return all.map(x=>({code:x.code,j:x.j,label:x.code+' · '+c.goals[x.j]+(cnt[x.code]>1?' ('+x.lesson+')':'')}))};
const OBJL=c=>{const m={};objLabels(c).forEach(o=>m[o.label]=o.j);return m};
function asgSync(c,a){const o=[];(a.qs||[]).forEach(x=>{const q=qOf(c,x.qid);if(q)(q.objs||[]).forEach(j=>{if(!o.includes(j))o.push(j)})});a.objs=o.sort((x,y)=>x-y);a.max=asgSum(a)}
/* Bài tập mẫu có sẵn: chuyển thành bộ câu hỏi lấy từ ngân hàng theo mục tiêu (nếu không có câu nào thì giữ loại nộp tệp) */
classes.forEach(c=>c.assignments.forEach(a=>{
  if(a.kind)return;
  const L=c.bank.filter(q=>!q.del&&(q.objs||[]).some(j=>(a.objs||[]).includes(j)));
  if(!L.length){a.kind='FILE';return}
  a.kind='QUIZ';const w=Math.floor(a.max/L.length*10)/10;
  a.qs=L.map((q,k)=>({qid:q.id,w:k===L.length-1?+(a.max-w*(L.length-1)).toFixed(1):w}));
}));
/* Sinh chi tiết câu trả lời minh họa khớp điểm đã có, sau khi bài tập mẫu có bộ câu hỏi */
classes.forEach(c=>c.students.forEach((s,i)=>c.assignments.forEach((a,ai)=>{const b=a.subs[i];if(b&&b.has&&(a.qs||[]).length&&!b.qa)b.qa=seedQA(c,a,b,i)})));

/* --- Học sinh: làm bài / luyện tập lại --- */
const rdR=()=>{if(!redo)return null;const b=redo.a.subs[redo.c.students.indexOf(redo.s)];return b&&b.redo||null};
const rdPresentation=(b,a)=>['survival','race','blitz'].includes(b&&b.presentation)?b.presentation:(a&&['survival','race','blitz'].includes(a.gameMode)?a.gameMode:'classic');
const rdAllowed=(c,s,a,b)=>b.has?pCanRedo(c,s,a):(asgIsQ(a)&&inWin(a)&&!pAsgBlock(c,s,a));
const rdAnswered=(q,v)=>q.type==='MULTIPLE_CHOICE'?Array.isArray(v)&&v.length>0:(q.type==='SHORT_ANSWER'||q.type==='ESSAY')?typeof v==='string'&&v.trim()!=='':typeof v==='number';
const rdAnsTxt=(q,v)=>{
  if(v==null)return '';
  if(q.type==='MULTIPLE_CHOICE')return (v||[]).slice().sort((x,y)=>x-y).map(i=>q.opts[i]).join('; ');
  if(q.type==='SHORT_ANSWER'||q.type==='ESSAY')return String(v).trim();
  return q.opts[v]==null?'':q.opts[v];
};
function rdBuild(c,a){return (a.qs||[]).map(x=>{const q=qOf(c,x.qid);return q&&{id:q.id,content:q.content,type:q.type,opts:(q.opts||[]).slice(),w:x.w,objs:(q.objs||[]).slice(),explain:q.explain||''}}).filter(Boolean)}
function workOpen(ai,selectedPresentation){
  const c=selected(),s=me(),a=c.assignments[ai],b=a.subs[c.students.indexOf(s)];
  if(!asgIsQ(a)){redoFile(ai);return}
  if(!rdAllowed(c,s,a,b)){toast(b.has?'Hiện không thể luyện tập lại bài này.':'Hiện không thể làm bài này.');return}
  if(!b.redo)b.redo={qs:rdBuild(c,a),ans:{},miss:[],presentation:selectedPresentation||rdPresentation(b,a),playMode:'solo',gameIndex:0,hp:3,feedback:{}};
  else if(selectedPresentation)b.redo.presentation=selectedPresentation;
  else if(!Object.keys(b.redo.ans||{}).length)b.redo.presentation=rdPresentation(b,a);
  if(b.redo.presentation==='survival'){b.redo.playMode=b.redo.playMode||'solo';b.redo.hp=Number.isFinite(b.redo.hp)?b.redo.hp:3;b.redo.feedback=b.redo.feedback||{}}
  page='assignments';redo={c,a,s};focusId='rd-top';render();window.scrollTo(0,0);
}
const redoWork=workOpen,startWork=workOpen;
/* Loại Nộp tệp: luyện tập lại = nộp lại bài làm bằng văn bản hoặc tệp */
function redoFile(ai){
  const c=selected(),s=me(),a=c.assignments[ai],b=a.subs[c.students.indexOf(s)];
  if(!pCanRedo(c,s,a)){toast('Hiện không thể luyện tập lại bài này.');return}
  openDlg({title:'Luyện tập lại: '+esc(a.name),text:'Em còn '+(pMax(a,b)-pTriesOf(b))+' lượt làm bài này (tối đa '+pMax(a,b)+(b.extra?', gồm '+b.extra+' lượt giáo viên cấp thêm':'')+'). Lần làm mới thay lần trước khi giáo viên chấm xong, các lần trước vẫn được lưu. Hạn nộp không áp dụng cho lần luyện tập lại.',okLabel:'Nộp lần làm mới',fields:[{k:'t',label:'Bài làm',val:'',area:true},{k:'f',label:'Tệp đính kèm',file:true}],ok:v=>{
    const t=v.t.trim(),f=v.f_f;
    if(f){if(f.size>52428800)return 'Tệp vượt giới hạn 50 MB.';const ext=f.name.split('.').pop().toLowerCase();if(!ALLOWED.includes(ext))return 'Định dạng .'+ext+' không được phép.'}
    if(!t&&!f)return 'Không thể nộp bài trống: hãy nhập bài làm hoặc đính kèm tệp.';
    if(!pCanRedo(c,s,a))return 'Bài này không còn luyện tập lại được (đã hết lượt hoặc đã đạt yêu cầu).';
    (b.hist=b.hist||[]).push({score:b.score,fb:b.fb||'',text:b.text||'',file:b.file||null});
    b.tries=(b.tries||1)+1;b.score=null;b.fb='';b.text=t;b.file=f?f.name:null;b.edited=false;
    a.graded=a.subs.filter(x=>x.score!=null).length;
    notify('SUBMISSION_RESUBMITTED',s.name+' đã luyện tập lại: '+a.name,{page:'assignments',c,ref:a},c.owner);
    toast('Đã nộp lần làm mới. Chờ giáo viên chấm lại.');return null}});
}
function rdTouch(qi){
  const R=rdR();if(!R)return;
  const q=R.qs[qi];
  if(R.miss.length&&rdAnswered(q,R.ans[q.id])){R.miss=R.miss.filter(x=>x!==qi);const m=document.getElementById('rd-miss-'+qi);if(m)m.remove()}
  const done=R.qs.filter(x=>rdAnswered(x,R.ans[x.id])).length,n=document.getElementById('rd-count');
  if(n)n.textContent='Đã trả lời '+done+'/'+R.qs.length+' câu';
  if(R.presentation==='race'){raceSync(done,R.qs.length,R.gameIndex||0);const cur=R.qs[R.gameIndex||0];raceSetStatus(raceAnswerState(cur,R.ans[cur&&cur.id]))}else if(R.presentation==='survival')survivalSync(R)
}
function rdSet(qi,v){const R=rdR();if(!R)return;R.ans[R.qs[qi].id]=v;rdTouch(qi)}
function rdTog(qi,oi,on){const R=rdR();if(!R)return;const id=R.qs[qi].id,r=R.ans[id]||[];R.ans[id]=on?[...r.filter(x=>x!==oi),oi]:r.filter(x=>x!==oi);rdTouch(qi)}
function rdPause(){const c=redo&&redo.c,a=redo&&redo.a,i=c&&a?c.assignments.indexOf(a):-1,s=redo&&redo.s,b=i>=0&&s?a.subs[c.students.indexOf(s)]:null;redo=null;page=b&&b.has?'results':'assignments';focusId=i>=0?(b&&b.has?'result-'+i:'as-'+i):null;render();window.scrollTo(0,0)}
/* Chấm xong mọi câu thì tính điểm bài và ghi bằng chứng theo từng mục tiêu */
function asgFinal(c,ai,si){
  const a=c.assignments[ai],s=c.students[si],b=a.subs[si],Q=b.qa;
  if(!Q||Q.some(x=>x.got==null))return false;
  const tw=Q.reduce((n,x)=>n+x.w,0),tg=Q.reduce((n,x)=>n+x.got,0),al={};
  b.score=Math.round(tg/tw*a.max*10)/10;
  Q.forEach(x=>(x.objs||[]).forEach(j=>{const e=al[j]||(al[j]=[0,0]);e[0]+=x.got/x.objs.length;e[1]+=x.w/x.objs.length}));
  const key='A'+a.aid,before=s.mastery.slice();
  Object.keys(al).forEach(k=>{const j=+k,r=al[k][0]/al[k][1],x=s.ev[j].find(e=>e.key===key);if(x){x.s=r;x.day=today}else s.ev[j].push({s:r,day:today,src:'Bài tập',key});recalcPair(s,j)});
  recalcClass(c);a.graded=a.subs.filter(x=>x.score!=null).length;
  LOG.unshift('Chấm “'+a.name+'” cho '+s.name+' ('+c.id+'): '+(Object.keys(al).map(k=>c.goals[k]+' '+pct(before[k])+'%→'+pct(s.mastery[k])+'%').join('; ')||'không có mục tiêu gắn'));
  return true;
}
function rdSubmit(){
  if(!redo)return;
  const c=redo.c,s=redo.s,a=redo.a,si=c.students.indexOf(s),b=a.subs[si],R=b&&b.redo,i=c.assignments.indexOf(a);
  if(!R)return;
  const first=!b.has;
  if(!rdAllowed(c,s,a,b)){redo=null;render();toast(first?'Đã quá thời hạn làm bài.':'Bài này không còn luyện tập lại được (đã hết lượt hoặc đã đạt yêu cầu).');return}
  const recKeys=recKeysForTarget(c,s,'assignment',i);
  const miss=[];R.qs.forEach((q,qi)=>{if(!rdAnswered(q,R.ans[q.id]))miss.push(qi)});
  if(miss.length){
    R.miss=miss;if(R.presentation==='race'||R.presentation==='survival'||R.presentation==='blitz')R.gameIndex=miss[0];render();
    toast('Em phải làm đủ toàn bộ bài tập: còn thiếu câu '+miss.map(x=>x+1).join(', ')+'.');
    const f=document.getElementById('rd-q'+miss[0]);if(f)f.scrollIntoView({block:'center'});
    return;
  }
  const qa=R.qs.map(q=>{const v=R.ans[q.id],bq=qOf(c,q.id),ob=!!(bq&&isObj(bq));return {q:q.content,t:q.type,a:rdAnsTxt(q,v),w:q.w,objs:q.objs,got:ob?autoScore(bq,q.w,v):null,fb:'',ok:ob?autoScore(bq,1,v)===1:null}});
  const txt='Bài làm dạng bộ câu hỏi: đã trả lời '+qa.length+'/'+qa.length+' câu';
  const playedAs=R.presentation||a.gameMode||'classic';
  if(first){b.presentation=playedAs;b.has=true;b.tries=1;b.status=simNow()<=dueMs(a)?'SUBMITTED':'LATE';b.score=null;b.fb='';b.qa=qa;b.text=txt;b.file=null;b.edited=false;b.redo=null;a.submitted=a.subs.filter(x=>x.has).length}
  else{
    (b.hist=b.hist||[]).push({score:b.score,fb:b.fb||'',text:b.text||'',file:b.file||null,qa:b.qa||null,presentation:b.presentation||'classic'});
    b.presentation=playedAs;b.tries=(b.tries||1)+1;b.score=null;b.fb='';b.qa=qa;b.text=txt;b.file=null;b.edited=false;b.redo=null;
    notify('SUBMISSION_RESUBMITTED',s.name+' đã luyện tập lại: '+a.name,{page:'assignments',c,ref:a},c.owner);
  }
  const completedSurvival=R.presentation==='survival';
  const done=asgFinal(c,i,si);a.graded=a.subs.filter(x=>x.score!=null).length;
  markRecKeys(s,recKeys,'assignment-completed');
  /* còn câu chấm tay thì AI chấm trước và soạn nhận xét để giáo viên xác nhận */
  if(!done&&typeof aiGradeOne==='function')aiGradeOne(c,i,si,true);
  if(completedSurvival){survivalResult={name:a.name,score:b.score,max:a.max,count:qa.length,correct:qa.filter(x=>x.ok===true).length,waiting:b.score==null};page='assignments';focusId='as-'+i}
  else{page='results';focusId='result-'+i}
  redo=null;render();window.scrollTo(0,0);
  toast(done?'Đã nộp bài và chấm tự động: '+b.score+'/'+a.max+'.':'Đã nộp bài. Các câu tự luận hoặc trả lời ngắn đang chờ giáo viên chấm.');
}
function redoPanel(){
  if(!redo)return '';
  const c=selected(),s=me();
  if(role!=='S'||!s||redo.c!==c||redo.s!==s){redo=null;return ''}
  const a=redo.a,b=a.subs[c.students.indexOf(s)];
  if(!b||!b.redo||!rdAllowed(c,s,a,b)){redo=null;return ''}
  return examHtml(c,a,b,b.redo,!b.has,false);
}
/* Giao diện làm bài dùng chung cho học sinh và cho bản xem trước của giáo viên (pv=true: không nộp, không lưu) */
function examHtml(c,a,b,R,first,pv){
  const tot=R.qs.length,done=R.qs.filter(q=>rdAnswered(q,R.ans[q.id])).length;
  const prev=!first&&b.score!=null?'Lần trước: '+b.score+'/'+a.max+(b.fb?' · Nhận xét: '+esc(b.fb):''):'';
  const tw=+R.qs.reduce((n,q)=>n+q.w,0).toFixed(2);
  if((R.presentation||a.gameMode)==='survival')return examSurvivalHtml(c,a,b,R,first,pv,prev,tw,tot,done);
  if((R.presentation||a.gameMode)==='race')return examRaceHtml(c,a,b,R,first,pv,prev,tw,tot,done);
  if((R.presentation||a.gameMode)==='blitz')return examBlitzHtml(c,a,b,R,first,pv,prev,tw,tot,done);
  const inp=(q,qi)=>{const v=R.ans[q.id];
    if(q.type==='MULTIPLE_CHOICE')return q.opts.map((o,oi)=>`<label style='display:block;padding:3px 0'><input type='checkbox' ${(v||[]).includes(oi)?'checked':''} onchange='rdTog(${qi},${oi},this.checked)'> ${esc(o)}</label>`).join('');
    if(q.type==='SHORT_ANSWER')return `<input style='width:100%' value='${esc(v||'')}' oninput='rdSet(${qi},this.value)' aria-label='Câu trả lời câu ${qi+1}'>`;
    if(q.type==='ESSAY')return `<textarea rows='5' style='width:100%' oninput='rdSet(${qi},this.value)' aria-label='Câu trả lời câu ${qi+1}'>${esc(v||'')}</textarea>`;
    return q.opts.map((o,oi)=>`<label style='display:block;padding:3px 0'><input type='radio' name='${pv?'pv':'rd'}${qi}' ${v===oi?'checked':''} onchange='rdSet(${qi},${oi})'> ${esc(o)}</label>`).join('')};
  return `<section class='${pv?'':'panel'}' ${pv?'':`id='rd-top' tabindex='-1'`} aria-labelledby='h-rd'><h2 id='h-rd'>${first?'Làm bài':'Luyện tập lại'}: ${esc(a.name)}</h2><p class='lead'>Lần làm ${pTriesOf(b)+1}/${pMax(a,b)} · ${tot} câu · tổng ${tw} điểm. Em phải trả lời tất cả ${tot} câu mới nộp được${first?'':' (làm lại toàn bộ bài tập)'}. Câu trả lời được lưu ngay khi chọn; nếu tạm dừng, em quay lại làm tiếp mà chưa tốn lượt (lượt chỉ tính khi nộp).${first?' Hạn nộp '+a.due+'.':' Hạn nộp không áp dụng cho lần luyện tập lại.'}</p>${a.desc?`<p class='muted' style='margin:0 0 4px'>Hướng dẫn: ${esc(a.desc)}</p>`:''}${prev?`<p class='muted' style='margin:0 0 4px'>${prev}</p>`:''}<p class='muted' id='rd-count' role='status' style='margin:0 0 6px'>Đã trả lời ${done}/${tot} câu</p>${R.qs.map((q,qi)=>`<fieldset class='item' id='rd-q${qi}' style='display:block;border-left:0;border-right:0;border-bottom:0;padding:12px 0'><legend><b>Câu ${qi+1} (${q.w} điểm).</b> ${esc(q.content)} <span class='muted'>(${QT[q.type]||''})</span></legend>${inp(q,qi)}${R.miss.includes(qi)?`<div id='rd-miss-${qi}' role='alert' style='background:var(--err-bg);color:var(--err-ink);padding:6px 10px;border-radius:var(--radius-sm);margin-top:6px'>Câu này chưa được trả lời.</div>`:''}</fieldset>`).join('')}${pv?'':`<div class='row'><button class='btn' onclick='rdSubmit()'>Nộp bài</button><button class='btn light' onclick='rdPause()'>Tạm dừng</button></div>`}</section>`;
}
/* Xem lại bài làm từng câu: học sinh (kèm điểm sau khi chấm), giáo viên (kèm gợi ý đúng/sai câu trắc nghiệm) */
function qaView(b,t){
  if(!b||!b.has||!b.qa||!b.qa.length)return '';
  const sh=t||b.score!=null;
  return `<details style='margin-top:6px'><summary class='muted'>Xem bài làm (${b.qa.length} câu)</summary>${b.qa.map((x,i)=>`<div style='padding:4px 0'><b>Câu ${i+1}.</b> ${esc(x.q)}<div class='muted'>Trả lời: ${x.a?esc(x.a):'(bỏ trống)'}${sh&&x.got!=null?` · <b>${x.got}/${x.w}</b>`:''}${t&&x.ok!=null?` · ${x.ok?'đúng đáp án':'sai đáp án'}`:''}${sh&&x.fb?' · Nhận xét: '+esc(x.fb):''}</div></div>`).join('')}</details>`;
}

/* --- Giáo viên: chấm theo từng câu --- */
function qCells(a,ai,i,b){
  const left=b.qa.filter(x=>x.got==null).length;
  return `<td>${b.score==null?`<span class='pill need'>Chờ chấm</span>`:b.score+'/'+a.max}</td><td class='muted'>${left?'Còn '+left+' câu chưa chấm':'Đã chấm đủ'}</td><td><button class='btn ${b.score==null?'':'light'}' onclick='gradeAsgQ(${ai},${i})'>${b.score==null?'Chấm':'Xem và chỉnh'}</button></td>`;
}
function gradeAsgQ(ai,si){
  const c=selected(),a=c.assignments[ai],s=c.students[si],b=a.subs[si],Q=b.qa,f=[];
  Q.forEach((x,i)=>f.push({k:'s'+i,label:'Câu '+(i+1)+' ('+QT[x.t]+', tối đa '+x.w+'): '+esc(x.q)+' — Trả lời: '+esc(x.a||'(bỏ trống)'),val:x.got==null?'':x.got},{k:'f'+i,label:'Nhận xét câu '+(i+1),val:x.fb||''}));
  openDlg({title:'Chấm bài · '+esc(s.name),text:'Điểm mỗi câu từ 0 đến điểm tối đa của câu. Câu trắc nghiệm đã được chấm tự động, có thể chỉnh. Chấm đủ mọi câu thì bài chuyển sang đã chấm và mức nắm vững được tính lại.',okLabel:'Lưu điểm',fields:f,ok:v=>{
    const ns=[];
    for(let i=0;i<Q.length;i++){const raw=String(v['s'+i]).trim().replace(',','.');if(raw===''){ns.push(null);continue}const n=parseFloat(raw);if(isNaN(n)||n<0||n>Q[i].w)return 'Câu '+(i+1)+': điểm phải từ 0 đến '+Q[i].w+'. Chưa lưu.';ns.push(n)}
    Q.forEach((x,i)=>{x.got=ns[i];x.fb=String(v['f'+i]).trim()});b.gradedBy=acctName();
    if(asgFinal(c,ai,si))toast('Đã chấm xong; mức nắm vững của '+s.name+' đã được tính lại.');
    else{b.score=null;a.graded=a.subs.filter(x=>x.score!=null).length;toast('Đã lưu. Còn câu chưa có điểm nên bài vẫn chờ chấm.')}
    return null}});
}
