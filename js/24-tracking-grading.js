/* EducMind · js/24-tracking-grading.js
   Theo dõi học tập (mức nắm vững, lỗ hổng) và chấm điểm bài tập: lưu điểm, danh sách chấm. */
/* ===== Đợt 5: theo dõi học tập và chấm bài (US-T07, T08, T04) ===== */
let mFil='all',gFilA='all';
classes.forEach(c=>c.assignments.forEach((a,ai)=>{if(a.aid==null)a.aid=ai}));
function evSig(e){return e.length+':'+e.map(x=>x.day+'/'+x.s.toFixed(4)).join(',')}
/* US-T07: mức nắm vững, trung bình lớp, truy ngược bằng chứng */
function mastery(){
  const c=selected(),G=goalsIn(c);
  return `<section class='panel' aria-labelledby='h-ms'>${filterBar(c)}<div class='legend' aria-label='Chú giải mức nắm vững'><span class='pill need'>${ic('alert',14)}Cần ôn · dưới 40%</span><span class='pill prog'>${ic('trend',14)}Đang tiến bộ · 40–69%</span><span class='pill good'>${ic('check',14)}Vững · từ 70%</span></div><p class='scrollhint'>Vuốt ngang để xem thêm →</p>${G.length?`<div class='tablewrap'><table class='sticky-first' style='min-width:${180+G.length*170}px'><thead><tr><th scope='col'>Học sinh</th>${G.map(j=>`<th scope='col' style='min-width:160px'>${esc(gl(c,j))}</th>`).join('')}</tr></thead><tbody><tr><th scope='row' style='font-family:var(--font-body);font-size:13px;color:var(--ink);background:var(--fill)'>Trung bình lớp</th>${G.map(j=>{const v=c.students.map(s=>s.mastery[j]).filter(x=>x!=null);return v.length?`<td><b>${pct(mean(v))}%</b> <span class='muted'>(${v.length}/${c.students.length} học sinh)</span></td>`:`<td class='muted'>Chưa có dữ liệu</td>`}).join('')}</tr>${c.students.map((s,si)=>`<tr><th scope='row' class='student' style='font-family:var(--font-body);font-size:13px;color:var(--ink);background:var(--surface)'>${esc(s.name)}</th>${G.map(j=>{const v=s.mastery[j];if(v==null)return `<td class='muted'>Chưa có dữ liệu</td>`;const t=tier(v);return `<td><button onclick='showEv(${si},${j})' aria-label='Xem bằng chứng của ${esc(s.name)}' style='border:0;background:none;text-align:left;width:100%;padding:0;cursor:pointer;color:inherit;font:inherit'><div class='mcell'><b>${t==='need'?ic('alert',14)+`<span class='sr'>Cần ôn: </span>`:''}${pct(v)}%</b>${bar(v,t,esc(s.name)+' – '+esc(c.goals[j]))}</div></button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`:`<div class='empty'>Không có mục tiêu nào trong phạm vi đã chọn.</div>`}</section>`;
}
function showEv(si,j){
  const c=selected(),s=c.students[si],E=s.ev[j].slice().sort((a,b)=>b.day-a.day);
  const trace=e=>{
    if(e.key&&e.key[0]==='A'){const id=e.key.slice(1),a=c.assignments.find(x=>String(x.aid)===id)||(c.trash.find(t=>t.ref&&String(t.ref.aid)===id)||{}).ref;
      if(a){const b=a.subs[si];return 'Bài nộp của “'+esc(a.name)+'”: '+(b.score!=null?b.score+'/'+a.max:'chưa chấm')}return 'Bài tập không còn trong danh sách'}
    if(e.key==='Q'){const t=s.atts.filter(x=>x.status==='GRADED'&&!x.seed).sort((x,y)=>y.total-x.total)[0];return t?'Lượt '+t.n+' của “'+esc(c.quiz.name)+'”: '+t.total.toFixed(1)+'/'+qMax(c)+' (lượt điểm cao nhất)':'Bài tập'}
    return 'Dữ liệu minh họa ban đầu';
  };
  openDlg({title:esc(s.name)+' · '+esc(gl(c,j)),okLabel:'Đóng',text:`Mức nắm vững hiện tại <b>${pct(s.mastery[j])}%</b>, dựa trên ${E.length} bằng chứng. Trọng số giảm dần theo tuổi bằng chứng.<br><br>`+E.map(e=>`<b>${e.src}</b> · điểm chuẩn hóa <b>${e.s.toFixed(2)}</b> · ${fdate(simNow()-(today-e.day)*864e5)} · trọng số ${Math.pow(.5,(today-e.day)/HL).toFixed(2)}<br><span style='color:var(--subtle)'>${trace(e)}</span>`).join('<br><br>'),ok:()=>null});
}
/* US-T08: lỗ hổng kiến thức, bỏ qua kèm lý do */
function gapPage(){
  const c=selected(),G=goalsIn(c),og=openGaps(c).filter(x=>G.includes(x.j)),ds=[];
  c.students.forEach(s=>G.forEach(j=>{if(s.gaps[j].status==='DISMISSED')ds.push({s,j,g:s.gaps[j]})}));
  return `<section class='panel' aria-labelledby='h-gp'>${filterBar(c)}${og.length?`<div class='tablewrap'><table><thead><tr><th scope='col'>Học sinh</th><th scope='col'>Mục tiêu</th><th scope='col'>Mức nắm vững</th><th scope='col'>Lý do mở</th><th scope='col'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${og.map(x=>`<tr><td class='student'>${esc(x.s.name)}</td><td>${esc(gl(c,x.j))}</td><td style='min-width:120px'><b>${pct(x.s.mastery[x.j])}%</b>${bar(x.s.mastery[x.j],'need','Mức nắm vững: '+esc(x.s.name))}</td><td>${esc(x.g.reason)}</td><td><button class='btn light' onclick='dismissGap(${c.students.indexOf(x.s)},${x.j})'>Bỏ qua</button></td></tr>`).join('')}</tbody></table></div>`:`<div class='empty'>Không có lỗ hổng đang mở trong phạm vi này.</div>`}</section>${ds.length?`<section class='panel' aria-labelledby='h-gd'><h2 id='h-gd' style='font-size:15px'>Đã bỏ qua</h2><p class='lead'>Không tự mở lại cho đến khi học sinh có bằng chứng học tập mới và mức nắm vững vẫn dưới ngưỡng.</p>${ds.map(x=>`<div class='item'><div><b>${esc(x.s.name)}</b> · ${esc(gl(c,x.j))}<div class='muted'>Lý do: ${esc(x.g.dr)} · ${esc(x.g.by)}, ${esc(x.g.dat)}</div></div><span class='pill plain'>Đã bỏ qua</span></div>`).join('')}</section>`:''}`;
}
function dismissGap(si,j){
  const c=selected(),s=c.students[si],g=s.gaps[j];
  openDlg({title:'Bỏ qua lỗ hổng?',text:esc(s.name)+' · '+esc(gl(c,j))+'. Lỗ hổng bỏ qua sẽ không tự mở lại cho đến khi có bằng chứng học tập mới.',okLabel:'Bỏ qua lỗ hổng',fields:[{k:'r',label:'Lý do bỏ qua (bắt buộc)',val:'',area:true}],ok:v=>{
    if(!v.r.trim())return 'Phải nhập lý do bỏ qua.';
    g.status='DISMISSED';g.dr=v.r.trim();g.by=acctName();g.dat=stamp();g.at=today;g.sig=evSig(s.ev[j]);
    LOG.unshift('Bỏ qua lỗ hổng của '+s.name+' ('+c.id+') ở “'+c.goals[j]+'”');toast('Đã bỏ qua lỗ hổng');return null}});
}
/* US-T04: tiến độ nộp (trang Bài tập theo dõi) và bảng chấm (trang Chấm điểm) */
/* --- Chấm điểm: lưu điểm và nhận xét qua hộp thoại (không còn ô nhập rải trong bảng) --- */
function applyGrade(c,a,s,si,v,fb){
  if(a.aid==null)a.aid='n'+Date.now();
  const key='A'+a.aid,before=s.mastery.slice(),gb=s.gaps.map(g=>g.status),sub=a.subs[si];
  sub.score=v;sub.fb=fb;sub.gradedBy=acctName();
  a.objs.forEach(j=>{const x=s.ev[j].find(e=>e.key===key);if(x){x.s=v/a.max;x.day=today}else s.ev[j].push({s:v/a.max,day:today,src:'Bài tập',key});recalcPair(s,j)});
  recalcClass(c);a.graded=a.subs.filter(x=>x.score!=null).length;
  const parts=a.objs.map(j=>{const ch=gb[j]!==s.gaps[j].status&&(s.gaps[j].status==='OPEN'?' (mở lỗ hổng)':s.gaps[j].status==='RESOLVED'?' (đóng lỗ hổng)':'');return c.goals[j]+' '+pct(before[j])+'%→'+pct(s.mastery[j])+'%'+(ch||'')});
  LOG.unshift('Chấm “'+a.name+'” cho '+s.name+' ('+c.id+'): '+parts.join('; '));
  render();toast('Đã lưu điểm và nhận xét; mức nắm vững của '+s.name+' đã được tính lại');
}
function saveGrade(ai,si){
  const c=selected(),a=c.assignments[ai],s=c.students[si],sub=a.subs[si];
  openDlg({title:'Chấm bài · '+esc(s.name),okLabel:'Lưu điểm',text:'Bài “'+esc(a.name)+'” · điểm hợp lệ từ 0 đến '+a.max+'. Lưu điểm sẽ tạo hoặc cập nhật bằng chứng học tập theo mục tiêu gắn với bài tập, rồi tính lại mức nắm vững.',fields:[{k:'v',label:'Điểm',val:sub.score==null?'':sub.score},{k:'f',label:'Nhận xét',val:sub.fb||'',area:true}],ok:v=>{
    const val=parseFloat(String(v.v).replace(',','.'));
    if(isNaN(val)||val<0||val>a.max)return 'Điểm phải từ 0 đến '+a.max+'. Chưa lưu.';
    applyGrade(c,a,s,si,val,String(v.f).trim());return null}});
}
/* --- Danh sách chấm gọn, chịu tải lớp 50 học sinh --- */
let grTab='list',grFind='',grMore=15,grSort='pend';
function grLive(v){grFind=String(v||'').trim().toLowerCase();grMore=15;render()}
function grMoreSet(){grMore+=25;render()}
function grRows(c,a){
  const rows=c.students.map((s,i)=>({s,i,b:a.subs[i]})).filter(r=>{
    if(gFilA==='sub'&&!r.b.has)return false;
    if(gFilA==='nosub'&&r.b.has)return false;
    if(gFilA==='pend'&&!(r.b.has&&r.b.score==null))return false;
    if(gFilA==='done'&&!(r.b.has&&r.b.score!=null))return false;
    if(grFind&&nz(r.s.name).indexOf(nz(grFind))<0)return false;
    return true;
  });
  const rank=r=>!r.b.has?2:(r.b.score==null?0:1);
  const byName=(x,y)=>nz(x.s.name).localeCompare(nz(y.s.name));
  if(grSort==='name')rows.sort(byName);
  else if(grSort==='score')rows.sort((x,y)=>((y.b.score==null?-1:y.b.score)-(x.b.score==null?-1:x.b.score))||rank(x)-rank(y)||byName(x,y));
  else rows.sort((x,y)=>rank(x)-rank(y)||byName(x,y));
  return rows;
}
function grList(c,ai,a){
  /* tự động hoá: vào danh sách chấm là AI chấm ngay các bài đã nộp còn thiếu đề xuất */
  if(typeof aiGradeOne==='function')(a.subs||[]).forEach((b,si)=>{if(b&&b.has&&b.score==null&&!b.ai)aiGradeOne(c,ai,si,true)});
  const rows=grRows(c,a),show=rows.slice(0,grMore),isQ=asgIsQ(a);
  const line=show.map(r=>{
    const b=r.b,st=!b.has?`<span class='pill plain'>Chưa nộp</span>`:b.score!=null?`<span class='pill good'>Đã xác nhận</span>`:b.ai?`<span class='pill prog'>AI đã chấm · chờ xác nhận</span>`:`<span class='pill need'>Chờ AI chấm</span>`;
    return `<tr id='grow-${r.i}'><td class='student'>${esc(r.s.name)}</td><td>${st}${b.has&&b.status==='LATE'?' <span class="pill plain">trễ</span>':''}</td><td>${b.has?(b.score!=null?`<b>${b.score}</b>/${a.max}`:(b.ai?`<span class='muted'>AI: </span><b>${b.ai.score}</b>/${a.max}`:'–')):'–'}</td><td class='muted' style='max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>${esc(b.score!=null?(b.fb||'–'):(b.ai?b.ai.fb:'–'))}</td><td><span class='row' style='flex-wrap:nowrap;justify-content:flex-end'>${b.has?`<button class='btn light mini' data-noicon='1' onclick='anView("asg",${ai},${r.i},"cur")'>Xem bài</button><button class='btn ${b.score==null?'':'light'} mini' data-noicon='1' onclick='confirmDlg(${ai},${r.i})'>${b.score==null?'Xác nhận':'Sửa điểm'}</button><button class='btn light mini' data-noicon='1' title='Tự chấm hoàn toàn bằng tay (ghi đè kết quả AI)' onclick='${isQ?`gradeAsgQ(${ai},${r.i})`:`gradeFileDlg(${ai},${r.i})`}'>Tự chấm</button>`:`<span class='muted'>–</span>`}</span></td></tr>`;
  }).join('');
  return `<section class='panel' aria-labelledby='h-gl'><div class='row between' style='flex-wrap:wrap;gap:10px'><h2 id='h-gl'>Danh sách chấm</h2><span class='row'><div class='selectbox' style='max-width:180px'><label for='gr-s'>Sắp xếp</label><select id='gr-s' onchange='grSort=this.value;render()'><option value='pend' ${grSort==='pend'?'selected':''}>Chờ chấm trước</option><option value='name' ${grSort==='name'?'selected':''}>Theo tên A–Z</option><option value='score' ${grSort==='score'?'selected':''}>Điểm cao trước</option></select></div><div class='selectbox' style='max-width:190px'><label for='gr-f'>Lọc</label><select id='gr-f' onchange='gFilA=this.value;render()'><option value='all' ${gFilA==='all'?'selected':''}>Tất cả (${c.count})</option><option value='sub' ${gFilA==='sub'?'selected':''}>Đã nộp (${a.submitted})</option><option value='pend' ${gFilA==='pend'?'selected':''}>Chờ chấm (${c.students.filter((s,i)=>a.subs[i]&&a.subs[i].has&&a.subs[i].score==null).length})</option><option value='done' ${gFilA==='done'?'selected':''}>Đã chấm (${a.graded})</option><option value='nosub' ${gFilA==='nosub'?'selected':''}>Chưa nộp (${c.count-a.submitted})</option></select></div><span class='row' style='flex-wrap:nowrap'><input id='gr-q' value='${esc(grFind)}' placeholder='Tìm theo tên…' style='min-height:34px;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:400 .8125rem/1.2 var(--font-body)' onkeydown='if(event.key==="Enter")grLive(this.value)' aria-label='Tìm học sinh theo tên'><button class='btn light mini' onclick='grLive(document.getElementById("gr-q").value)'>Lọc</button>${grFind?`<button class='btn light mini' onclick='grLive("")'>Xóa</button>`:''}</span></span></div>
<div class='ai-bar'>${ic('spark',16)}<span>${(()=>{const p=(a.subs||[]).filter(b=>b&&b.has&&b.score==null),n=p.length,k=p.filter(b=>b.ai).length;if(!n)return 'Mọi bài đã nộp đều đã được giáo viên xác nhận. Mở trung tâm AI để xem lại hoặc chạy lại đề xuất.';return `AI đã chấm điểm, viết nhận xét và phân tích lỗi cho <b>${k||n}</b> bài — còn <b>${n}</b> bài chờ giáo viên xác nhận.`})()}</span><span class='row' style='margin-left:auto'><button class='btn mini' data-noicon='1' onclick='aiCenterDlg("asg",${ai})'>Mở trung tâm AI</button></span></div>
${rows.length?`<div class='tablewrap'><table class='grtab'><thead><tr><th scope='col'>Học sinh</th><th scope='col'>Trạng thái</th><th scope='col'>Điểm</th><th scope='col'>Nhận xét</th><th scope='col'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${line}</tbody></table></div>${rows.length>show.length?`<div class='row' style='margin-top:10px'><button class='btn light' onclick='grMoreSet()'>Xem thêm ${Math.min(25,rows.length-show.length)} trong số ${rows.length-show.length} học sinh còn lại</button></div>`:`<div class='muted' style='margin-top:8px;font-size:.8125rem'>Đang hiện đủ ${rows.length} học sinh theo bộ lọc.</div>`}`:`<div class='empty'>Không có học sinh nào khớp bộ lọc đang chọn.</div>`}</section>`;
}
