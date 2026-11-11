/* EducMind · js/12-content-edit.js
   Sửa / xóa mềm: lớp, chủ đề, bài học, mục tiêu, tài liệu, bài tập, bài kiểm tra. */
/* --- Lớp --- */
function editClass(){
  const c=selected();
  openDlg({title:'Sửa lớp',fields:[{k:'id',label:'Tên lớp',hint:'Khối lấy theo tên lớp — ví dụ 11B2 là khối 11, lớp B2.',val:c.id}],ok:v=>{
    const p=parseClassId(v.id);
    if(!String(v.id||'').trim())return 'Tên lớp không được để trống.';
    if(!p)return CLS_ERR;
    const n=p.id;
    if(classes.some(x=>x!==c&&x.id===n))return 'Đã có lớp trùng tên.';
    c.id=n;c.grade=p.grade;current=n;toast('Đã lưu thông tin lớp');return null}});
}
function delClass(){
  const c=selected();
  if(visClasses().length<2){toast('Không thể xóa lớp duy nhất.');return}
  openDlg({title:'Xóa lớp '+esc(c.id)+'?',text:'Lớp có '+c.count+' học sinh và dữ liệu học tập bên trong. Nội dung không còn hiển thị, điểm và bằng chứng vẫn được giữ.',danger:true,okLabel:'Xóa lớp',ok:()=>{
    DELCLS.push({id:c.id,owner:c.owner,at:stamp()});classes.splice(classes.indexOf(c),1);current=visClasses()[0].id;toast('Đã xóa mềm lớp');return null}});
}
/* --- Chủ đề, bài học, mục tiêu, tài liệu --- */
function lessonCard(c,l,li){
  return `<div class="item" style="display:block"><div class="row between"><div><b>${esc(l.name)}</b><div class="muted">${esc(l.desc)}</div></div><span class="pill ${l.status==='Nháp'?'plain':'good'}">${l.status}</span></div>
  <div style="margin-top:10px"><b style="font-size:13px">Mục tiêu học tập</b>${l.objs.map((o,oi)=>`<div class="row between" style="padding:5px 0"><span><b>${esc(o.code)}</b> ${esc(o.desc)} <span class="muted">· ${evCount(c,o.idx)} bằng chứng</span></span><span class="row"><button class="btn light" onclick="editObj(${li},${oi})" aria-label="Sửa mục tiêu ${esc(o.code)}">Sửa</button><button class="btn light" onclick="delObj(${li},${oi})" aria-label="Xóa mục tiêu ${esc(o.code)}">Xóa</button></span></div>`).join('')||'<div class="muted">Chưa có mục tiêu.</div>'}</div>
  <div style="margin-top:10px"><b style="font-size:13px">Tài liệu</b> <span class="muted">tối đa 50 MB · ${ALLOWED.join(', ').toUpperCase()}</span>${l.res.map((r,ri)=>`<div class="row between" style="padding:5px 0"><span>${esc(r.name)} <span class="muted">· ${fsize(r.size)}</span></span><span class="row"><button class="btn light" onclick="pickFile(${li},${ri})" aria-label="Thay tệp ${esc(r.name)}">Thay tệp</button><button class="btn light" onclick="delRes(${li},${ri})" aria-label="Xóa tệp ${esc(r.name)}">Xóa</button></span></div>`).join('')||'<div class="muted">Chưa có tài liệu.</div>'}</div>
  <div class="row" style="margin-top:12px"><button class="btn light" onclick="pickFile(${li},-1)">${ic('plus',16)}Đính kèm tài liệu</button><button class="btn light" onclick="editLesson(${li})">Sửa bài học</button><button class="btn light" onclick="togglePub(${li})">${l.status==='Nháp'?'Xuất bản':'Hủy xuất bản'}</button><button class="btn light" onclick="delLesson(${li})">Xóa bài học</button></div>
  ${l.upd?`<div class="muted" style="font-size:12px;margin-top:6px">Sửa gần nhất: ${l.upd}</div>`:''}</div>`;
}
function trashLesson(c,l){c.trash.unshift({type:'Bài học',name:l.name,note:'Mục tiêu, bằng chứng, mức nắm vững được giữ; gợi ý liên quan hết hiệu lực',objIdx:l.objs.map(o=>o.idx),at:stamp()})}
function editLesson(li){
  const c=selected(),l=c.lessonsData[li];
  openDlg({title:'Sửa bài học',text:'Sửa tiêu đề và mô tả tự do, kể cả khi bài học đã xuất bản.',fields:[{k:'n',label:'Tiêu đề',val:l.name},{k:'d',label:'Mô tả',val:l.desc,area:true}],ok:v=>{
    if(!v.n.trim())return 'Bài học phải có tiêu đề.';l.name=v.n.trim();l.desc=v.d.trim();l.upd=stamp();toast('Đã lưu bài học');return null}});
}
function togglePub(li){
  const l=selected().lessonsData[li];
  if(l.status==='Nháp'){if(!l.objs.length){toast('Bài học chưa có mục tiêu học tập nên không xuất bản được.');return}l.status='Đã xuất bản';notifyClass(selected(),'NEW_LESSON_PUBLISHED','Bài học mới: '+l.name,{page:'lessons',c:selected(),ref:l});toast('Đã xuất bản bài học và gửi thông báo cho '+selected().students.length+' học sinh')}
  else{l.status='Nháp';toast('Đã hủy xuất bản; dữ liệu học tập vẫn được giữ')}
  l.upd=stamp();render();
}
function editObj(li,oi){
  const c=selected(),l=c.lessonsData[li],o=l.objs[oi],n=evCount(c,o.idx);
  openDlg({title:'Sửa mục tiêu '+esc(o.code),text:n?'Mục tiêu đã có '+n+' bằng chứng: chỉ sửa được mô tả, không đổi được mã.':'Mục tiêu chưa có bằng chứng nên đổi được cả mã.',fields:[{k:'c',label:'Mã mục tiêu',val:o.code},{k:'d',label:'Mô tả',val:o.desc,area:true}],ok:v=>{
    const code=v.c.trim();
    if(!code||!v.d.trim())return 'Mã và mô tả không được để trống.';
    if(code!==o.code){
      if(n)return 'Không đổi được mã: mục tiêu đã có bằng chứng học tập, đổi mã sẽ làm thay đổi ý nghĩa mức nắm vững.';
      if(l.objs.some(x=>x!==o&&x.code===code))return 'Mã mục tiêu bị trùng trong cùng bài học.';
      o.code=code}
    o.desc=v.d.trim();c.goals[o.idx]=o.desc;l.upd=stamp();toast('Đã lưu mục tiêu');return null}});
}
function delObj(li,oi){
  const c=selected(),o=c.lessonsData[li].objs[oi];
  if(evCount(c,o.idx)){toast('Không xóa được '+o.code+': mục tiêu đã có bằng chứng học tập.');return}
  c.lessonsData[li].objs.splice(oi,1);render();
}
function delLesson(li){
  const c=selected(),l=c.lessonsData[li],n=l.objs.reduce((s,o)=>s+evCount(c,o.idx),0);
  openDlg({title:'Xóa bài học “'+esc(l.name)+'”?',text:n?'Bài học đã phát sinh '+n+' bằng chứng học tập. Học sinh không còn thấy bài học; mục tiêu, bằng chứng và mức nắm vững vẫn được giữ kèm nhãn “Bài học đã xóa”, gợi ý liên quan hết hiệu lực.':'Bài học sẽ không còn hiển thị cho học sinh.',danger:true,okLabel:'Xóa bài học',ok:()=>{
    trashLesson(c,l);c.lessonsData.splice(li,1);LOG.unshift('Xóa bài học “'+l.name+'” ('+c.id+'): gợi ý liên quan chuyển sang hết hiệu lực; mức nắm vững được giữ');toast('Đã xóa mềm bài học');return null}});
}
function pickFile(li,ri){
  const inp=document.createElement('input');inp.type='file';
  inp.onchange=()=>{
    const f=inp.files[0];if(!f)return;
    const c=selected(),l=c.lessonsData[li],ext=f.name.split('.').pop().toLowerCase();
    if(f.size>52428800){toast('Tệp '+fsize(f.size)+' vượt giới hạn 50 MB, bị từ chối.');return}
    if(!ALLOWED.includes(ext)){toast('Định dạng .'+ext+' không được phép. Cho phép: '+ALLOWED.join(', ')+'.');return}
    const before=revisionSnapshot(c),r={name:f.name,size:f.size,blob:f};if(ri>=0)l.res[ri]=r;else l.res.push(r);
    l.upd=stamp();recordRevision(c,ri>=0?'Thay tệp tài liệu':'Đính kèm tài liệu',before,revisionSnapshot(c));render();toast(ri>=0?'Đã thay tệp tài liệu':'Đã đính kèm tài liệu');
  };
  inp.click();
}
function delRes(li,ri){
  const c=selected(),l=c.lessonsData[li],r=l.res[ri];
  openDlg({title:'Xóa tài liệu?',text:esc(r.name)+' sẽ không còn tải được đối với học sinh.',danger:true,okLabel:'Xóa tài liệu',ok:()=>{
    c.trash.unshift({type:'Tài liệu',name:r.name,note:'Thuộc bài học “'+esc(l.name)+'”; học sinh không còn tải được',objIdx:[],at:stamp()});l.res.splice(ri,1);toast('Đã xóa mềm tài liệu');return null}});
}
/* --- Bài tập ---
   Nút “Tạo bài tập” mở trình tạo 3 bước (asgBuilder): chọn nguồn nội dung, gắn phạm vi bài học,
   tick câu hỏi theo mục tiêu hoặc tải tệp lên, xem trước rồi lưu nháp / xuất bản.
   Trước đây ở đây còn một hàm addAssignment() khai báo trùng tên, chỉ đẩy vào danh sách một bản nháp
   không có phạm vi nên không hiện ở đâu và che mất trình tạo 3 bước; hàm trùng đó đã được bỏ. */
function editAsg(i){
  const c=selected(),a=c.assignments[i],used=Math.max(0,...a.subs.map(b=>(b.tries||(b.has?1:0))-(b.extra||0)));
  openDlg({title:'Sửa bài tập',text:asgIsQ(a)?'Nội dung câu hỏi của bài tập không sửa ở đây: hãy dùng nút “Soạn câu hỏi” để chọn câu từ Ngân hàng câu hỏi hoặc nhập từ tệp. Ô bên dưới chỉ là lời dặn thêm cho học sinh.':'',fields:[{k:'n',label:'Tiêu đề',val:a.name},{k:'d',label:asgIsQ(a)?'Lời dặn thêm cho học sinh (không bắt buộc — đề bài được dựng từ các câu hỏi đã chọn)':'Đề bài (bắt buộc: nêu rõ yêu cầu và sản phẩm cần nộp)',val:a.desc,area:true},{k:'due',label:'Hạn nộp (dd/mm/yyyy)',val:a.due},{k:'m',label:'Điểm tối đa'+(a.graded?' (đã khóa vì có bài được chấm)':''),val:a.max},{k:'t',label:'Số lần làm tối đa'+(used?' (không thấp hơn '+used+', số lượt học sinh đã dùng)':''),val:a.maxTries==null?'':a.maxTries}],ok:v=>{
    const m=parseFloat(String(v.m).replace(',','.'));
    if(!v.n.trim())return 'Bài tập phải có tiêu đề.';
    if(!asgIsQ(a)&&!v.d.trim())return 'Loại nộp tệp cần có đề bài để học sinh biết phải làm gì.';
    if(!/^\d{2}\/\d{2}\/\d{4}$/.test(v.due.trim()))return 'Hạn nộp cần đúng dạng dd/mm/yyyy.';
    if(!(m>0)&&!asgIsQ(a))return 'Điểm tối đa phải lớn hơn 0.';
    if(asgIsQ(a)&&m!==a.max)return 'Điểm tối đa của bộ câu hỏi tự cộng từ điểm từng câu; hãy chỉnh điểm ở mục Soạn câu hỏi.';
    {const tr=String(v.t).trim();if(!/^\d+$/.test(tr)||+tr<1)return 'Số lần làm tối đa phải là số nguyên từ 1 trở lên.';if(+tr<used)return 'Không đặt thấp hơn số lượt học sinh đã dùng ('+used+' lượt).'}
    if(m!==a.max&&a.graded)return 'Không đổi được điểm tối đa: bài tập đã có bài được chấm, đổi sẽ làm lệch bằng chứng học tập.';
    a.name=v.n.trim();a.desc=v.d.trim();a.due=v.due.trim();if(!asgIsQ(a))a.max=m;a.maxTries=parseInt(v.t,10);a.upd=stamp();toast('Đã lưu bài tập');return null}});
}
function delAsg(i){
  const c=selected(),a=c.assignments[i];
  openDlg({title:'Xóa bài tập “'+esc(a.name)+'”?',text:a.submitted?'Bài tập đã có '+a.submitted+' bài nộp ('+a.graded+' đã chấm). Bài tập ẩn khỏi danh sách làm bài; điểm và bằng chứng vẫn được giữ, học sinh xem kết quả ở chế độ chỉ đọc.':'Bài tập chưa có bài nộp.',danger:true,okLabel:'Xóa bài tập',ok:()=>{
    c.trash.unshift({type:'Bài tập',name:a.name,ref:a,note:'Điểm và bằng chứng học tập vẫn được giữ',objIdx:[],at:stamp()});c.assignments.splice(i,1);gradeAi=0;toast('Đã xóa mềm bài tập');return null}});
}
/* --- Bài tập --- */
function assessmentsPage(){
  const c=selected();
  if(c.quiz.deleted)return `<section class="panel"><h2>Bài tập · ${esc(c.id)}</h2><div class="empty">Chưa có bài tập nào.</div></section>${trashPanel(c,['Bài tập'])}`;
  return assessments()+`<section class="panel" aria-labelledby="h-qm"><h2 id="h-qm">Quản lý bài tập</h2><p class="lead">${esc(c.quiz.name)} · ${c.quiz.dur} phút · tối đa ${c.maxAtt} lượt. Danh sách câu hỏi không sửa được khi đã có người làm.${c.quiz.upd?' Sửa gần nhất: '+c.quiz.upd+'.':''}</p><div class="row"><button class="btn light" onclick="editQuiz()">Sửa bài tập</button><button class="btn light" onclick="delQuiz()">Xóa bài tập</button></div></section>`;
}
function delQuiz(){
  const c=selected(),n=c.students.reduce((s,x)=>s+x.att.used,0);
  openDlg({title:'Xóa bài kiểm tra?',text:'Bài đã có '+n+' lượt làm. Bài ẩn khỏi danh sách làm bài; điểm và bằng chứng vẫn được giữ, gợi ý làm lại bài hết hiệu lực.',danger:true,okLabel:'Xóa bài kiểm tra',ok:()=>{
    c.quiz.deleted=true;c.trash.unshift({type:'Bài tập',name:c.quiz.name,note:'Điểm và bằng chứng học tập vẫn được giữ',objIdx:[],at:stamp()});toast('Đã xóa mềm bài kiểm tra');return null}});
}
/* --- US-T03: tạo, xuất bản bài tập --- */
function togAsg(i){
  const c=selected(),a=c.assignments[i];
  if(a.status==='Nháp'){if(dueMs(a)<=simNow()){toast('Hạn nộp đã nằm trong quá khứ nên không xuất bản được.');return}if(!(a.maxTries>=1)){toast('Chưa xuất bản được: hãy cấu hình số lần làm tối đa cho bài tập (nút Sửa).');return}if(asgIsQ(a)&&!(a.qs&&a.qs.length)){toast('Chưa xuất bản được: bài tập chưa có câu hỏi nào (nút Soạn câu hỏi).');return}a.status='Đã xuất bản';notifyClass(c,'NEW_ASSIGNMENT_PUBLISHED','Bài tập mới: '+a.name,{page:'assignments',c,ref:a});toast('Đã xuất bản bài tập và gửi thông báo cho '+c.students.length+' học sinh của lớp')}
  else{if(a.submitted>0||asgWork(a)){toast('Bài tập đã có học sinh làm hoặc nộp nên không hủy xuất bản được.');return}a.status='Nháp';toast('Đã đưa bài tập về nháp')}
  a.upd=stamp();render();
}
