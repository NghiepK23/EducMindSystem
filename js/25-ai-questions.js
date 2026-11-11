/* EducMind · js/25-ai-questions.js
   AI tạo câu hỏi nháp: yêu cầu, bộ sinh mô phỏng, duyệt / từ chối bản nháp. */
/* ===== Đợt 6: AI hỗ trợ giáo viên (US-T09, T10) và thông báo AI (US-G03 một phần) ===== */
P.ai=P.recommend;
TITLES.ai='AI tạo câu hỏi nháp';
const AIQ=5,AIMAXQ=20,AIREQ=[],NOTIFS=[],aiSel=new Set();
let AIRID=0,AIOID=0,aiOpen=null;
const RS={PENDING_REVIEW:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Đã từ chối',EDITED_AND_APPROVED:'Đã sửa và duyệt'};
const AIS={PROCESSING:['Đang xử lý','prog'],COMPLETED:['Hoàn tất','good'],FAILED:['Thất bại','need']};
const aiUsed=()=>AIREQ.filter(r=>r.dayKey===fdate(simNow())&&r.teacher===(sess&&sess.email)).length;
const findOut=id=>AIREQ.flatMap(r=>r.outs).find(o=>o.id===id);
const unread=()=>NOTIFS.filter(n=>!n.read).length;
/* --- Bộ sinh câu hỏi mô phỏng và kiểm tra đầu ra --- */
function genAI(L,r,k){
  const o=r.objs[k%r.objs.length],g=r.c.goals[o],types=['SINGLE_CHOICE','TRUE_FALSE','MULTIPLE_CHOICE','SHORT_ANSWER'];
  const type=r.type==='AUTO'?types[k%4]:r.type,base={obj:o,type,opts:[],ans:null,rs:'PENDING_REVIEW',diff:r.diff==='AUTO'?DFK[k%3]:r.diff,bloom:r.bloom==='AUTO'?BL[(k+1)%BL.length]:r.bloom};
  const n='(AI) Câu '+(k+1)+': ';
  if(type==='SINGLE_CHOICE')return Object.assign(base,{content:n+'Phát biểu nào đúng nhất về “'+g+'” trong bài “'+L.name+'”?',opts:optsOf({ans:k%3}),ans:k%3});
  if(type==='TRUE_FALSE')return Object.assign(base,{content:n+'Nhận định sau đúng hay sai: “'+g+'” là nội dung cốt lõi của bài “'+L.name+'”.',opts:['Đúng','Sai'],ans:0});
  if(type==='MULTIPLE_CHOICE')return Object.assign(base,{content:n+'Chọn tất cả phát biểu đúng liên quan đến “'+g+'”.',opts:['Phát biểu đúng thứ nhất','Phát biểu sai','Phát biểu đúng thứ hai','Phát biểu không liên quan'],ans:[0,2]});
  if(type==='SHORT_ANSWER')return Object.assign(base,{content:n+'Nêu ngắn gọn ý chính của mục tiêu “'+g+'”.'});
  return Object.assign(base,{content:n+'Trình bày và lấy ví dụ minh họa cho “'+g+'”.'});
}
function validAI(lo,o){
  if(!o.content||!o.content.trim()||!lo.includes(o.obj))return false;
  if(isObjT(o.type)){
    if(!o.opts||o.opts.length<2||o.ans==null)return false;
    const a=[].concat(o.ans);
    if(!a.length||a.some(x=>typeof x!=='number'||x<0||x>=o.opts.length))return false;
    if(o.type!=='MULTIPLE_CHOICE'&&a.length!==1)return false;
  }
  return true;
}
function finishAI(r){
  if(r.status!=='PROCESSING')return;
  if(r.mode==='FAIL'){r.status='FAILED';r.err='Dịch vụ AI không phản hồi (mô phỏng lỗi).'}
  else{
    const lo=r.lesson.objs.map(o=>o.idx);let drop=0;
    for(let k=0;k<r.qty;k++){
      const o=genAI(r.lesson,r,k);
      if(r.mode==='INVALID'){if(k%4===3)o.obj=999;else if(k%4===1&&isObjT(o.type))o.ans=null}
      if(validAI(lo,o)){o.id=++AIOID;o.req=r;r.outs.push(o)}else drop++;
    }
    r.drop=drop;
    if(r.outs.length)r.status='COMPLETED';else{r.status='FAILED';r.err='Không có câu nào hợp lệ sau khi kiểm tra.'}
  }
  notify(r.status==='COMPLETED'?'AI_GENERATION_COMPLETED':'AI_GENERATION_FAILED',r.status==='COMPLETED'?'AI đã tạo xong '+r.outs.length+' câu hỏi nháp cho bài “'+r.lesson.name+'” ('+r.c.id+')':'Yêu cầu AI thất bại: '+r.err,r,r.teacher);
  if(logged&&role==='T')render();
}
function updateAIObjSel(lessonName){
  const c=selected();
  const L=c.lessonsData.find(l=>l.name===lessonName);
  if(!L)return;
  const f=dlg.fields.find(f=>f.k==='g');
  if(f){f.chk=L.objs.map(o=>o.code);f.val=f.chk.slice();}
  render();
}

function newAIReq(){
  const c=selected();
  if(!c.lessonsData.length){toast('Lớp chưa có bài học để tạo câu hỏi.');return}
  const firstL=c.lessonsData[0];
  openDlg({title:'Tạo câu hỏi bằng AI',okLabel:'Gửi yêu cầu',text:'AI chỉ nhận: tên lớp, tiêu đề chủ đề, tiêu đề, mô tả và mục tiêu của bài học được chọn. Bản nháp chưa vào ngân hàng câu hỏi và không ảnh hưởng điểm hay mức nắm vững. Còn '+Math.max(0,AIQ-aiUsed())+'/'+AIQ+' lượt hôm nay.',fields:[
    {k:'l',label:'Bài học',val:firstL.name,sel:c.lessonsData.map(l=>l.name),onchange:'updateAIObjSel(this.value)'},
    {k:'g',label:'Mục tiêu cần tạo câu hỏi',chk:firstL.objs.map(o=>o.code),val:firstL.objs.map(o=>o.code)},
    {k:'n',label:'Số lượng (tối đa '+AIMAXQ+')',val:'5'},
    {k:'t',label:'Loại câu hỏi (tùy chọn)',val:'Tự động',sel:['Tự động'].concat(QTV)},
    {k:'d',label:'Độ khó (tùy chọn)',val:'Tự động',sel:['Tự động'].concat(DFV)},
    {k:'b',label:'Mức Bloom (tùy chọn)',val:'Tự động',sel:['Tự động'].concat(BL)}
  ],ok:v=>{
    const L=c.lessonsData.find(l=>l.name===v.l),qty=parseInt(v.n,10);
    if(!L)return 'Hãy chọn một bài học.';
    if(!(qty>=1&&qty<=AIMAXQ))return 'Số lượng phải từ 1 đến '+AIMAXQ+'.';
    if(aiUsed()>=AIQ)return 'Đã hết lượt yêu cầu AI trong ngày (tối đa '+AIQ+' lượt, tính theo giờ Việt Nam). Thử lại vào ngày hôm sau.';
    const cm={};L.objs.forEach(o=>{cm[o.code.toUpperCase()]=o.idx});
    let objs=[];const codes=(v.g||[]).map(x=>String(x).trim().toUpperCase()).filter(Boolean);
    if(!codes.length)objs=L.objs.map(o=>o.idx);
    else for(const t of codes){if(!(t in cm))return 'Mục tiêu '+esc(t)+' không thuộc bài học đã chọn. Mã hợp lệ: '+L.objs.map(o=>o.code).join(', ')+'.';if(!objs.includes(cm[t]))objs.push(cm[t])}
    if(!objs.length)return 'Bài học chưa có mục tiêu học tập.';
    const r={id:++AIRID,c,lesson:L,qty,objs,type:v.t==='Tự động'?'AUTO':QTK[QTV.indexOf(v.t)],diff:v.d==='Tự động'?'AUTO':DFK[DFV.indexOf(v.d)],bloom:v.b==='Tự động'?'AUTO':v.b,mode:'OK',status:'PROCESSING',outs:[],dayKey:fdate(simNow()),at:stamp(),teacher:sess.email};
    if(aiForAsg){r.forAsg=aiForAsg;aiForAsg=null}AIREQ.push(r);aiOpen=r.id;setTimeout(()=>finishAI(r),2200);
    toast('Đã ghi nhận yêu cầu, AI đang xử lý. Bạn có thể làm việc khác.');return null}});
}
/* --- Duyệt bản nháp (US-T10) --- */
function approveOne(c,o){
  if(o.rs!=='PENDING_REVIEW')return 'Bản nháp không còn chờ duyệt';
  if(!validAI(o.req.lesson.objs.map(x=>x.idx),o))return 'Nội dung không hợp lệ';
  const q={id:'C'+(QID++),content:o.content,type:o.type,opts:o.opts,ans:o.ans,objs:[o.obj],diff:o.diff,bloom:o.bloom,src:'AI_GENERATED',upd:stamp()};
  normQ(c,q);c.bank.push(q);asgAiAdd(c,o.req,q);o.rs=o.edited?'EDITED_AND_APPROVED':'APPROVED';o.by=acctName();o.at=stamp();o.qid=q.id;aiSel.delete(o.id);
  return null;
}
function approveOut(id){const o=findOut(id),e=approveOne(o.req.c,o);render();toast(e||'Đã duyệt: câu hỏi đã vào ngân hàng (nguồn: AI tạo).')}
const pendSel=()=>[...aiSel].filter(id=>{const o=findOut(id);return o&&o.rs==='PENDING_REVIEW'});
function approveSel(){
  const ids=pendSel(),c=selected();if(!ids.length){toast('Hãy chọn ít nhất một bản nháp chờ duyệt.');return}
  openDlg({title:'Duyệt '+ids.length+' bản nháp?',text:'Bản nháp không hợp lệ sẽ được bỏ qua và báo lại.',okLabel:'Duyệt '+ids.length+' bản nháp',ok:()=>{
    const skip=[];let n=0;ids.forEach(id=>{const o=findOut(id);if(approveOne(c,o))skip.push('#'+id);else n++});
    toast('Đã duyệt '+n+' bản nháp.'+(skip.length?' Bỏ qua '+skip.length+' bản không hợp lệ: '+skip.join(', ')+'.':''));return null}});
}
function rejectOuts(ids){
  ids=ids||pendSel();if(!ids.length){toast('Hãy chọn ít nhất một bản nháp chờ duyệt.');return}
  openDlg({title:'Từ chối '+ids.length+' bản nháp?',text:'Không câu hỏi nào được tạo trong ngân hàng.',danger:true,okLabel:'Từ chối',fields:[{k:'n',label:'Ghi chú (không bắt buộc)',val:''}],ok:v=>{
    ids.forEach(id=>{const o=findOut(id);if(o&&o.rs==='PENDING_REVIEW'){o.rs='REJECTED';o.by=acctName();o.at=stamp();o.note=v.n.trim();aiSel.delete(id)}});toast('Đã từ chối '+ids.length+' bản nháp.');return null}});
}
function editOut(id){
  const o=findOut(id),ch=isObjT(o.type);
  const f=[{k:'c',label:'Nội dung',val:o.content,area:true}];
  if(ch){f.push({k:'o',label:'Phương án (mỗi dòng một phương án)',val:o.opts.join(NL),area:true},{k:'a',label:'Đáp án đúng (số thứ tự, nhiều đáp án cách nhau dấu phẩy)',val:o.ans==null?'':[].concat(o.ans).map(x=>x+1).join(',')})}
  f.push({k:'d',label:'Độ khó',val:DF[o.diff],sel:DFV},{k:'b',label:'Mức Bloom',val:o.bloom,sel:BL});
  openDlg({title:'Chỉnh sửa bản nháp',text:'Lưu chỉnh sửa chưa tạo câu hỏi: bản nháp vẫn chờ duyệt. Nội dung sau sửa vẫn phải đạt yêu cầu như câu tạo thủ công.',okLabel:'Lưu bản nháp',fields:f,ok:v=>{
    const t={content:v.c.trim(),type:o.type,obj:o.obj,opts:o.opts,ans:o.ans};
    if(ch){t.opts=v.o.split(NL).map(x=>x.trim()).filter(Boolean);const n=v.a.split(',').map(x=>parseInt(x,10)-1).filter(x=>!isNaN(x));t.ans=o.type==='MULTIPLE_CHOICE'?[...new Set(n)]:(n.length===1?n[0]:null)}
    if(!validAI(o.req.lesson.objs.map(x=>x.idx),t))return 'Nội dung chưa hợp lệ: cần nội dung, ít nhất 2 phương án và đúng đáp án đúng cho câu trắc nghiệm.';
    Object.assign(o,{content:t.content,opts:t.opts,ans:t.ans,diff:DFK[DFV.indexOf(v.d)],bloom:v.b,edited:true});toast('Đã lưu chỉnh sửa. Bản nháp vẫn chờ duyệt.');return null}});
}
function togSel(id,on){if(on)aiSel.add(id);else aiSel.delete(id);focusId='ck-'+id;render()}
function selAllPend(r){r.outs.filter(o=>o.rs==='PENDING_REVIEW').forEach(o=>aiSel.add(o.id));render()}
/* --- AI nhúng vào nơi giáo viên đang làm việc (không còn tab riêng) --- */
function bankAI(){aiForAsg=null;newAIReq()}
function aiDraftList(c,r,ctx){
  const p=r.outs.filter(o=>o.rs==='PENDING_REVIEW');
  return `<div class='draft'><div class='row between' style='flex-wrap:wrap'><b style='font-size:.875rem'>${p.length} bản nháp chờ duyệt</b><span class='row'><button class='btn light mini' onclick='selAllPend(AIREQ.find(x=>x.id===${r.id}))'>Chọn tất cả</button><button class='btn mini' onclick='approveSel()'>Duyệt đã chọn (${pendSel().length})</button><button class='btn light mini' onclick='rejectOuts()'>Từ chối đã chọn</button></span></div>
<p class='muted' style='font-size:.8125rem;margin:6px 0 0'>Duyệt để ghi câu hỏi vào Ngân hàng câu hỏi${ctx==='asg'?' và thêm thẳng vào bài tập đang soạn':''}; hệ thống ghi người duyệt và thời điểm duyệt. Bản nháp chưa duyệt không ảnh hưởng điểm hay mức nắm vững.</p>
${r.outs.map(o=>{const pd=o.rs==='PENDING_REVIEW';return `<div class='item'><div style='display:flex;gap:10px;align-items:flex-start;min-width:0'>${pd?`<input type='checkbox' id='ck-${o.id}' ${aiSel.has(o.id)?'checked':''} onchange='togSel(${o.id},this.checked)' aria-label='Chọn bản nháp ${o.id}'>`:''}<div style='min-width:0'><b>${esc(o.content)}</b><div class='muted'>${QT[o.type]} · ${DF[o.diff]} · ${o.bloom} · mục tiêu ${codeOf(c,o.obj)}${o.edited?' · đã chỉnh sửa':''}</div>${o.opts.length?`<div class='muted'>${o.opts.map((x,i)=>([].concat(o.ans).includes(i)?'✓ ':'')+esc(x)).join(' · ')}</div>`:''}${pd?'':`<div class='muted' style='font-size:.75rem'>${esc(o.by)}, ${esc(o.at)}${o.note?' · ghi chú: '+esc(o.note):''}${o.qid?' · đã vào ngân hàng câu hỏi':''}</div>`}</div><span class='pill ${pd?'plain':o.rs==='REJECTED'?'need':'good'}'>${RS[o.rs]}</span></div>${pd?`<div class='row' style='margin-top:6px;flex-wrap:nowrap;justify-content:flex-end'><button class='btn mini' onclick='approveOut(${o.id})'>Duyệt</button><button class='btn light mini' onclick='editOut(${o.id})'>Chỉnh sửa</button><button class='btn light mini' onclick='rejectOuts([${o.id}])'>Từ chối</button></div>`:''}</div>`}).join('')}</div>`;
}
function aiReqCard(c,r,ctx){
  const p=r.outs.filter(o=>o.rs==='PENDING_REVIEW').length,open=aiOpen===r.id&&r.status==='COMPLETED';
  return `<div class='item' style='display:block'><div class='row between' style='flex-wrap:wrap'><div style='min-width:0'><b>Bài “${esc(r.lesson.name)}”</b> <span class='muted'>· yêu cầu ${r.qty} câu · mục tiêu ${r.objs.map(j=>codeOf(c,j)).join(', ')} · ${r.at}</span></div><span class='pill ${AIS[r.status][1]}'>${r.status==='PROCESSING'?`<span class='spin'></span>`:''}${AIS[r.status][0]}</span></div>
${r.status==='FAILED'?`<div style='margin-top:6px;color:var(--need);font-size:.8125rem'>Lỗi: ${esc(r.err)}</div>`:''}
${r.status==='COMPLETED'?`<div class='row between' style='margin-top:6px;flex-wrap:wrap'><span class='muted' style='font-size:.8125rem'>${r.outs.length} bản nháp hợp lệ${r.drop?', đã loại '+r.drop+' câu không hợp lệ':''} · ${p} chờ duyệt</span><button class='btn light mini' onclick='aiOpen=${open?'null':r.id};render()'>${open?'Ẩn bản nháp':'Xem bản nháp'}</button></div>`:`<div class='muted' style='margin-top:6px;font-size:.8125rem'>Kết quả sẽ hiện ngay tại đây và có thông báo khi xong; bạn cứ tiếp tục làm việc khác.</div>`}
${open?aiDraftList(c,r,ctx):''}</div>`;
}
function aiInline(c,ctx){
  const cur=ctx==='asg'?asgCur(c):null;
  const R=AIREQ.filter(r=>r.c===c&&(ctx==='asg'?r.forAsg===cur:!r.forAsg)).slice().reverse();
  const proc=R.filter(r=>r.status==='PROCESSING').length;
  const pend=R.reduce((n,r)=>n+r.outs.filter(o=>o.rs==='PENDING_REVIEW').length,0);
  if(ctx==='asg'&&!R.length)return '';
  return `<section class='aicard' aria-labelledby='h-aip'><div class='row between' style='flex-wrap:wrap;gap:8px'><span class='row' style='gap:8px'><span style='color:var(--brand)'>${ic('recommend',17)}</span><b id='h-aip'>AI soạn câu hỏi nháp</b><span class='muted' style='font-size:.8125rem'>· hôm nay ${aiUsed()}/${AIQ} lượt${pend?' · '+pend+' bản nháp chờ duyệt':''}</span></span><span class='row'>${proc?`<span class='pill prog'><span class='spin'></span>Đang tạo</span>`:''}<button class='btn light mini' onclick='${ctx==='asg'?'asgAI()':'bankAI()'}'>${ic('plus',14)}Tạo bằng AI</button></span></div>
${R.length?R.map(r=>aiReqCard(c,r,ctx)).join(''):`<div class='muted' style='font-size:.8125rem;margin-top:8px'>Chưa có yêu cầu AI nào cho ngân hàng của khối này. Bấm “Tạo bằng AI” để soạn nháp câu hỏi theo bài học và mục tiêu.</div>`}</section>`;
}
