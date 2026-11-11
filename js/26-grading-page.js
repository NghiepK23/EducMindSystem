/* EducMind · js/26-grading-page.js
   Trang Chấm điểm & Kết quả của giáo viên. */
/* --- Trang Chấm điểm: thẻ số liệu + bảng chấm + tiến độ + lượt làm --- */
function gradingPage(){
  const c=selected();
  const works=c.assignments.map((a,i)=>({kind:'asg',i,label:a.name,meta:scopeLbl(c,a.scope),type:'Bài tập'}));
  if(!c.quiz.deleted)works.push({kind:'quiz',i:0,label:c.quiz.name,meta:scopeLbl(c,c.quiz.scope),type:'Bài kiểm tra'});
  if(!works.some(w=>w.kind===grItemType))grItemType=works[0]?.kind||'asg';
  const sel=works.find(w=>w.kind===grItemType&&w.i===(grItemType==='asg'?gradeAi:0))||works.find(w=>w.kind===grItemType)||works[0];
  if(sel&&sel.kind==='asg')gradeAi=sel.i;
  const options=works.map(w=>`<option value='${w.kind}:${w.i}' ${sel===w?'selected':''}>${esc(w.type)} · ${esc(w.label)} — ${esc(w.meta)}</option>`).join('');
  const tab=`<div class='seg seg-page' role='tablist' aria-label='Chấm điểm, kết quả và phân tích'><button type='button' role='tab' aria-selected='${grTab!=='result'&&grTab!=='analysis'}' onclick="grTabSet('mark')">${ic('grade',16)}<span>Chấm điểm</span></button><button type='button' role='tab' aria-selected='${grTab==='result'}' onclick="grTabSet('result')">${ic('trend',16)}<span>Kết quả</span></button><button type='button' role='tab' aria-selected='${grTab==='analysis'}' onclick="grTabSet('analysis')">${ic('mastery',16)}<span>Phân tích</span></button></div>`;
  if(!sel)return tab+`<section class='panel'><div class='empty'><div>Chưa có bài tập nào để chấm.</div><div class='row' style='justify-content:center;gap:8px;margin-top:12px'><button class='btn' onclick='seedGradingDemo()'>${ic('spark',16)}Nạp dữ liệu mẫu để kiểm tra</button><button class='btn light' onclick='setPage("assignments")'>Tạo bài tập</button></div></div></section>`;
  const isQ=sel.kind==='quiz',a=isQ?null:c.assignments[sel.i];
  const gv=a?a.subs.map(x=>x&&x.score).filter(x=>x!=null):[],pend=a?a.subs.filter(x=>x&&x.has&&x.score==null).length:0;
  const head=`<section class='gr-work-head'>
<div class='grh'>
<div class='grh-main'>
<span class='grh-kicker'>${isQ?'Bài kiểm tra':'Bài tập'}</span>
<h2>${esc(sel.label)}</h2>
<div class='grh-meta'><span>${esc(sel.meta)}</span>${isQ?`<span>${c.quiz.dur} phút</span><span>tối đa ${c.maxAtt} lượt</span>`:`<span>${a.submitted}/${c.count} đã nộp</span><span>${a.graded} đã chấm</span>`}</div>
</div>
<div class='grh-right'><div class='selectbox grh-pick'><label for='gr-item'>Chọn bài cụ thể</label><select id='gr-item' onchange='grChooseItem(this.value)'>${options}</select></div><div class='row' style='justify-content:flex-end;gap:8px;margin-top:2px'>${c.assignments.some(x=>x.demo)?`<button class='btn light mini' data-noicon='1' onclick='clearGradingDemo()'>Xoá dữ liệu mẫu</button>`:`<button class='btn light mini' data-noicon='1' onclick='seedGradingDemo()'>${ic('spark',14)}Nạp dữ liệu mẫu</button>`}</div></div>
</div>${tab}</section>`;
  if(grTab==='analysis')return head+anSection(c,isQ?'quiz':'asg',isQ?0:sel.i);
  if(grTab==='result'){
    if(isQ)return head+`<section class='panel'><div class='ab-sec-head'><h2>Kết quả và lượt làm</h2><span class='ab-sum'>${c.quiz.dur} phút · tối đa ${c.maxAtt} lượt</span></div>${attemptsPanel(c)}</section>`;
    const rows=c.students.map((s,i)=>{const b=a.subs[i]||{},tries=pTriesOf(b);return `<tr><td class='student'>${esc(s.name)}</td><td>${b.has?`<span class='pill prog'>Đã nộp</span>${b.status==='LATE'?` <span class='pill plain'>Trễ</span>`:''}`:`<span class='pill plain'>Chưa nộp</span>`}</td><td>${b.score==null?'–':`<b>${b.score}/${a.max}</b>`}</td><td>${tries}</td><td class='muted'>${esc(b.fb||(b.qa||[]).map(x=>x.fb).filter(Boolean).join(' · ')||'–')}</td></tr>`}).join('');
    return head+`<section class='panel'><div class='ab-sec-head'><h2>Kết quả học sinh</h2><span class='ab-sum'>TB ${gv.length?mean(gv).toFixed(1):'–'}/${a.max}</span></div><div class='tablewrap'><table><thead><tr><th>Học sinh</th><th>Trạng thái</th><th>Điểm</th><th>Lượt làm</th><th>Nhận xét</th></tr></thead><tbody>${rows}</tbody></table></div></section>${triesPanel(c)}`;
  }
  if(isQ)return head+`<section class='panel'><div class='ab-sec-head'><h2>Chấm bài kiểm tra</h2><span class='ab-sum'>${c.quiz.qs.length} câu · ${qMax(c)} điểm</span></div><div class='ai-bar'>${ic('spark',16)}<span>AI chấm và nhận xét các lượt làm trước; giáo viên xác nhận trong tab “Phân tích”.</span></div>${attemptsPanel(c)}</section>`;
  return head+`<div class='gr-toolbar'><b>Chấm bài</b><span class='row'><span class='pill ${pend?'need':'good'}'>${pend} chờ xác nhận</span><span class='pill plain'>TB ${gv.length?mean(gv).toFixed(1):'–'}/${a.max}</span></span></div>${grList(c,sel.i,a)}`;
}
