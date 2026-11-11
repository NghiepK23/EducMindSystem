/* EducMind · js/10-mastery-engine.js
   Tính lại mức nắm vững và lỗ hổng kiến thức từ bằng chứng học tập (US-H01). */
/* ===== US-H01: tính lại mức nắm vững, lỗ hổng ===== */
function recalcPair(s,j){
  const e=s.ev[j],g=s.gaps[j];let w=0,t=0;
  e.forEach(x=>{const k=Math.pow(.5,(today-x.day)/HL);w+=k*x.s;t+=k});
  const m=t?w/t:null;s.mastery[j]=m;
  if(m==null)return;
  if(g.status==='OPEN'){if(m>=T_CLOSE){g.status='RESOLVED';g.at=today}}
  else if(m<T_OPEN&&e.length>=2&&!(g.status==='DISMISSED'&&evSig(e)===g.sig)){g.status='OPEN';g.reason='Mức nắm vững '+pct(m)+'% với '+e.length+' bằng chứng'}
}
function recalcClass(c){c.scores=c.goals.map((_,j)=>{const v=c.students.map(s=>s.mastery[j]).filter(x=>x!=null);return v.length?mean(v):0})}
function attemptTable(c){
  return `<div class="tablewrap" style="margin-top:14px"><table><thead><tr><th scope="col">Học sinh</th><th scope="col">Lượt đã làm</th><th scope="col">Lượt gần nhất</th><th scope="col">Làm lại</th></tr></thead><tbody>${c.students.map(s=>`<tr><td class="student">${s.name}</td><td>${s.att.used}/${c.maxAtt}</td><td><b>${pct(s.att.last)}%</b></td><td>${s.att.used<c.maxAtt?'Còn '+(c.maxAtt-s.att.used)+' lượt':'Hết lượt'}</td></tr>`).join('')}</tbody></table></div>`;
}
/* Dữ liệu minh họa: sinh chi tiết trả lời từng câu (qa) khớp với điểm đã có, để chấm lại và phân tích hoạt động thật */
function seedQA(c,a,b,si){
  const p=b.score!=null?Math.max(.2,Math.min(.95,b.score/a.max)):((si*29+7)%10)/14+.3;
  const qa=(a.qs||[]).map((x,i)=>{
    const q=qOf(c,x.qid),w=x.w||1,okk=((si*31+i*17+7)%10)/10<p;let v,txt;
    if(q&&isObj(q)){
      if(q.type==='MULTIPLE_CHOICE'){v=okk?q.ans.slice():q.ans.slice(0,Math.max(1,q.ans.length-1));txt=v.map(m=>q.opts[m]).join('; ')}
      else if(q.opts.length===2){v=okk?q.ans:1-q.ans;txt=q.opts[v]}
      else{v=okk?q.ans:(q.ans+1+((si+i)%Math.max(1,q.opts.length-1)))%q.opts.length;txt=q.opts[v]}
      return {q:q.content,t:q.type,a:txt,w,objs:(q.objs||[]).slice(),got:autoScore(q,w,v),fb:'',ok:autoScore(q,1,v)===1};
    }
    txt=okk?'Em trình bày: '+(c.goals[(q&&q.objs[0])||0]||'nội dung bài học')+' là nội dung trọng tâm, kèm ví dụ minh họa cụ thể.':'Em chưa nhớ rõ nội dung này nên trình bày còn thiếu ý.';
    return {q:q.content,t:q.type,a:txt,w,objs:(q.objs||[]).slice(),got:null,fb:'',ok:null};
  });
  if(b.score!=null){
    let sum=Math.round(qa.reduce((t,x)=>t+(x.got||0),0)*10)/10;
    const E=qa.filter(x=>x.got==null);
    if(E.length){
      let rem=Math.round((b.score-sum)*10)/10;
      E.forEach((x,k)=>{const g=k===E.length-1?rem:Math.max(0,Math.min(x.w,Math.round(rem/E.length*10)/10));x.got=Math.max(0,Math.min(x.w,Math.round(g*10)/10));x.ok=x.got===x.w;rem=Math.round((rem-x.got)*10)/10});
      if(Math.abs(rem)>1e-9){const x=E[E.length-1];x.got=Math.max(0,Math.min(x.w,Math.round((x.got+rem)*10)/10));x.ok=x.got===x.w}
    }else{
      let diff=Math.round((b.score-sum)*10)/10;
      for(const x of qa){if(!diff)break;const ng=Math.max(0,Math.min(x.w,Math.round((x.got+diff)*10)/10)),d=Math.round((ng-x.got)*10)/10;if(d){x.got=ng;x.ok=ng===x.w;diff=Math.round((diff-d)*10)/10}}
    }
  }
  return qa;
}
classes.forEach(c=>{
  c.maxAtt=3;
  c.assignments.forEach((a,ai)=>{a.max=10;a.maxTries=3;a.objs=ai?[0]:[0,1];a.subs=c.students.map((_,i)=>({score:null,has:i<a.submitted,status:'SUBMITTED',text:'Bài làm của học sinh'}))});
  c.students.forEach((s,i)=>{
    c.assignments.forEach((a,ai)=>{if(i<a.graded){a.objs.forEach(j=>{s.ev[j][ai].key='A'+ai});a.subs[i].score=Math.round(s.ev[a.objs[0]][ai].s*a.max*10)/10}});
    c.goals.forEach((_,j)=>recalcPair(s,j));
    s.att.last=Math.max(.3,Math.min(.95,sAvg(s)+(i%2?.08:-.04)));
  });
  recalcClass(c);
});
