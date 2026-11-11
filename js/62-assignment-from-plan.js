/* EducMind · js/62-assignment-from-plan.js
   Soạn bài tập từ giáo án (AI đề xuất câu hỏi bám mục tiêu). */
/* ==========================================================================
   Phần 4 — Nguồn “Từ giáo án (AI đề xuất)” trong trình tạo bài tập/bài kiểm tra
   ========================================================================== */
function asgPlanLesson(c){
  if(asgLes&&asgLes!=='all')return c.lessonsData.find(l=>l.name===asgLes)||null;
  const sc=asgDraft&&asgDraft.scopeSel;
  if(sc&&sc.indexOf('Bài học: ')===0)return c.lessonsData.find(l=>l.name===sc.slice(9))||null;
  return c.lessonsData[0]||null;
}
function asgPlanText(v){asgPlan=asgPlan||{};asgPlan.text=v}
function asgPlanClear(){asgPlan=null;render()}
async function asgPlanPick(f){
  if(!f)return;
  try{
    const text=await objPlanFileText(f);
    asgPlan=asgPlan||{};asgPlan.text=text;asgPlan.fileName=f.name;asgPlan.qs=[];
    render();toast('Đã đọc “'+f.name+'”. Bấm “Trích xuất và soạn câu hỏi”.');
  }catch(e){toast(String(e&&e.message||e))}
}
async function asgPlanExtract(){
  const c=selected(),l=asgPlanLesson(c);
  if(!l){toast('Hãy chọn một bài học.');return}
  const text=String((asgPlan&&asgPlan.text)||'');
  if(!text.trim()){toast('Hãy chọn tệp giáo án hoặc dán nội dung giáo án trước.');return}
  const P=await planObjectiveLinesSmart(text),R=parseObjectivesText(P.lines.join('\n'),l);
  asgPlan=asgPlan||{};
  asgPlan.found=P.found;asgPlan.lines=P.lines;asgPlan.objs=R.items;asgPlan.qs=[];
  asgPlan.missing=R.items.filter(o=>!((l.objs||[]).some(x=>nz(c.goals[x.idx]||'')===nz(o.desc))));
  render();
  toast(R.items.length?('Giáo án có '+R.items.length+' mục tiêu'+(asgPlan.missing.length?', '+asgPlan.missing.length+' mục tiêu chưa có trong bài học.':'.')):'Không thấy mục tiêu nào trong giáo án.');
}
function asgPlanAddObjs(){
  const c=selected(),l=asgPlanLesson(c),items=(asgPlan&&asgPlan.objs)||[];
  if(!l||!items.length)return;
  const used=objUsedSet(l);let n=0;
  items.forEach(o=>{
    const k=nz(o.desc);
    if((l.objs||[]).some(x=>nz(c.goals[x.idx]||'')===k))return;
    let code=String(o.code||'').toUpperCase();
    if(!code||used.has(code))code=objNextCode(used);
    used.add(code);
    l.objs.push({code,desc:o.desc,idx:objGoalIndex(c,o.desc)});n++;
  });
  l.upd=stamp();
  if(asgPlan)asgPlan.missing=[];
  render();
  toast(n?('Đã thêm '+n+' mục tiêu vào bài học.'):'Các mục tiêu này đã có trong bài học.');
}
function asgPlanOpts(correct,pool){
  const k=nz(correct),out=[];
  (pool||[]).forEach(x=>{if(out.length<3&&nz(x)!==k&&!out.some(y=>nz(y)===nz(x)))out.push(x)});
  ['Không có nội dung này trong bài học','Nội dung của một bài học khác','Không liên quan tới yêu cầu cần đạt','Chỉ là hoạt động ngoài giờ lên lớp'].forEach(x=>{
    if(out.length<3&&nz(x)!==k&&!out.some(y=>nz(y)===nz(x)))out.push(x);
  });
  const all=[correct].concat(out);
  const rot=all.length?(String(correct).length%all.length):0;
  const mixed=all.slice(rot).concat(all.slice(0,rot));
  return {opts:mixed,ans:mixed.findIndex(x=>nz(x)===k)};
}
function planFacts(text,l){
  const out=[],seen=new Set(),objLines=new Set(planObjectiveLines(text).lines.map(nz));
  String(text==null?'':text).replace(/\r/g,'').split('\n').forEach(raw=>{
    const t=objCleanLine(raw);if(!t||objLines.has(nz(t)))return;
    const m=/^(.{3,70}?)\s*[:–—]\s*(.{12,160})$/.exec(t);
    if(!m)return;
    const term=m[1].trim(),def=m[2].trim();
    if(/^(muc tieu|noi dung|hoat dong|thoi gian|thiet bi|tai lieu|phuong phap|hinh thuc)/.test(nz(term)))return;
    const k=nz(def);if(seen.has(k))return;seen.add(k);
    out.push({term,def});
  });
  return out;
}
function planBestObj(objs,text){
  const w=nz(text).split(/[^a-z0-9]+/).filter(x=>x.length>2);
  let best=0,score=-1;
  objs.forEach((o,i)=>{const t=nz(o.desc);let s=0;w.forEach(x=>{if(t.indexOf(x)>=0)s++});if(s>score){score=s;best=i}});
  return best;
}
function asgPlanMake(){
  const c=selected(),l=asgPlanLesson(c);
  if(!l||!asgPlan)return;
  const n=Math.max(1,Math.min(20,parseInt((asgPlan.n||'6'),10)||6));
  let objs=(asgPlan.objs||[]).map(o=>({code:o.code,desc:o.desc,idx:objGoalIndex(c,o.desc)}));
  if(!objs.length)objs=(l.objs||[]).map(o=>({code:o.code,desc:c.goals[o.idx]||'',idx:o.idx})).filter(o=>o.desc);
  if(!objs.length){toast('Bài học chưa có mục tiêu nào. Hãy trích xuất từ giáo án hoặc thêm mục tiêu trước.');return}
  const facts=planFacts(String(asgPlan.text||''),l);
  const pool=facts.map(f=>f.def).concat(objs.map(o=>o.desc));
  const allObjTexts=c.lessonsData.flatMap(x=>(x.objs||[]).map(o=>c.goals[o.idx]||'')).filter(Boolean);
  const diff=asgPlan.diff||'MEDIUM';
  const factStem=[
    t=>'Theo giáo án bài “'+l.name+'”, nội dung nào sau đây đúng với “'+t+'”?',
    t=>'Trong giáo án bài “'+l.name+'”, “'+t+'” được hiểu là:'
  ];
  const objStem=[
    ()=>'Nội dung nào sau đây là yêu cầu cần đạt của bài “'+l.name+'”?',
    code=>'Mục tiêu '+code+' của bài “'+l.name+'” yêu cầu học sinh:'
  ];
  const F=facts.map((f,i)=>{
    const pick=asgPlanOpts(f.def,pool.filter(d=>nz(d)!==nz(f.def)));
    const k=planBestObj(objs,f.term+' '+f.def);
    return {content:factStem[i%factStem.length](f.term),type:'SINGLE_CHOICE',opts:pick.opts,ans:pick.ans,objs:[objs[k].idx],diff,bloom:'Hiểu'};
  });
  const O=[];
  objs.forEach((o,i)=>{
    const pick=asgPlanOpts(o.desc,allObjTexts.filter(x=>nz(x)!==nz(o.desc)).concat(['Không có nội dung này trong bài học','Nội dung của một bài học khác']));
    O.push({content:objStem[i%objStem.length](o.code),type:'SINGLE_CHOICE',opts:pick.opts,ans:pick.ans,objs:[o.idx],diff,bloom:'Nhớ'});
  });
  const qs=[];let a=0,b=0,guard=0;
  while(qs.length<n&&(a<F.length||b<O.length)&&guard++<200){
    if(a<F.length&&(qs.length%2===0||b>=O.length))qs.push(F[a++]);
    else if(b<O.length)qs.push(O[b++]);
    else qs.push(F[a++]);
  }
  asgPlan.qs=qs;
  render();
  toast(qs.length?('Đã soạn '+qs.length+' câu hỏi đề xuất. Duyệt rồi bấm “Dùng các câu này”.'):'Chưa soạn được câu nào — giáo án quá ngắn.');
}
function asgPlanRm(i){if(!asgPlan||!asgPlan.qs)return;asgPlan.qs.splice(i,1);render()}
function asgPlanCommit(){
  const c=selected(),a=asgDraft,v=asgPlan&&asgPlan.qs;
  if(!a||!v||!v.length)return;
  const w0=parseFloat(String(asgDefW).replace(',','.'))||1;
  v.forEach(q=>{
    const id='C'+(QID++),nq={id,content:q.content,type:q.type,opts:q.opts,ans:q.ans,objs:q.objs,diff:q.diff,bloom:q.bloom,src:'AI',upd:stamp()};
    normQ(c,nq);c.bank.push(nq);
    if(!a.qs.some(x=>x.qid===id))a.qs.push({qid:id,w:w0});
  });
  asgSync(c,a);a.upd=stamp();
  asgPlan=null;asgStepN=3;
  render();window.scrollTo(0,0);
  toast('Đã thêm '+v.length+' câu hỏi soạn từ giáo án vào bài tập (lưu ở ngân hàng, gắn nhãn “AI tạo” để thầy cô rà lại).');
}
function asgPlanPanel(c){
  const l=asgPlanLesson(c);
  if(!l)return `<div class='upbox'><span class='ui'>${ic('spark',18)}</span><div style='flex:1;min-width:0'><b>AI soạn câu hỏi từ giáo án</b><div class='muted' style='margin-top:4px'>Lớp chưa có bài học nào để soạn câu hỏi.</div></div></div>`;
  const S=asgPlan||{},objs=S.objs||[],qs=S.qs||[],miss=S.missing||[];
  const nOpt=[3,5,6,8,10].map(v=>`<option ${String(S.n||'6')===String(v)?'selected':''}>${v}</option>`).join('');
  const dOpt=DFK.map(k=>`<option value='${k}' ${(S.diff||'MEDIUM')===k?'selected':''}>${DF[k]}</option>`).join('');
  const bOpt=BL.map(b=>`<option ${(S.bloom||'Hiểu')===b?'selected':''}>${b}</option>`).join('');
  const objList=objs.length?`<div class='tablewrap' style='max-height:180px;overflow:auto'><table><thead><tr><th scope='col' style='width:110px'>Mã</th><th scope='col'>Mục tiêu đọc được từ giáo án</th><th scope='col' style='width:150px'>Trạng thái</th></tr></thead><tbody>${objs.map(o=>{
    const inLes=(l.objs||[]).some(x=>nz(c.goals[x.idx]||'')===nz(o.desc));
    return `<tr><td><code class='obj-code'>${esc(o.code)}</code></td><td>${esc(o.desc)}</td><td>${inLes?'<span class="pill good">đã có trong bài</span>':'<span class="pill need">chưa có</span>'}</td></tr>`;
  }).join('')}</tbody></table></div>`:'';
  const qList=qs.length?qs.map((q,i)=>`<div class='item'><div><b>Câu ${i+1}. ${esc(q.content)}</b><div class='muted'>${q.objs.length?codeOf(c,q.objs[0]):'Tổng hợp'} · ${QT[q.type]} · ${DF[q.diff]} · ${esc(q.bloom)}</div><div class='muted'>${q.opts.map((o,k)=>(k===q.ans?'✓ ':'')+esc(o)).join(' · ')}</div></div><button class='btn light icon-only' data-iconified='1' aria-label='Bỏ câu ${i+1}' onclick='asgPlanRm(${i})'>${ic('close',14)}</button></div>`).join(''):'';
  return `<div class='ab-plan'><div class='row' style='flex-wrap:wrap;justify-content:flex-end;gap:8px'><span class='row'><button class='btn light' onclick="asgSetSrc('BANK')">Đổi cách tạo</button><button class='btn light' onclick='asgPlanClear()'>Xoá nội dung</button></span></div>
<p class='lead'>Tải giáo án đã soạn sẵn (.docx, .txt, .xlsx) hoặc dán nội dung. Hệ thống tự tìm phần <b>Mục tiêu bài học</b>, đối chiếu với bài <b>“${esc(l.name)}”</b> rồi soạn câu hỏi trắc nghiệm nháp bám theo mục tiêu và nội dung giáo án. Câu chỉ vào bài tập sau khi thầy cô bấm “Dùng các câu này”.</p>
<div class='upbox'><span class='ui'>${ic('spark',18)}</span><div style='flex:1;min-width:0'><b>Tệp giáo án</b><div class='muted' style='margin-top:4px'>${S.fileName?('Đang dùng: '+esc(S.fileName)+' · '+String((S.text||'').split('\n').length)+' dòng'):'Chưa chọn tệp — có thể dán trực tiếp nội dung vào ô bên dưới.'}${S.found===false?' · không thấy tiêu đề “Mục tiêu”, hệ thống đoán theo động từ nhận thức':''}</div><div class='row' style='margin-top:10px'><button class='btn' onclick="document.getElementById('apFile').click()">${ic('plus',16)}Chọn tệp giáo án</button><button class='btn light' onclick='asgPlanExtract()'>Trích xuất và soạn câu hỏi</button></div></div></div>
<input id='apFile' class='sr' tabindex='-1' type='file' accept='.docx,.txt,.md,.csv,.xlsx' onchange='asgPlanPick(this.files[0])'>
<div class='field'><label for='apText'>Hoặc dán nội dung giáo án</label><textarea id='apText' rows='6' oninput='asgPlanText(this.value)' placeholder="I. MỤC TIÊU BÀI HỌC&#10;- Trình bày được quá trình xử lí thông tin&#10;II. NỘI DUNG&#10;Thông tin: là những hiểu biết về thế giới quanh ta…">${esc(S.text||'')}</textarea></div>
${objList}
${miss.length?`<div class='notice'>${ic('info',16)}<div>Có <b>${miss.length}</b> mục tiêu trong giáo án chưa có ở bài học này. <button class='btn light' onclick='asgPlanAddObjs()'>Thêm vào bài học</button></div></div>`:''}
<div class='row' style='margin:14px 0 0;align-items:flex-end'>
<div class='selectbox' style='max-width:170px'><label for='apn'>Số câu đề xuất</label><select id='apn' onchange='asgPlan=asgPlan||{};asgPlan.n=this.value'>${nOpt}</select></div>
<div class='selectbox' style='max-width:180px'><label for='apd'>Độ khó</label><select id='apd' onchange='asgPlan=asgPlan||{};asgPlan.diff=this.value'>${dOpt}</select></div>
<div class='selectbox' style='max-width:180px'><label for='apb'>Mức Bloom mặc định</label><select id='apb' onchange='asgPlan=asgPlan||{};asgPlan.bloom=this.value'>${bOpt}</select></div>
<div class='spacer'></div><button class='btn' onclick='asgPlanMake()'>${ic('spark',16)}Soạn câu hỏi đề xuất</button></div>
${qList?`<div class='row between' style='margin-top:16px'><h3 style='font-size:15px;margin:0'>Câu hỏi đề xuất (${qs.length})</h3><button class='btn' onclick='asgPlanCommit()'>Dùng ${qs.length} câu này</button></div>${qList}`:''}
</div>`;
}
