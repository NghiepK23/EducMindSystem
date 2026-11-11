/* EducMind · js/38-recommendations.js
   Gợi ý học tập: chọn nội dung đích, danh sách gợi ý, trang Gợi ý của giáo viên. */
/* --- AC-S06.3: gợi ý luôn trỏ tới một nội dung có sẵn --- */
const offRatio=(c,s)=>{const g=(s.atts||[]).filter(x=>x.status==='GRADED');return g.length?Math.max(...g.map(x=>x.ratio)):null};
function recTarget(c,s,j,type){
  const si=c.students.indexOf(s);
  if(type==='Ôn lại nội dung'){
    const l=lessonOf(c,j);
    if(l&&l.status==='Đã xuất bản'&&topicLive(c,l)&&!pBlock(c,s,l)){const r=l.res[0];return {kind:'lesson',li:c.lessonsData.indexOf(l),label:'Bài học “'+l.name+'”'+(r?' · tài liệu '+r.name:'')}}
    if(c.cres.length)return {kind:'cres',label:'Tài liệu chung “'+c.cres[0].name+'”'};
    return null;
  }
  const asg=c.assignments.map((a,i)=>({a,i,b:a.subs[si]})).filter(x=>x.b&&x.a.status==='Đã xuất bản'&&scopeLive(c,x.a)&&x.a.objs.includes(j)&&!pAsgBlock(c,s,x.a));
  const quizOk=!c.quiz.deleted&&c.quiz.status==='Đã xuất bản'&&scopeLive(c,c.quiz)&&c.quiz.qs.some(x=>{const q=qOf(c,x.qid);return q&&q.objs.includes(j)});
  const A=(x,why)=>({kind:'assignment',i:x.i,label:'Bài tập “'+x.a.name+'”'+(why?' · '+why:'')});
  const Q=why=>({kind:'assessment',label:'Bài tập “'+c.quiz.name+'”'+(why?' · '+why:'')});
  const todo=asg.find(x=>!x.b.has);
  if(type==='Luyện tập có mục tiêu'){
    if(todo)return A(todo,'chưa nộp');
    const w=asg.find(x=>x.b.score!=null&&x.b.score/x.a.max<.7);
    if(w)return A(w,'làm chưa tốt ('+w.b.score+'/'+w.a.max+')');
    const o=offRatio(c,s);
    if(quizOk&&s.att.used<c.maxAtt&&(o==null||o<.7))return Q(o==null?'chưa làm':'làm chưa tốt');
    return null;
  }
  if(todo)return A(todo,'chưa nộp');
  if(quizOk&&s.att.used===0)return Q('chưa làm');
  return null;
}
function recsOf(c,s){
  const r=[];
  c.goals.forEach((g,j)=>{const m=s.mastery[j];if(m==null||delGoal(c,j))return;
    const type=m<.4?'Ôn lại nội dung':m<.7?'Luyện tập có mục tiêu':'Hoạt động nâng cao',t=recTarget(c,s,j,type);
    if(!t&&type!=='Hoạt động nâng cao')return;
    r.push([type,m<.4?'need':m<.7?'prog':'good',g,'Mức nắm vững '+pct(m)+(m<.4?'% (dưới 40%)':m<.7?'% (40–69%)':'% (từ 70%)'),t])});
  if(!c.quiz.deleted&&c.quiz.status==='Đã xuất bản'&&scopeLive(c,c.quiz)&&s.att.used>0&&s.att.last<.65&&s.att.used<c.maxAtt&&s.gaps.some(g=>g.status==='OPEN'))
    r.unshift(['Làm lại bài kiểm tra','need',c.quiz.name,'Lượt gần nhất '+pct(s.att.last)+'% (dưới 65%), còn '+(c.maxAtt-s.att.used)+' lượt, có lỗ hổng đang mở',{kind:'assessment',label:'Bài tập “'+c.quiz.name+'”'}]);
  return r;
}
function recommend(){
  const c=selected();
  return `<section class="panel" aria-labelledby="h-rc"><div class="tablewrap"><table><thead><tr><th scope="col">Học sinh</th><th scope="col">Gợi ý</th></tr></thead><tbody>${c.students.map(s=>`<tr><td class="student" style="vertical-align:top">${esc(s.name)}</td><td>${recsOf(c,s).map(x=>{const st=s.rs[x[0]+'|'+x[2]];return `<div style="margin:6px 0"><span class="pill ${x[1]}">${x[0]}</span> <b>${esc(x[2])}</b>${st?` <span class="pill plain">${st.t==='A'?'Học sinh đã chấp nhận':'Học sinh đã bỏ qua'}</span>`:''}<div class="muted" style="font-size:12px">${x[3]}</div><div class="muted" style="font-size:12px">${x[4]?'Trỏ tới: '+esc(x[4].label):'Lời khuyến khích, không kèm liên kết'}</div></div>`}).join('')||'<span class="muted">Chưa có gợi ý</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function openTarget(t){
  const c=selected();
  if(role==='S'){
    if(t.kind==='mastery'){page='mastery';flashId='mastery-goal-'+t.j;focusId='nav-mastery';render();return;}
    if(t.kind==='lesson'){
      const l=c.lessonsData[t.li];if(!l){toast('Bài học gợi ý không còn khả dụng.');return}
      stuLessonView={cid:c.id,li:t.li};stuLessonTab='goals';page='lessons';focusId='nav-lessons';render();window.scrollTo(0,0);return;
    }
    if(t.kind==='cres'){page='lessons';focusId='nav-lessons';flashId='cdocs';render();return}
    if(t.kind==='assignment'){
      const a=c.assignments[t.i];if(!a){toast('Bài tập gợi ý không còn khả dụng.');return}
      page='assignments';
      if(asgIsQ(a))openAssignmentMode(t.i)
      else submitWork(t.i,false);
      return;
    }
    if(t.kind==='assessment'){page='assessments';focusId='nav-assessments';startQuiz();return}
  }
  if(t.kind==='mastery'){page='mastery';flashId='mastery-goal-'+t.j}
  else if(t.kind==='lesson'){page='lessons';flashId='ls-'+t.li}
  else if(t.kind==='cres'){page='lessons';flashId='cdocs'}
  else if(t.kind==='assignment'){page='assignments';flashId='as-'+t.i}
  else{page='assignments';asgTab='quiz';flashId='qz'}
  focusId='nav-'+page;render();
}
