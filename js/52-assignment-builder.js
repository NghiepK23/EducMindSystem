/* EducMind · js/52-assignment-builder.js
   Trình tạo bài tập của giáo viên: bản nháp, chọn câu hỏi, bộ lọc, lưu, nhập từ tệp. */
/* --- Giáo viên: trình tạo / soạn bài tập ---
   Bộ câu hỏi: chọn câu có sẵn trong ngân hàng theo bài học và mục tiêu, hoặc nhập từ Excel/Word (cùng mẫu với ngân hàng),
   soạn mới, nhờ AI; xem trước đúng như học sinh sẽ thấy; hệ thống dựng giao diện làm bài, chấm và ghi bằng chứng.
   Tạo bài mới đi theo 3 bước: (1) chọn cách tạo nội dung và thông tin cơ bản, (2) tick câu hỏi của bài học theo từng mục tiêu
   hoặc tải tệp Excel/Word lên, (3) xem trước đúng mẫu học sinh sẽ nhận rồi lưu nháp hoặc xuất bản. */
let asgDraft=null,asgLes='all',asgDefW='1';
/* trạng thái giao diện của trình tạo bài tập: bước hiện tại, cách tạo nội dung, bộ lọc câu hỏi */
let asgStepN=1,asgSrc='BANK',asgFind='',asgFT='all',asgFD='all',asgAutoN='2';
const ASGSRC={
  BANK:{t:'Từ Ngân hàng câu hỏi',d:'Chọn bài học, hệ thống liệt kê câu hỏi có sẵn của bài đó theo từng mục tiêu. Giáo viên chỉ việc tick câu phù hợp.'},
  UPLOAD:{t:'Tải lên tệp Excel hoặc Word',d:'Dùng đúng mẫu của Ngân hàng câu hỏi. Hệ thống đọc tệp, dựng giao diện làm bài, chấm và ghi nhận kết quả.'},
  FILE:{t:'Học sinh nộp tệp hoặc bài tự luận',d:'Giao đề bài, học sinh nộp bài viết hoặc tệp đính kèm, giáo viên chấm tay theo rubric của mình.'},
  PLAN:{t:'Từ giáo án (AI đề xuất)',d:'Tải giáo án đã soạn sẵn: hệ thống đọc phần Mục tiêu và nội dung, soạn sẵn câu hỏi bám mục tiêu để giáo viên duyệt rồi tạo bài tập.'}};
const asgCur=c=>asgDraft&&asgDraft.cid===c.id?asgDraft:(asgQ!=null?c.assignments[asgQ]||null:null);
const dmyStr=ms=>{const d=new Date(ms);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()};
const asgScopes=c=>c.lessonsData.map(l=>'Bài học: '+l.name).concat(c.topics.map(t=>'Chủ đề: '+t.title),['Cả lớp']);
const lesOfScope=s=>s.indexOf('Bài học: ')===0?s.slice(9):'all';
function addAssignment(src){
  const c=selected(),sc=asgScopes(c);
  asgDraft={cid:c.id,name:'',desc:'',kind:'QUIZ',gameMode:'classic',scopeSel:sc[0],due:dmyStr(simNow()+7*864e5),tries:'3',late:false,lc:'',m:'10',qs:[],objs:[],max:0,subs:[],status:'Nháp',autoName:true};
  asgQ=null;asgLes=lesOfScope(sc[0]);asgDefW='1';asgFind='';asgFT='all';asgFD='all';
  asgSrc=src==='FILE'||src==='UPLOAD'?src:'BANK';asgDraft.kind=asgSrc==='FILE'?'FILE':'QUIZ';
  asgStepN=1;asgAutoName();focusId='ab-name';render();abReveal();
}
/* đưa trình tạo bài tập vào tầm nhìn sau khi vẽ lại */
function abReveal(){try{requestAnimationFrame(()=>{const el=document.querySelector('.asg-builder');if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'})})}catch(e){}}
function asgOpen(i){const c=selected(),a=c.assignments[i];asgFind='';asgFT='all';asgFD='all';asgDraft=null;asgQ=i;asgLes=a.scope&&a.scope.type==='lesson'&&a.scope.ref?a.scope.ref.name:'all';asgDefW='1';focusId='h-ab';render();abReveal()}
function asgF(k,v){if(!asgDraft)return;if(k==='name'){asgDraft.name=v;asgDraft.autoName=false}else asgDraft[k]=v}
function asgModeSet(v){const c=selected(),a=asgCur(c);if(!a||!asgIsQ(a))return;if(asgDraft){asgDraft.gameMode=v;return}if(asgWork(a)){toast('Bài đã có học sinh làm nên không đổi được giao diện.');render();return}a.gameMode=v==='survival'?'survival':'classic';a.upd=stamp();render()}
/* tiêu đề được đặt sẵn theo bài học đã chọn để giáo viên không phải gõ; chỉ áp dụng khi chưa tự sửa */
function asgAutoName(){const d=asgDraft;if(!d||!d.autoName)return;d.name='Bài tập · '+String(d.scopeSel||'').replace(/^Bài học: /,'').replace(/^Chủ đề: /,'')}
function asgKind(k){if(!asgDraft)return;asgSetSrc(k==='FILE'?'FILE':(asgSrc==='UPLOAD'?'UPLOAD':'BANK'))}
function asgSetSrc(s){if(!asgDraft)return;asgSrc=s;asgDraft.kind=s==='FILE'?'FILE':'QUIZ';asgStepN=2;focusId=s==='FILE'?'h-af':'h-ap';render();window.scrollTo(0,0)}
function asgScopeSet(v){if(!asgDraft)return;asgDraft.scopeSel=v;asgLes=lesOfScope(v);asgAutoName();render()}

function asgCancel(){asgDraft=null;asgQ=null;asgStepN=1;asgSrc='BANK';asgFind='';asgFT='all';asgFD='all';render()}
function asgStep(n){
  if(!asgDraft)return;
  n=Math.max(1,Math.min(3,parseInt(n,10)||1));
  if(n>1&&!String(asgDraft.name).trim()){toast('Hãy đặt tên bài tập trước khi tiếp tục.');asgStepN=1;focusId='ab-name';render();return}
  asgStepN=n;focusId=n===1?'h-ab':(n===2?(asgSrc==='FILE'?'h-af':'h-ap'):'h-av');render();window.scrollTo(0,0);
}
/* bộ lọc đang áp dụng cho danh sách câu hỏi (tìm nhanh, loại câu, độ khó) */
const asgVis=q=>(asgFT==='all'||(asgFT==='obj')===isObj(q))&&(asgFD==='all'||String(q.diff||'MEDIUM')===asgFD)&&(!nz(asgFind)||nz(q.content+' '+(q.opts||[]).join(' ')).indexOf(nz(asgFind))>=0);
function asgApplyFilters(){
  const f=nz(asgFind);let shown=0;
  document.querySelectorAll('.qgrp').forEach(g=>{
    let n=0;
    g.querySelectorAll('.qrow').forEach(el=>{
      const ok=(asgFT==='all'||el.getAttribute('data-qtype')===asgFT)&&(asgFD==='all'||el.getAttribute('data-qdiff')===asgFD)&&(!f||nz(el.getAttribute('data-qtext')||'').indexOf(f)>=0);
      el.style.display=ok?'':'none';if(ok)n++;
    });
    const cnt=g.querySelector('.qcnt');if(cnt)cnt.textContent=n?n+' câu đang hiện':'';
    g.style.display=(g.querySelectorAll('.qrow').length&&!n)?'none':'';
    shown+=n;
  });
  const t=document.getElementById('asg-shown');
  if(t)t.textContent=(asgFT!=='all'||asgFD!=='all'||f)?(shown?'Bộ lọc đang hiện '+shown+' câu.':'Không có câu nào khớp bộ lọc. Hãy đổi bộ lọc hoặc từ khóa.'):'';
  document.querySelectorAll('[data-ft]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-ft')===asgFT));
  document.querySelectorAll('[data-fd]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-fd')===asgFD));
}
function asgSetFT(v){asgFT=v;asgApplyFilters()}
function asgSetFD(v){asgFD=v;asgApplyFilters()}
function asgLiveFind(v){asgFind=v;asgApplyFilters()}
/* chọn nhanh mỗi mục tiêu một số câu, ưu tiên câu chưa chọn và trải đều độ khó */
function asgAuto(){
  const g=asgGuard();if(!g)return;
  const c=g.c,L=asgLes==='all'?c.lessonsData:c.lessonsData.filter(l=>l.name===asgLes),js=[],seen=new Set();
  L.forEach(l=>l.objs.forEach(o=>{if(!seen.has(o.idx)){seen.add(o.idx);js.push(o.idx)}}));
  if(asgLes==='all')js.push(null);
  if(!js.length){toast('Bài học đang lọc chưa có mục tiêu nào nên không chọn nhanh được.');return}
  openDlg({title:'Chọn nhanh câu hỏi theo mục tiêu',text:'Hệ thống chọn số câu đã nhập cho mỗi mục tiêu đang hiển thị ('+js.length+' mục tiêu), ưu tiên câu chưa được chọn và trải đều độ khó. Những câu đã tick vẫn được giữ nguyên.',okLabel:'Chọn nhanh',fields:[{k:'n',label:'Số câu cho mỗi mục tiêu (1–20)',val:asgAutoN}],ok:v=>{
    const n=parseInt(String(v.n).trim(),10);
    if(!(n>=1&&n<=20))return 'Số câu cho mỗi mục tiêu phải là số nguyên từ 1 đến 20.';
    asgAutoN=String(n);
    const w=parseFloat(String(asgDefW).replace(',','.'));if(!(w>0))return 'Điểm mỗi câu phải lớn hơn 0.';
    let add=0;
    js.forEach(j=>{
      const pool=asgQsOf(c,j).filter(asgVis).filter(q=>!g.a.qs.some(x=>x.qid===q.id));
      if(!pool.length)return;
      const bk=DFK.map(d=>pool.filter(q=>String(q.diff||'MEDIUM')===d)),pk=[];let i=0;
      while(pk.length<n&&bk.some(x=>x.length)){const b=bk[i%bk.length];if(b.length)pk.push(b.shift());i++}
      pk.forEach(q=>{g.a.qs.push({qid:q.id,w});add++});
    });
    if(!add)return 'Không có câu nào phù hợp để chọn thêm. Hãy đổi bộ lọc, đổi bài học, soạn câu mới hoặc nhập câu hỏi từ tệp.';
    asgSync(c,g.a);g.a.upd=stamp();render();
    toast('Đã chọn nhanh '+add+' câu. Bộ đề hiện có '+g.a.qs.length+' câu · '+asgSum(g.a)+' điểm.');
    return null}});
}
function asgClearQ(){
  const g=asgGuard();if(!g)return;
  openDlg({title:'Bỏ tất cả câu hỏi của bài tập?',text:'Bộ đề sẽ trống. Các câu hỏi vẫn còn nguyên trong Ngân hàng câu hỏi và có thể chọn lại bất cứ lúc nào.',danger:true,okLabel:'Bỏ tất cả câu',ok:()=>{g.a.qs=[];asgSync(g.c,g.a);g.a.upd=stamp();return null}});
}

/* bản dựng sẵn của bài tập để xem trước, dùng cho cả bài đang soạn */
function asgPrevObj(c){
  const a0=asgCur(c);if(!a0)return null;
  if(a0===asgDraft)return Object.assign({},a0,{name:String(a0.name).trim()||'(chưa đặt tiêu đề)',maxTries:parseInt(a0.tries,10)||1,max:asgIsQ(a0)?asgSum(a0):(parseFloat(a0.m)||0)});
  return a0;
}
/* mẫu bài tập đúng như học sinh sẽ nhận; ở chế độ nhúng thì khóa mọi ô trả lời */
function asgSample(c){
  const a=asgPrevObj(c);if(!a)return '';
  if(asgIsQ(a)){
    if(!(a.qs||[]).length)return `<section><div class='empty'>Chưa có câu hỏi nào để dựng đề. Hãy tick câu trong ngân hàng, chọn nhanh theo mục tiêu hoặc tải tệp Excel/Word lên.</div></section>`;
    return examHtml(c,a,{has:false,score:null},{qs:rdBuild(c,a),ans:{},miss:[]},true,true)
      .replace(/<input /g,'<input disabled ').replace(/<textarea /g,'<textarea disabled ').replace(/<select /g,'<select disabled ');
  }
  return `<section aria-label='Mẫu bài tập nộp tệp'><h2>${esc(a.name)}</h2><p class='muted'>Nộp tệp hoặc văn bản · Hạn nộp ${esc(a.due)} · Điểm tối đa ${a.max||0}</p><p style='white-space:pre-wrap'>${esc(String(a.desc).trim()||'(chưa có đề bài)')}</p><div class='field'><label>Bài làm</label><textarea rows='4' style='width:100%' disabled></textarea></div><div class='field'><label>Tệp đính kèm</label><input type='file' disabled></div></section>`;
}
function asgSaveNew(pub){
  const c=selected(),d=asgDraft;if(!d||d.cid!==c.id)return;
  const isQ=d.kind==='QUIZ',m=parseFloat(String(d.m).replace(',','.'));
  const err=!d.name.trim()?'Hãy nhập tiêu đề bài tập.':
    (!isQ&&!d.desc.trim())?'Loại Nộp tệp cần có đề bài để học sinh biết phải làm gì.':
    !okD(d.due)?'Hạn nộp cần đúng dạng dd/mm/yyyy.':
    (!isQ&&!(m>0))?'Điểm tối đa phải lớn hơn 0.':
    (d.late&&(!okD(d.lc)||dmy(d.lc,23,59)<=dmy(d.due,23,59)))?'Cho phép nộp trễ thì phải đặt thời điểm đóng nộp trễ sau hạn nộp.':
    (!/^\d+$/.test(String(d.tries).trim())||+d.tries<1)?'Số lần làm tối đa phải là số nguyên từ 1 trở lên.':
    (isQ&&pub&&!d.qs.length)?'Chưa có câu hỏi nào: hãy chọn câu từ ngân hàng hoặc nhập từ tệp.':null;
  if(err){toast(err);return}
  const s=d.scopeSel;let scope={type:'course'};
  if(s.indexOf('Chủ đề: ')===0){const x=c.topics.find(t=>'Chủ đề: '+t.title===s);if(x)scope={type:'topic',id:x.id}}
  else if(s.indexOf('Bài học: ')===0){const l=c.lessonsData.find(x=>'Bài học: '+x.name===s);if(l)scope={type:'lesson',ref:l}}
  Object.assign(d,{name:d.name.trim(),desc:d.desc.trim(),due:d.due.trim(),allowLate:!!d.late,lateClose:d.late?d.lc.trim():null,scope,maxTries:parseInt(d.tries,10),submitted:0,graded:0,aid:'n'+Date.now()+Math.floor(Math.random()*1000),subs:c.students.map(()=>({score:null,has:false})),upd:stamp()});
  if(isQ)asgSync(c,d);else{d.max=m;d.objs=(d.objs||[]).slice().sort((x,y)=>x-y)}
  ['cid','scopeSel','m','tries','late','lc','autoName'].forEach(k=>delete d[k]);
  c.assignments.push(d);asgDraft=null;asgQ=null;asgStepN=1;asgSrc='BANK';asgFind='';asgFT='all';asgFD='all';const idx=c.assignments.length-1;
  if(pub){togAsg(idx);render()}else{render();toast('Đã lưu bài tập ở trạng thái nháp. Xuất bản để học sinh nhìn thấy.')}
}
function asgGuard(){const c=selected(),a=asgCur(c);if(!a||!asgIsQ(a))return null;if(asgWork(a)){toast('Bài đã có học sinh làm, không sửa được danh sách câu hỏi.');return null}return {c,a}}
const asgQsOf=(c,j)=>c.bank.filter(q=>!q.del&&(j==null?!(q.objs||[]).length:(q.objs||[]).includes(j)));
function asgTog(qid,on,fid){
  const g=asgGuard();if(!g){render();return}
  const w=parseFloat(String(asgDefW).replace(',','.'));
  if(on&&!(w>0)){toast('Điểm mỗi câu phải lớn hơn 0.');render();return}
  if(on){if(!g.a.qs.some(x=>x.qid===qid))g.a.qs.push({qid,w})}else g.a.qs=g.a.qs.filter(x=>x.qid!==qid);
  asgSync(g.c,g.a);g.a.upd=stamp();focusId=fid;render();
}
function asgGrp(j,on){
  const g=asgGuard();if(!g)return;const w=parseFloat(String(asgDefW).replace(',','.'));
  if(on&&!(w>0)){toast('Điểm mỗi câu phải lớn hơn 0.');return}
  const L=asgQsOf(g.c,j).filter(asgVis);
  if(!L.length){toast('Nhóm này không có câu nào khớp bộ lọc hiện tại.');return}
  L.forEach(q=>{const has=g.a.qs.some(x=>x.qid===q.id);if(on&&!has)g.a.qs.push({qid:q.id,w});if(!on&&has)g.a.qs=g.a.qs.filter(x=>x.qid!==q.id)});
  asgSync(g.c,g.a);g.a.upd=stamp();render();
}
function asgMove(i,d){const g=asgGuard();if(!g)return;const q=g.a.qs,j=i+d;if(j<0||j>=q.length)return;[q[i],q[j]]=[q[j],q[i]];g.a.upd=stamp();render()}
function asgRm(i){const g=asgGuard();if(!g)return;g.a.qs.splice(i,1);asgSync(g.c,g.a);g.a.upd=stamp();render()}
function asgW(i){
  const g=asgGuard();if(!g)return;
  openDlg({title:'Điểm của câu '+(i+1),fields:[{k:'w',label:'Điểm của câu (lớn hơn 0)',val:g.a.qs[i].w}],ok:v=>{const w=parseFloat(String(v.w).replace(',','.'));if(!(w>0))return 'Điểm phải lớn hơn 0.';g.a.qs[i].w=w;asgSync(g.c,g.a);g.a.upd=stamp();return null}});
}
function asgNewQ(){const g=asgGuard();if(!g)return;asgHook=g.a;editQ(-1)}
function asgAI(){const g=asgGuard();if(!g)return;aiForAsg=g.a;newAIReq()}
const asgIsMine=(c,h)=>!!h&&(c.assignments.includes(h)||h===asgDraft);
function asgHookAdd(c,q){
  const h=asgHook;asgHook=null;
  if(!h||page!=='assignments'||!asgIsMine(c,h)||!asgIsQ(h)||asgWork(h))return;
  const w=parseFloat(String(asgDefW).replace(',','.'));h.qs.push({qid:q.id,w:w>0?w:1});asgSync(c,h);h.upd=stamp();
}
function asgAiAdd(c,r,q){
  const h=r&&r.forAsg,w=parseFloat(String(asgDefW).replace(',','.'));
  if(asgIsMine(c,h)&&asgIsQ(h)&&!asgWork(h)&&!h.qs.some(x=>x.qid===q.id)){h.qs.push({qid:q.id,w:w>0?w:1});asgSync(c,h);h.upd=stamp()}
}
/* nhập từ Excel/Word: câu đã có trong ngân hàng được dùng lại, câu mới lưu vào ngân hàng rồi thêm vào bài tập */
function impCommitA(){
  const c=selected(),L=IMPSTATE&&IMPSTATE.items,g=asgGuard();if(!L||!L.length||!g)return;
  const w0=parseFloat(String(asgDefW).replace(',','.'))||1;let nw=0,nb=0,no=0;
  L.forEach(o=>{let id=o.reuse;if(!id){id='C'+(QID++);c.bank.push({id,content:o.content,type:o.type,opts:o.opts,ans:o.ans,objs:o.objs,diff:o.diff,bloom:o.bloom,src:'MANUAL',upd:stamp()});nb++}
    if(!g.a.qs.some(x=>x.qid===id)){g.a.qs.push({qid:id,w:o.w||w0});nw++}if(!(o.objs||[]).length)no++});
  asgSync(c,g.a);g.a.upd=stamp();impClose();if(asgDraft){asgStepN=3;asgSrc='UPLOAD'}render();
  toast('Đã thêm '+nw+' câu vào bài tập'+(nb?' ('+nb+' câu mới được lưu vào ngân hàng)':'')+(no?'. '+no+' câu không gắn mục tiêu nên không sinh bằng chứng học tập.':'.')+(asgDraft?' Xem lại bộ đề ở cuối trang rồi bấm “Giao bài tập”.':''));
}
IMPFMT.asg=Object.assign({},IMPFMT.questions,{title:'Nhập câu hỏi cho bài tập từ tệp',note:IMPFMT.questions.note+' Câu đã có trong ngân hàng được dùng lại, câu mới được lưu vào ngân hàng và thêm vào bài tập. Có thể thêm cột “Điểm” (tùy chọn) để đặt điểm từng câu; không có thì dùng điểm mặc định.'});
DOCXB64.asg=DOCXB64.questions;
