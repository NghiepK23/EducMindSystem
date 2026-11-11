/* EducMind · js/17-student-progress.js
   Học sinh xem mức nắm vững, gợi ý học tập và lỗ hổng kiến thức. */
/* S05: mức nắm vững dạng nhãn, không hiển thị số */
function sMastery(){
  const c=selected(),s=me();
  return `<section class='panel' aria-labelledby='h-sm'><h2 id='h-sm'>Mức nắm vững theo mục tiêu</h2><p class='lead'>Tính từ các bằng chứng học tập của em; bằng chứng càng cũ càng ít được tính.</p><div class='tablewrap'><table><thead><tr><th scope='col'>Mục tiêu</th><th scope='col'>Bài học · Chủ đề</th><th scope='col'>Mức nắm vững</th><th scope='col'><span class='sr'>Mở bài học</span></th></tr></thead><tbody>${c.goals.map((g,j)=>{const l=lessonOf(c,j),o=l&&l.objs.find(x=>x.idx===j),m=s.mastery[j],ok=l&&l.status==='Đã xuất bản'&&topicLive(c,l);if(!o&&c.trash.some(t=>t.type==='Mục tiêu'&&(t.objIdx||[]).includes(j)))return '';
    return `<tr id='mastery-goal-${j}'><td>${o?'<b>'+esc(o.code)+'</b> ':''}${esc(g)}</td><td>${l?esc(l.name)+' · '+esc(topicOf(c,l).title):'Bài học không còn khả dụng'}</td><td>${m==null?'Chưa có dữ liệu':tierPill(m)}</td><td>${ok?`<button type='button' class='btn light' data-noicon='1' onclick="openTargetFromGap('${esc(l.name)}','${esc(l.tid)}',${j})">Mở mục tiêu</button>`:''}</td></tr>`}).join('')}</tbody></table></div>${note('Em chỉ thấy nhãn Cần ôn, Đang tiến bộ hoặc Vững; giáo viên mới xem được số cụ thể.')}</section>`;
}
/* S06: gợi ý học tập */
const SR={'Ôn lại nội dung':'Em còn yếu mục tiêu này, hãy xem lại bài học.','Luyện tập có mục tiêu':'Em đang tiến bộ, hãy luyện tập thêm.','Hoạt động nâng cao':'Em đã vững, hãy thử thách thêm.','Làm lại bài kiểm tra':'Lượt làm gần nhất chưa đạt và em còn lượt làm lại.'};
const SRP={'Ôn lại nội dung':'lessons','Luyện tập có mục tiêu':'assignments','Hoạt động nâng cao':'assignments','Làm lại bài kiểm tra':'assessments'};
const activeRecs=(c,s)=>recsOf(c,s).filter(x=>{const st=s.rs[x[0]+'|'+x[2]];return !st||(st.t==='D'&&lastEv(s)>st.day)});
function recKeysForTarget(c,s,kind,index){return recsOf(c,s).filter(x=>x[4]&&x[4].kind===kind&&(kind!=='assignment'||x[4].i===index)).map(x=>x[0]+'|'+x[2])}
function markRecKeys(s,keys,source){if(!s||!keys||!keys.length)return;s.rs=s.rs||{};keys.forEach(k=>s.rs[k]={t:'A',day:lastEv(s),source:source||'completed'})}

/* S08: lỗ hổng kiến thức của chính học sinh (nhãn, không số) */
function gapTargetAction(x,kind){
  if(kind==='lesson')return x.l?`<button type='button' class='btn light gap-target-btn' data-noicon='1' onclick='openGapTarget(${x.j},"lesson")'>Bài học: ${esc(x.l.name)}</button>`:'';
  if(kind==='practice'){
    const t=recTarget(selected(),me(),x.j,'Luyện tập có mục tiêu')||recTarget(selected(),me(),x.j,'Hoạt động nâng cao');
    return t?`<button type='button' class='btn light gap-target-btn' data-noicon='1' onclick='openGapTarget(${x.j},"practice")'>Bài tập: ${esc(t.label.replace(/^Bài tập “|”(?: ·.*)?$/g,''))}</button>`:'';
  }
  return `<button type='button' class='btn light gap-target-btn' data-noicon='1' onclick='openGapTarget(${x.j},"mastery")'>Mức nắm vững của mục tiêu này</button>`;
}
function sGaps(){
  const c=selected(),s=me(),G=goalsIn(c),L=[];
  G.forEach(j=>{const g=s.gaps[j],m=s.mastery[j];if(!g||g.status!=='OPEN')return;
    const l=lessonOf(c,j),o=l&&(l.objs||[]).find(x=>x.idx===j);L.push({j,g,m,l,o});
  });
  const row=x=>`<article class='item gap-focus-card'><div class='gap-focus-main'><div><span class='gap-focus-code'>${esc(x.o?x.o.code:codeOf(c,x.j))}</span><b>${esc(gl(c,x.j))}</b></div><div class='muted'>${x.l?esc(x.l.name)+' · '+esc(topicOf(c,x.l).title):'Bài học không còn khả dụng'}</div><div class='muted'>${esc(x.g.reason||'Cần luyện tập thêm mục tiêu này')}</div></div><div class='gap-focus-state'>${x.m==null?`<span class='pill plain'>Chưa đủ dữ liệu</span>`:tierPill(x.m)}</div><div class='gap-target-actions'>${gapTargetAction(x,'lesson')}${gapTargetAction(x,'practice')}${gapTargetAction(x,'mastery')}</div></article>`;
  return `<div class='student-gap-page'><section class='panel' aria-labelledby='h-sg2'><header class='student-gap-header'><div><span class='student-page-eyebrow'>HỌC THEO MỤC TIÊU</span><h2 id='h-sg2'>Lỗ hổng kiến thức</h2><p>Chọn ngay nội dung gắn với mục tiêu cần củng cố. Mỗi nút sẽ mở đúng bài học, bài tập hoặc dòng phân tích tương ứng.</p></div><span class='student-recs-count'>${L.length}<small>${L.length===1?'mục tiêu':'mục tiêu'}</small></span></header>${L.length?`<div class='gap-focus-list'>${L.map(row).join('')}</div>`:`<div class='student-recs-empty'><span aria-hidden='true'>🌱</span><h3>Chưa có lỗ hổng đang mở</h3><p>Các mục tiêu cần củng cố sẽ xuất hiện tại đây cùng lối tắt phù hợp.</p></div>`}</section></div>`;
}
function openGapTarget(j,kind){
  const c=selected(),s=me();
  if(kind==='lesson'){
    const l=lessonOf(c,j);if(!l){toast('Bài học gợi ý không còn khả dụng.');return}
    openTarget({kind:'lesson',li:c.lessonsData.indexOf(l),goal:j,label:'Bài học “'+l.name+'”'});return;
  }
  if(kind==='practice'){
    const t=recTarget(c,s,j,'Luyện tập có mục tiêu')||recTarget(c,s,j,'Hoạt động nâng cao');
    if(!t){toast('Chưa có bài tập phù hợp với mục tiêu này.');return}
    openTarget(t);return;
  }
  openTarget({kind:'mastery',j,label:'Mức nắm vững · '+codeOf(c,j)});
}
function openTargetFromGap(name,tid,j){
  const c=selected(),l=c.lessonsData.find(x=>x.name===name&&(!tid||x.tid===tid));
  if(!l){toast('Bài học không còn khả dụng.');return}
  const idx=c.lessonsData.indexOf(l);stuLessonView={cid:c.id,li:idx};stuLessonTab='goals';page='lessons';flashId=j==null?null:'stu-goal-'+j;render();window.scrollTo(0,0);
}
