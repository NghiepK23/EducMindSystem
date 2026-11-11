/* EducMind · js/23-quiz-manage.js
   Giáo viên dựng bài kiểm tra: tạo, sửa, xuất bản, thêm câu hỏi, xem lượt làm, chấm tay. */
/* --- Bài tập: dựng, xuất bản, lượt làm, chấm tay (US-T06, T13, T14, T15) --- */
const quizErr=(v,minAtt)=>{
  const d=parseInt(v.d,10),a=parseInt(v.a,10);
  if(!v.n.trim())return 'Bài tập phải có tiêu đề.';
  if(!(d>0))return 'Thời lượng phải lớn hơn 0.';
  if(!/^\d+$/.test(String(v.a).trim()))return 'Hãy nhập số lần làm tối đa, là số nguyên từ 1 trở lên. Mỗi bài kiểm tra phải được cấu hình số lần làm trước khi xuất bản.';
  if(!(a>=1))return 'Số lần làm tối đa phải từ 1 trở lên.';
  if(a<(minAtt||0))return 'Không đặt thấp hơn số lượt đã làm của học sinh ('+minAtt+' lượt).';
  if(!okD(v.o)||!okD(v.x))return 'Thời gian mở và đóng cần đúng dạng dd/mm/yyyy.';
  if(dmy(v.x,23,59)<=dmy(v.o,0,0))return 'Thời gian đóng phải sau thời gian mở.';
  return null;
};
function editQuiz(){
  const c=selected(),q=c.quiz,used=Math.max(...c.students.map(s=>s.att.used));
  openDlg({title:'Sửa bài kiểm tra',text:'Lượt đang làm giữ hạn đã chốt khi bắt đầu, nên rút ngắn thời lượng hoặc thời gian đóng chỉ ảnh hưởng các lượt bắt đầu sau đó.',fields:[{k:'n',label:'Tiêu đề',val:q.name},{k:'d',label:'Thời lượng (phút)',val:q.dur},{k:'a',label:'Số lần làm tối đa (không thấp hơn '+used+')',val:c.maxAtt},{k:'o',label:'Mở từ ngày (dd/mm/yyyy)',val:q.open},{k:'x',label:'Đóng hết ngày (dd/mm/yyyy)',val:q.close}],ok:v=>{
    const e=quizErr(v,used);if(e)return e;
    const sh=+v.d<q.dur||dmy(v.x,23,59)<dmy(q.close,23,59);
    q.name=v.n.trim();q.dur=+v.d;c.maxAtt=+v.a;q.open=v.o.trim();q.close=v.x.trim();q.upd=stamp();
    toast(sh?'Đã lưu. Lượt đang làm giữ hạn đã chốt; thông số mới áp dụng cho lượt bắt đầu sau.':'Đã lưu bài kiểm tra');return null}});
}
function togglePubQ(){
  const c=selected(),q=c.quiz;
  if(q.status==='Nháp'){if(!q.qs.length){toast('Bài tập chưa có câu hỏi nên không xuất bản được.');return}if(!(c.maxAtt>=1)){toast('Chưa xuất bản được: hãy cấu hình số lần làm tối đa cho bài kiểm tra (nút Sửa).');return}q.status='Đã xuất bản';notifyClass(c,'NEW_ASSESSMENT_PUBLISHED','Bài tập mới: '+q.name,{page:'assessments',c,ref:q});toast('Đã xuất bản bài kiểm tra và gửi thông báo cho '+c.students.length+' học sinh')}
  else{if(hasAtt(c)){toast('Bài đã có lượt làm nên không hủy xuất bản được.');return}q.status='Nháp';toast('Đã đưa bài kiểm tra về nháp')}
  q.upd=stamp();render();
}
function addQ(){
  const c=selected(),q=c.quiz,av=c.bank.filter(b=>!b.del&&!q.qs.some(x=>x.qid===b.id)),lab=b=>b.id+' · '+b.content.slice(0,60);
  if(hasAtt(c)){toast('Bài đã có người làm, không sửa được danh sách câu hỏi.');return}
  if(!av.length){toast('Ngân hàng không còn câu hỏi nào để thêm.');return}
  openDlg({title:'Thêm câu hỏi vào bài',fields:[{k:'q',label:'Câu hỏi',val:lab(av[0]),sel:av.map(lab)},{k:'w',label:'Trọng số điểm',val:'1'}],ok:v=>{
    const b=av.find(x=>lab(x)===v.q),w=parseFloat(String(v.w).replace(',','.'));
    if(!b)return 'Hãy chọn một câu hỏi.';if(!(w>0))return 'Trọng số phải lớn hơn 0.';
    q.qs.push({qid:b.id,w});return null}});
}
function rmQ(i){const c=selected();if(hasAtt(c)){toast('Bài đã có người làm, không sửa được danh sách câu hỏi.');return}c.quiz.qs.splice(i,1);render()}
function attemptsPanel(c){
  const mx=qMax(c),rows=[];
  c.students.forEach((s,si)=>{
    const o=offOf(c,s);
    if(!s.atts.length){if(!pendOnly)rows.push(`<tr><td class='student'>${esc(s.name)}</td><td colspan='4' class='muted'>Chưa làm bài</td><td></td></tr>`);return}
    s.atts.forEach((t,k)=>{
      if(pendOnly&&t.status!=='SUBMITTED')return;
      rows.push(`<tr><td class='student'>${esc(s.name)}${k===0&&o!=null?`<div class='muted' style='font-weight:400'>Chính thức: ${o.toFixed(1)}/${mx}</div>`:''}</td><td>${t.n}</td><td>${ST[t.status]}</td><td>${esc(t.at||'–')}</td><td>${t.status==='GRADED'?t.total.toFixed(1)+'/'+mx:'–'}</td><td>${t.status==='SUBMITTED'?`<button class='btn' onclick='gradeAtt(${si},${k})'>Chấm</button>`:t.status==='GRADED'&&!t.seed?`<button class='btn light' onclick='gradeAtt(${si},${k})'>Xem và chỉnh</button>`:''}</td></tr>`)});
  });
  const offs=c.students.map(s=>offOf(c,s)).filter(x=>x!=null),avg=offs.length?(offs.reduce((a,b)=>a+b,0)/offs.length).toFixed(1)+'/'+mx:'chưa có';
  return `<section class='panel' aria-labelledby='h-at'><div class='row between'><h2 id='h-at'>Lượt làm và kết quả</h2><button class='btn light' aria-pressed='${pendOnly}' onclick='pendOnly=!pendOnly;render()'>${pendOnly?'Xem tất cả':'Chỉ xem lượt chờ chấm'}</button></div><p class='lead'>Điểm chính thức của mỗi học sinh là lượt đã chấm có điểm cao nhất. Trung bình lớp: <b>${avg}</b>. Lượt đang làm hoặc chưa chấm xong chưa được tính.</p><div class='tablewrap'><table><thead><tr><th scope='col'>Học sinh</th><th scope='col'>Lượt</th><th scope='col'>Trạng thái</th><th scope='col'>Nộp lúc</th><th scope='col'>Điểm</th><th scope='col'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${rows.join('')||`<tr><td colspan='6' class='muted'>Không có lượt nào chờ chấm.</td></tr>`}</tbody></table></div></section>`;
}
function gradeAtt(si,k){
  const c=selected(),s=c.students[si],t=s.atts[k],Q=c.quiz.qs,fields=[];
  Q.forEach((x,i)=>{
    const qq=qOf(c,x.qid),a=t.ans[x.qid];
    const txt=a==null?'(bỏ trống)':Array.isArray(a)?(a.map(m=>qq.opts[m]).join('; ')||'(bỏ trống)'):isObj(qq)?(qq.opts[a]||'(bỏ trống)'):(String(a)||'(bỏ trống)');
    fields.push({k:'s'+i,label:'Câu '+(i+1)+' ('+QT[qq.type]+', tối đa '+x.w+'): '+esc(qq.content)+' — Trả lời: '+esc(txt),val:t.sc[x.qid]==null?'':t.sc[x.qid]},{k:'f'+i,label:'Nhận xét câu '+(i+1),val:t.fb[x.qid]||''});
  });
  openDlg({title:'Chấm lượt '+t.n+' · '+esc(s.name),text:'Điểm mỗi câu từ 0 đến trọng số. Câu trắc nghiệm đã được chấm tự động, có thể chỉnh nếu cần. Chấm đủ mọi câu thì lượt chuyển sang đã chấm.',okLabel:'Lưu điểm',fields,ok:v=>{
    const ns=[];
    for(let i=0;i<Q.length;i++){const raw=String(v['s'+i]).trim().replace(',','.');if(raw===''){ns.push(null);continue}const n=parseFloat(raw);if(isNaN(n)||n<0||n>Q[i].w)return 'Câu '+(i+1)+': điểm phải từ 0 đến '+Q[i].w+'. Chưa lưu.';ns.push(n)}
    Q.forEach((x,i)=>{t.sc[x.qid]=ns[i];t.fb[x.qid]=String(v['f'+i]).trim()});
    if(Q.every(x=>t.sc[x.qid]!=null)){completeAttempt(c,s,t);toast('Lượt làm đã chấm xong; mức nắm vững đã được tính lại.')}
    else{t.status='SUBMITTED';toast('Đã lưu. Còn câu chưa có điểm nên lượt vẫn chờ chấm.')}
    return null}});
}
let asgTab='asg';
function asgTabSet(t){asgTab=t;render();window.scrollTo(0,0)}

/* --- AC-T06.5, T06.6: phạm vi bài kiểm tra gắn với chủ đề / bài học cụ thể --- */
function scopeOpts(c){
  const L=[];
  visClasses().forEach(cl=>{const tag=cl===c?'':' · lớp '+cl.id;
    cl.topics.forEach(t=>L.push({kind:'topic',cl,ref:t,label:'Chủ đề: '+t.title+tag}));
    cl.lessonsData.forEach(l=>L.push({kind:'lesson',cl,ref:l,label:'Bài học: '+l.name+tag}))});
  return L;
}
function newQuiz(){
  const c=selected(),O=scopeOpts(c),NO='Không chọn';
  const tl=[NO].concat(O.filter(o=>o.kind==='topic').map(o=>o.label)),ll=[NO].concat(O.filter(o=>o.kind==='lesson').map(o=>o.label));
  openDlg({title:'Tạo bài tập',text:'Bài mới ở trạng thái nháp, học sinh chưa thấy.',fields:[{k:'n',label:'Tiêu đề',val:''},{k:'p',label:'Phạm vi',val:'Cả lớp',sel:['Cả lớp','Một chủ đề','Một bài học']},{k:'d',label:'Thời lượng (phút)',val:'15'},{k:'a',label:'Số lần làm tối đa (bắt buộc, số nguyên từ 1 trở lên)',val:''},{k:'o',label:'Mở từ ngày (dd/mm/yyyy)',val:'01/11/2026'},{k:'x',label:'Đóng hết ngày (dd/mm/yyyy)',val:'15/11/2026'}],ok:v=>{
    const e=quizErr(v);if(e)return e;
    const ts=v.t!==NO,ls=v.l!==NO;let scope={type:'course'};
    if(ts&&ls)return 'Phạm vi chỉ được thuộc một cấp: không chọn đồng thời chủ đề và bài học.';
    if(ts){const o=O.find(x=>x.kind==='topic'&&x.label===v.t);if(!o||o.cl!==c)return 'Chủ đề được chọn không thuộc cùng lớp với bài kiểm tra.';scope={type:'topic',id:o.ref.id}}
    if(ls){const o=O.find(x=>x.kind==='lesson'&&x.label===v.l);if(!o||o.cl!==c)return 'Bài học được chọn không thuộc cùng lớp với bài kiểm tra.';scope={type:'lesson',ref:o.ref}}
    c.students.forEach(s=>{s.attOld=(s.attOld||[]).concat([s.atts]);s.atts=[];s.att={used:0,last:0,best:null,real:null,cur:null}});
    c.quiz={name:v.n.trim(),scope,status:'Nháp',dur:+v.d,open:v.o.trim(),close:v.x.trim(),qs:[],deleted:false};c.maxAtt=+v.a;
    toast('Đã tạo bài kiểm tra nháp · phạm vi: '+scopeLbl(c,scope));return null}});
}
