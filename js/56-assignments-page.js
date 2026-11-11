/* EducMind · js/56-assignments-page.js
   Trang Bài tập & kiểm tra của giáo viên và rubric chấm điểm. */
/* ===== UX cập nhật theo yêu cầu: chỉ nội dung học tập ở Bài tập & kiểm tra ===== */
function quizPanel(c){
  const q=c.quiz;
  if(q.deleted)return `<section class='panel'><div class='row between' style='flex-wrap:wrap'><div><h2>Bài tập</h2><p class='lead' style='margin:4px 0 0'>Chưa có bài tập nào.</p></div></div></section>${trashPanel(c,['Bài tập'])}`;
  const lock=hasAtt(c);
  return `<section class='panel' style='margin:0;padding:0;background:transparent;box-shadow:none'>
    <div class='row between' style='flex-wrap:wrap;margin-bottom:10px'><span class='row'><span class='pill ${q.status==='Nháp'?'plain':'good'}'>${q.status}</span><span class='pill plain'>${esc(scopeLbl(c,q.scope))}</span></span><span class='row'><button class='btn light' onclick='editQuiz()'>Sửa thông số</button><button class='btn light' onclick='togglePubQ()'>${q.status==='Nháp'?'Xuất bản':'Hủy xuất bản'}</button><button class='btn light' onclick='delQuiz()'>Xóa</button></span></div>
    <p class='lead'>${q.dur} phút · tối đa ${c.maxAtt} lượt · mở ${q.open}, đóng ${q.close} · tổng điểm ${qMax(c)}${scopeLive(c,q)?'':' · học sinh chưa thấy vì chủ đề hoặc bài học chưa xuất bản'}${q.upd?' · sửa gần nhất: '+q.upd:''}</p>
    <details class='analysis-fold'><summary>Câu hỏi của bài · ${q.qs.length} câu${lock?' · đã khóa chỉnh sửa':''}</summary><div>${q.qs.length?q.qs.map((x,i)=>{const qq=qOf(c,x.qid);return `<div class='item'><div><b>${i+1}. ${esc(qq.content)}</b><div class='muted'>${QT[qq.type]} · trọng số ${x.w}${qq.del?' · đã xóa khỏi ngân hàng':''}</div></div>${lock?'':`<button class='btn light' onclick='rmQ(${i})'>Gỡ</button>`}</div>`}).join(''):`<div class='empty'>Chưa có câu hỏi nào.</div>`}${lock?'':`<button class='btn light' style='margin-top:8px' onclick='addQ()'>${ic('plus',16)}Thêm từ ngân hàng câu hỏi</button>`}</div></details>
  </section>`;
}
function rubricLocked(a){return (a.subs||[]).some(b=>b&&b.has)}
function rubricDefaults(a){
  const names=['Nội dung & độ chính xác','Lập luận / vận dụng','Minh chứng & sản phẩm','Cấu trúc & trình bày'];
  const desc=['Kiến thức chính xác, đáp ứng yêu cầu đề bài.','Phân tích, lập luận hoặc vận dụng kiến thức phù hợp.','Ví dụ, nguồn dẫn hoặc sản phẩm có chất lượng và phù hợp.','Bố cục rõ ràng, diễn đạt dễ hiểu, trình bày cẩn thận.'];
  const ratios=[.4,.3,.2,.1];return names.map((name,i)=>({name,max:+(a.max*ratios[i]).toFixed(2),description:desc[i]}));
}
function rubricEditor(i){
  const a=selected().assignments[i];
  if(!a||asgIsQ(a)){toast('Rubric chỉ áp dụng cho bài tự luận hoặc bài nộp dự án.');return}
  if(rubricLocked(a)){toast('Rubric đã khóa vì đã có học sinh nộp bài.');return}
  const base=(a.rubric&&a.rubric.length?a.rubric:rubricDefaults(a)).slice(0,5),rows=Array.from({length:5},(_,i)=>base[i]||{name:'',max:'',description:''});
  const fields=[];
  rows.forEach((r,j)=>fields.push(
    {k:'n'+j,label:'Tiêu chí '+(j+1)+' · tên',val:r.name||''},
    {k:'m'+j,label:'Tiêu chí '+(j+1)+' · điểm tối đa',val:r.max==null?'':r.max},
    {k:'d'+j,label:'Tiêu chí '+(j+1)+' · mô tả (không bắt buộc)',val:r.description||'',area:true}
  ));
  openDlg({title:'Rubric chấm điểm · '+esc(a.name),text:'Tạo từ 2–5 tiêu chí. Tổng điểm tối đa của các tiêu chí phải đúng bằng '+a.max+' điểm. Có thể xóa rubric bằng cách để trống toàn bộ tiêu chí. Rubric sẽ khóa sau khi có bài nộp đầu tiên.',fields,ok:v=>{
    const next=[];
    for(let j=0;j<5;j++){
      const name=String(v['n'+j]||'').trim(),raw=String(v['m'+j]||'').trim().replace(',','.'),description=String(v['d'+j]||'').trim();
      if(!name&&!raw&&!description)continue;
      if(!name||!raw)return 'Tiêu chí '+(j+1)+': cần có cả tên và điểm tối đa.';
      const max=Number(raw);if(!Number.isFinite(max)||max<=0)return 'Điểm tối đa của tiêu chí '+(j+1)+' phải lớn hơn 0.';
      next.push({name,max,description});
    }
    if(next.length===1)return 'Rubric cần ít nhất 2 tiêu chí; hoặc để trống toàn bộ để bỏ rubric.';
    if(next.length&&Math.abs(next.reduce((t,x)=>t+x.max,0)-Number(a.max))>.011)return 'Tổng điểm tối đa rubric ('+next.reduce((t,x)=>t+x.max,0)+') phải bằng điểm tối đa bài tập ('+a.max+').';
    const seen=new Set();for(const r of next){const k=r.name.toLocaleLowerCase();if(seen.has(k))return 'Tên tiêu chí bị trùng: '+r.name+'.';seen.add(k)}
    a.rubric=next;a.rubricUpdated=stamp();toast(next.length?'Đã lưu rubric với '+next.length+' tiêu chí.':'Đã bỏ rubric.');return null
  }});
}
function rubricGradeFields(a,b){
  const r=a.rubric||[],saved=b&&b.rubricScores||[];
  return r.flatMap((x,i)=>{const old=saved[i]||{};return [
    {k:'rp'+i,label:esc(x.name)+' · điểm (0–'+x.max+')',val:old.score==null?'':old.score},
    {k:'rc'+i,label:esc(x.name)+' · nhận xét (không bắt buộc)',val:old.comment||'',area:true}
  ]});
}
function rubricRead(v,a){
  const out=[];let total=0;
  (a.rubric||[]).forEach((r,i)=>{
    const raw=String(v['rp'+i]==null?'':v['rp'+i]).trim().replace(',','.');
    if(raw==='')return;
    const score=Number(raw);if(!Number.isFinite(score)||score<0||score>r.max)return;
    total+=score;out.push({name:r.name,max:r.max,score,comment:String(v['rc'+i]||'').trim()});
  });
  if(out.length!==(a.rubric||[]).length)return {error:'Hãy nhập điểm cho từng tiêu chí rubric.'};
  for(let i=0;i<out.length;i++)if(out[i].score>(a.rubric[i].max+1e-9)||out[i].score<0)return {error:'Điểm tiêu chí “'+a.rubric[i].name+'” phải từ 0 đến '+a.rubric[i].max+'.'};
  return {total:Math.round(total*100)/100,scores:out};
}
function rubricPreviewHtml(a){
  if(!a.rubric||!a.rubric.length)return '';
  return `<details class='rubric-preview'><summary>Tiêu chí chấm · ${a.rubric.length} tiêu chí · ${esc(a.max)} điểm</summary><div class='rubric-preview-list'>${a.rubric.map(r=>`<div><b>${esc(r.name)}</b><span>Tối đa ${esc(r.max)} điểm</span>${r.description?`<small>${esc(r.description)}</small>`:''}</div>`).join('')}</div></details>`;
}
function rubricResultHtml(b){
  if(!b||!b.rubricScores||!b.rubricScores.length)return '';
  return `<section class='rubric-result' aria-label='Điểm theo tiêu chí'><b class='rubric-result-title'>Chi tiết rubric</b>${b.rubricScores.map(r=>`<div class='rubric-result-row'><span><b>${esc(r.name)}</b>${r.comment?`<small>${esc(r.comment)}</small>`:''}</span><strong>${esc(r.score)} / ${esc(r.max)}</strong></div>`).join('')}</section>`;
}
function assignmentsPage(){
  const c=selected();
  const seg=`<div class='seg seg-page' role='tablist' aria-label='Nội dung Bài tập và kiểm tra'><button type='button' role='tab' aria-selected='${asgTab==='asg'}' onclick="asgTabSet('asg')">${ic('assignments',16)}<span>Bài tập</span></button><button type='button' role='tab' aria-selected='${asgTab==='quiz'}' onclick="asgTabSet('quiz')">${ic('assessments',16)}<span>Bài kiểm tra</span></button></div>`;
  const scopeKey=sc=>!sc||sc.type==='course'?'course':sc.type==='topic'?'t'+sc.id:'l'+(sc.ref?sc.ref.name:'?');
  const assignmentCard=({a,i})=>`<details class='work-card'><summary><span class='work-detail'><b>${esc(a.name)}</b> <span class='pill ${a.status==='Nháp'?'plain':'good'}'>${esc(a.status)}</span> <span class='pill prog'>${asgIsQ(a)?'Bộ câu hỏi · '+a.qs.length+' câu':'Nộp tệp hoặc bài tự luận'}</span><div class='muted' style='margin-top:4px'>Hạn ${esc(a.due)}${a.allowLate?' · nộp trễ đến '+esc(a.lateClose||''):''} · ${a.submitted}/${c.count} nộp · ${a.graded} đã chấm · tối đa ${a.max} điểm${a.rubric&&a.rubric.length?' · Có rubric '+a.rubric.length+' tiêu chí':''}${a.objs.length?' · Mục tiêu: '+a.objs.map(j=>esc(codeOf(c,j))).join(', '):''}</div></span><span class='pill plain'>Mở chi tiết</span></summary><div class='work-actions'>${asgIsQ(a)?`<button class='btn light' onclick='asgOpen(${i})'>Soạn câu hỏi</button>`:`<button class='btn light' onclick='rubricEditor(${i})' ${rubricLocked(a)?'disabled title="Đã có bài nộp — rubric đã khóa"':''}>${a.rubric&&a.rubric.length?'Sửa rubric':'Thiết lập rubric'}</button>`}<button class='btn light' onclick='goGrade(${i})'>Chấm điểm</button><button class='btn light' onclick='asgPrev(${i})'>Xem trước</button><button class='btn light' onclick='togAsg(${i})'>${a.status==='Nháp'?'Xuất bản':'Hủy xuất bản'}</button><button class='btn light' onclick='editAsg(${i})'>Sửa</button><button class='btn light' onclick='delAsg(${i})'>Xóa</button></div><div class='muted' style='margin-top:8px'>${esc(a.desc||'Bài tập theo bộ câu hỏi đã chọn.')}</div></details>`;
  const quizCard=()=>`<details class='work-card'><summary><span class='work-detail'><b>${esc(c.quiz.name)}</b> <span class='pill prog'>Bài tập</span> <span class='pill ${c.quiz.status==='Nháp'?'plain':'good'}'>${esc(c.quiz.status)}</span><div class='muted' style='margin-top:4px'>${c.quiz.dur} phút · ${c.maxAtt} lượt tối đa · ${c.quiz.open}–${c.quiz.close} · ${qMax(c)} điểm</div></span><span class='pill plain'>Mở chi tiết</span></summary><div style='margin-top:8px'>${quizPanel(c)}</div></details>`;
  const topics=c.topics||[];let groups='';
  topics.forEach(t=>{
    const key='t'+t.id,la=c.lessonsData.filter(l=>l.tid===t.id),items=c.assignments.map((a,i)=>({a,i})).filter(x=>scopeKey(x.a.scope)===key);
    const qOn=!c.quiz.deleted&&scopeKey(c.quiz.scope)===key;
    const lessonHtml=la.map(l=>{const ik='l'+l.name,its=c.assignments.map((a,i)=>({a,i})).filter(x=>scopeKey(x.a.scope)===ik),qHere=!c.quiz.deleted&&scopeKey(c.quiz.scope)===ik;if(asgTab==='asg'&&!its.length||asgTab==='quiz'&&!qHere)return '';return `<details class='scope-lesson'><summary><b>${esc(l.name)}</b><span class='pill plain'>${asgTab==='asg'?its.length+' bài tập':'Bài tập'}</span></summary>${asgTab==='asg'?its.map(assignmentCard).join(''):quizCard()}</details>`}).join('');
    const rootItems=asgTab==='asg'?items.map(assignmentCard).join(''):(qOn?quizCard():'');
    const n=asgTab==='asg'?items.length:(qOn?1:0);
    const gTopic=`<details class='scope-group'><summary><span><b>Chủ đề: ${esc(t.title)}</b><span class='muted'> · ${la.length} bài học</span></span><span class='pill plain'>${n} bài tập</span></summary>${rootItems}${lessonHtml}</details>`;
    if(n||lessonHtml)groups+=gTopic;
  });
  const courseItems=c.assignments.map((a,i)=>({a,i})).filter(x=>scopeKey(x.a.scope)==='course');
  const qc=!c.quiz.deleted&&scopeKey(c.quiz.scope)==='course';
  const gCourse=`<details class='scope-group'><summary><span><b>Cấp lớp</b><span class='muted'> · nội dung tổng hợp</span></span><span class='pill plain'>${asgTab==='asg'?courseItems.length+' bài tập':(qc?'1 bài tập':'0 bài tập')}</span></summary>${asgTab==='asg'?courseItems.map(assignmentCard).join(''):(qc?quizCard():'')}</details>`;
  if(asgTab==='asg'?courseItems.length:qc)groups+=gCourse;
  
  const intro=`<div class='row asg-plusbar'><button class='btn' onclick='addAssignment()'>${ic('plus',16)}Tạo bài tập</button></div>`;
  return seg+intro+(asgTab==='asg'?groups+trashPanel(c,['Bài tập']):groups)+(asgTab==='asg'?asgBuilder(c):'');
}
let grItemType='asg';
function grTabSet(t){grTab=t;render()}
function grChooseItem(v){const [kind,idx]=String(v).split(':');grItemType=kind;gradeAi=+idx||0;grTab='mark';grMore=15;render()}
