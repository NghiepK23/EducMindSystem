/* EducMind · js/66-grading-picker.js
   Ô tìm bài cần chấm và chuyển tới trang chấm điểm (goGrade). */
/* ===== Ô tìm kiếm bài cần chấm (icon-only ở góc phải khung Chấm điểm & Kết quả) ===== */
let grpOv=null;
function grPickClose(){if(grpOv){grpOv.remove();grpOv=null}const b=document.querySelector('.grp-btn');if(b)b.focus({preventScroll:true})}
function grPickFilter(q){
  if(!grpOv)return;
  const k=String(q||'').trim().toLowerCase();let n=0;
  [...grpOv.querySelectorAll('.grp-item')].forEach(b=>{const hit=!k||(b.dataset.txt||'').indexOf(k)>=0;b.hidden=!hit;if(hit)n++});
  const em=grpOv.querySelector('#grp-empty');if(em)em.hidden=n>0;
}
function grPickChoose(k){grPickClose();folderGradePick(k)}
function grPickStat(c,w){
  if(w.kind==='quiz'){
    const n=c.students.reduce((t,s)=>t+(s.atts||[]).filter(x=>x.status&&x.status!=='IN_PROGRESS').length,0);
    return n?n+' lượt đã nộp':'chưa có lượt nộp';
  }
  const a=c.assignments[w.i],sub=a.submitted||0,pend=Math.max(0,sub-(a.graded||0));
  return sub?sub+' bài nộp · '+pend+' chờ chấm':'chưa có bài nộp';
}
function grPickOpen(){
  if(grpOv){grPickClose();return}
  const c=selected(),r=folderResolve(c),t=r.t,l=r.l;
  if(!t||!l){toast('Mở một bài học trước, rồi chọn bài tập hoặc bài kiểm tra cần chấm.');return}
  const works=gradeWorks(c,t,l),cur=works.find(w=>w.kind===grItemType&&(w.kind==='asg'?w.i===gradeAi:true));
  const items=works.map(w=>{
    const on=!!cur&&w.kind===cur.kind&&(w.kind!=='asg'||w.i===cur.i);
    return `<button type='button' class='grp-item${on?' on':''}' role='option' aria-selected='${on}' data-txt='${esc((w.label+' '+w.meta).toLowerCase())}' onclick="grPickChoose('${w.kind}:${w.i}')"><span class='grp-ic'>${ic(w.kind==='quiz'?'assessments':'assignments',18)}</span><span class='grp-txt'><b>${esc(w.label)}</b><span class='muted'>${esc(w.meta)} · ${esc(grPickStat(c,w))}</span></span>${on?`<span class='pill good'>Đang chọn</span>`:''}</button>`;
  }).join('');
  const ov=document.createElement('div');
  ov.className='ov grp-ov';
  ov.innerHTML=`<div class='dlg grp-dlg' role='dialog' aria-modal='true' aria-labelledby='grp-t'>
    <div class='grp-head'><h2 id='grp-t'>Chọn bài để chấm</h2><button type='button' class='btn light icon-only' data-iconified='1' aria-label='Đóng' onclick='grPickClose()'>${ic('close',16)}</button></div>
    <p class='muted' style='margin:2px 0 0'>Bài học · <b>${esc(l.name)}</b> · ${works.length} bài</p>
    <div class='grp-search'>${ic('search',16)}<input id='grp-find' type='search' autocomplete='off' placeholder='Tìm bài tập, bài kiểm tra…' aria-label='Tìm bài tập hoặc bài kiểm tra trong bài học này' oninput='grPickFilter(this.value)' onkeydown="if(event.key==='Escape')grPickClose()"></div>
    <div class='grp-list' id='grp-list' role='listbox' aria-labelledby='grp-t'>${items||`<div class='folder-empty'>Bài học này chưa có bài tập hay bài kiểm tra nào để chấm.</div>`}</div>
    <div id='grp-empty' class='folder-empty' hidden>Không có bài nào khớp từ khoá.</div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)grPickClose()});
  document.body.appendChild(ov);
  grpOv=ov;
  const inp=ov.querySelector('#grp-find');if(inp)inp.focus();
}
function goGrade(i){grItemType='asg';gradeAi=i;grTab='mark';setPage('grading')}





function folderQuestions(c,l){
  const J=(l.objs||[]).map(x=>x.idx),Q=c.bank.map((q,i)=>({q,i})).filter(x=>!x.q.del&&(x.q.objs||[]).some(j=>J.includes(j)));
  return `<section class='panel'><div class='row between' style='flex-wrap:wrap'><div><h2>Ngân hàng câu hỏi · ${esc(l.name)}</h2><p class='lead' style='margin:4px 0 0'>Chỉ hiển thị câu hỏi gắn với mục tiêu của bài học.</p></div><button class='btn' onclick='editQ(-1)'>${ic('plus',16)}Thêm câu hỏi</button></div>${Q.length?`<div class='tablewrap'><table><thead><tr><th>Câu hỏi</th><th>Loại</th><th>Mục tiêu</th><th></th></tr></thead><tbody>${Q.map(({q,i})=>`<tr><td>${esc(q.content)}</td><td>${QT[q.type]}</td><td>${q.objs.map(j=>esc(codeOf(c,j))).join(', ')}</td><td><button class='btn light' onclick='editQ(${i})'>Sửa</button></td></tr>`).join('')}</tbody></table></div>`:`<div class='folder-empty'>Chưa có câu hỏi nào gắn với mục tiêu bài học.</div>`}</section>`;
}
