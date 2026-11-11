/* EducMind · js/55-practice-tracking.js
   Luyện tập có chủ đích: bài học bị khóa, cấp thêm lượt làm, cấu hình và theo dõi của giáo viên. */
/* trình tạo bài tập đã được chèn ngay dưới nút (+) bên trong assignmentsPage(),
   nên không bọc lại ở đây (trước đây bọc thêm khiến nó bị đẩy lên trên dải tab). */

/* --- Học sinh: bài học bị khóa, bảng yêu cầu --- */
function pRow(head,sub,ok){return `<div class='row between' style='padding:6px 0'><span>${head}<div class='muted'>${sub}</div></span><span class='pill ${ok?'good':'prog'}'>${ic(ok?'check':'trend',14)}${ok?'Đạt':'Chưa đạt'}</span></div>`}
function pStuCheck(c,s,l){
  const it=pCrit(c,s,l);if(!it.length)return '';
  const ok=pDone(c,s,l),w=pWaived(s,l),O=pOrder(c),nx=O[O.indexOf(l)+1];
  const rows=it.map(x=>x.k==='avg'
    ?pRow('<b>Điểm trung bình bài tập</b>','Đã chấm '+x.done+'/'+x.total+' bài · điểm trung bình hiện tại '+(x.v==null?'chưa có':pct(x.v)+'%')+' · yêu cầu ≥ '+x.need+'%',x.ok)
    :pRow('<b>'+esc(x.o.code)+'</b> '+esc(x.o.desc),'Mức nắm vững yêu cầu ≥ '+x.need+'% · hiện tại: '+(x.m==null?'chưa có dữ liệu':TIER[tier(x.m)].label),x.ok)).join('');
  const stuck=!ok&&pStuck(c,s,l);
  const msg=stuck?'Em đã dùng hết lượt làm các bài tập của bài này mà chưa đạt yêu cầu. Hãy nhờ giáo viên hỗ trợ.':ok?(w?'Giáo viên đã cho em đi tiếp.':'Em đã đạt yêu cầu luyện tập.')+(nx?' Bài “'+esc(nx.name)+'” đã mở.':''):'Em cần đạt các yêu cầu dưới đây để '+(nx?'mở bài “'+esc(nx.name)+'”':'hoàn thành luyện tập bài này')+'. Làm bài tập, đọc nhận xét rồi luyện tập lại cho đến khi đạt.';
  return `<div style='margin-top:12px;padding-top:10px;border-top:1px solid var(--line)'><div class='row between'><b style='font-size:13px'>Luyện tập có chủ đích</b><span class='pill ${ok?'good':'prog'}'>${ok?'Đã đạt':'Đang luyện'}</span></div><p class='muted' style='margin:4px 0 6px'>${msg}</p>${rows}${ok||stuck?'':`<div class='row' style='margin-top:8px'><button class='btn light' onclick="setPage('assignments')">Đến bài tập</button></div>`}</div>`;
}
const _ls0=lessonStu;
window.lessonStu=function(c,l,li){
  const s=me();
  if(!s||!PR(c).on)return _ls0(c,l,li);
  const blk=pBlock(c,s,l);
  if(blk)return `<div class='item' id='ls-${li}' tabindex='-1' style='display:block'><div class='row between'><span class='row' style='gap:6px;align-items:center'>${ic('lock',16)}<b>${esc(l.name)}</b></span><span class='pill plain'>Chưa mở</span></div><div class='muted'>Em cần đạt yêu cầu luyện tập của bài “${esc(blk.name)}” để mở bài này.</div></div>`;
  return _ls0(c,l,li);
};

/* --- Giáo viên: cấp thêm lượt làm bài tập cho riêng từng học sinh (không đổi số lượt của cả lớp) --- */
const XTRY_MAX=10;
function triesPanel(c){
  const ai=Math.min(gradeAi,c.assignments.length-1),a=c.assignments[ai];if(!a)return '';
  const own=owns(c),base=a.maxTries>=1?a.maxTries:0;
  const nEx=a.subs.filter(b=>b&&b.extra).length;
  const rows=c.students.map((s,si)=>{
    const b=a.subs[si]||{},used=pTriesOf(b),mx=pMax(a,b),ex=b.extra||0,free=ex-Math.max(0,used-base);
    const lg=(b.xlog||[]).slice(-2).map(x=>`<div class='muted' style='font-size:12px'>${x.n>0?'+':''}${x.n} lượt · ${esc(x.by)}, ${esc(x.at)}${x.r?' · '+esc(x.r):''}</div>`).join('');
    return `<tr><td class='student'>${esc(s.name)}</td><td>${used}</td><td>${base||'–'}${ex?` <span class='pill prog'>+${ex} cấp thêm</span>`:''}</td><td><b>${Math.max(0,mx-used)}</b>${lg}</td><td>${own?`<span class='row' style='flex-wrap:nowrap'><button class='btn light' onclick='grantTries(${ai},${si})' aria-label='Cấp thêm lượt cho ${esc(s.name)}'>Cấp thêm lượt</button>${free>0?`<button class='btn light' onclick='revokeTries(${ai},${si})' aria-label='Thu hồi lượt chưa dùng của ${esc(s.name)}'>Thu hồi</button>`:''}</span>`:''}</td></tr>`}).join('');
  return `<section class='panel' aria-labelledby='h-xt'><h2 id='h-xt'>Lượt làm bài của từng học sinh</h2><p class='lead'>Bài tập đang chọn: <b>${esc(a.name)}</b> · số lượt cơ bản của cả lớp: ${base||'chưa cấu hình'}${nEx?' · '+nEx+' học sinh được cấp thêm riêng':''}. Cấp thêm lượt chỉ áp dụng cho học sinh được chọn, số lượt của cả lớp không thay đổi (đổi số lượt của cả lớp ở mục Quản lý bài tập, nút Sửa).</p>${c.students.length?`<div class='tablewrap'><table><thead><tr><th scope='col'>Học sinh</th><th scope='col'>Đã dùng</th><th scope='col'>Lượt của lớp</th><th scope='col'>Còn lại</th><th scope='col'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class='empty'>Lớp chưa có học sinh.</div>`}${PR(c).on?'':note('Lượt làm lại chỉ được dùng khi lớp bật “Luyện tập có chủ đích” (mục Bài học và mục tiêu). Lượt cấp thêm vẫn được lưu, nhưng học sinh chưa luyện tập lại được khi chế độ này đang tắt.')}</section>`;
}
function grantTries(ai,si){
  const c=selected();if(pDenied(c))return;
  const a=c.assignments[ai],s=c.students[si],b=a&&a.subs[si];if(!a||!s||!b)return;
  openDlg({title:'Cấp thêm lượt cho '+esc(s.name),text:'Bài “'+esc(a.name)+'”. Chỉ áp dụng cho học sinh này; số lượt của cả lớp ('+(a.maxTries>=1?a.maxTries:'chưa cấu hình')+') không đổi. Hiện tại: đã dùng '+pTriesOf(b)+'/'+pMax(a,b)+' lượt'+(b.extra?' (gồm '+b.extra+' lượt đã cấp thêm)':'')+'.',okLabel:'Cấp thêm lượt',fields:[{k:'n',label:'Số lượt cấp thêm (số nguyên từ 1 đến '+XTRY_MAX+')',val:'1'},{k:'r',label:'Lý do (không bắt buộc)',val:'',area:true}],ok:v=>{
    const t=String(v.n).trim();
    if(!/^\d+$/.test(t)||+t<1)return 'Số lượt cấp thêm phải là số nguyên từ 1 trở lên.';
    const n=+t;
    if(!c.assignments.includes(a)||!c.students.includes(s))return 'Bài tập hoặc học sinh không còn trong lớp.';
    if((b.extra||0)+n>XTRY_MAX)return 'Tổng lượt cấp thêm cho một học sinh ở một bài tập tối đa '+XTRY_MAX+' (hiện đã cấp '+(b.extra||0)+').';
    b.extra=(b.extra||0)+n;(b.xlog=b.xlog||[]).push({n,r:v.r.trim(),by:acctName(),at:stamp()});
    LOG.unshift('Cấp thêm '+n+' lượt làm “'+a.name+'” cho '+s.name+' ('+c.id+'): tổng lượt của em '+pMax(a,b)+'; lượt của cả lớp giữ nguyên '+a.maxTries);
    notify('EXTRA_TRY_GRANTED','Giáo viên đã cấp thêm '+n+' lượt làm bài tập “'+a.name+'” cho em',{page:'assignments',c,ref:a},s.email);
    toast('Đã cấp thêm '+n+' lượt cho '+s.name+'. Số lượt của cả lớp không đổi.');return null}});
}
function revokeTries(ai,si){
  const c=selected();if(pDenied(c))return;
  const a=c.assignments[ai],s=c.students[si],b=a&&a.subs[si];if(!a||!s||!b)return;
  const base=a.maxTries>=1?a.maxTries:0,free=(b.extra||0)-Math.max(0,pTriesOf(b)-base);
  if(free<=0){toast('Không còn lượt cấp thêm chưa dùng để thu hồi.');return}
  openDlg({title:'Thu hồi lượt cấp thêm?',text:'Thu hồi '+free+' lượt cấp thêm chưa dùng của '+esc(s.name)+' ở bài “'+esc(a.name)+'”. Các lượt em đã dùng được giữ nguyên.',danger:true,okLabel:'Thu hồi '+free+' lượt',ok:()=>{
    const f2=(b.extra||0)-Math.max(0,pTriesOf(b)-base);
    if(f2<=0)return 'Không còn lượt chưa dùng để thu hồi.';
    b.extra=(b.extra||0)-f2;if(!b.extra)delete b.extra;
    (b.xlog=b.xlog||[]).push({n:-f2,r:'Thu hồi lượt chưa dùng',by:acctName(),at:stamp()});
    LOG.unshift('Thu hồi '+f2+' lượt cấp thêm của '+s.name+' ở “'+a.name+'” ('+c.id+')');
    toast('Đã thu hồi '+f2+' lượt chưa dùng của '+s.name+'.');return null}});
}

/* --- Giáo viên: cấu hình và theo dõi --- */
const pDenied=c=>{if(owns(c))return false;toast('Bị từ chối: lớp này không do bạn phụ trách.');return true};
function pCfg(){
  const c=selected();if(pDenied(c))return;const P0=PR(c);
  openDlg({title:'Cấu hình luyện tập có chủ đích',text:'Khi bật, học sinh phải đạt yêu cầu của bài học hiện tại mới mở được bài kế tiếp. Chỉ bài tập được tính; bài kiểm tra không tính. Mỗi bài học và mỗi mục tiêu có thể đặt yêu cầu riêng.',okLabel:'Lưu cấu hình',fields:[
    {k:'on',label:'Trạng thái',val:P0.on?'Bật':'Tắt',sel:['Bật','Tắt']},
    {k:'m',label:'Điều kiện áp dụng',val:PMODE[P0.mode],sel:PMODEV},
    {k:'a',label:'Điểm trung bình bài tập tối thiểu của mỗi bài học (%)',val:String(P0.avg)},
    {k:'s',label:'Mức nắm vững tối thiểu của mỗi mục tiêu (%)',val:String(P0.mas)}],ok:v=>{
    const a=parseInt(v.a,10),m=parseInt(v.s,10);
    if(!(a>=1&&a<=100)||String(a)!==v.a.trim())return 'Điểm trung bình tối thiểu phải là số nguyên từ 1 đến 100.';
    if(!(m>=1&&m<=100)||String(m)!==v.s.trim())return 'Mức nắm vững tối thiểu phải là số nguyên từ 1 đến 100.';
    P0.on=v.on==='Bật';P0.mode=PMODEK[PMODEV.indexOf(v.m)];P0.avg=a;P0.mas=m;
    LOG.unshift('Luyện tập có chủ đích ('+c.id+'): '+(P0.on?'bật':'tắt')+' · '+PMODE[P0.mode]+' · điểm trung bình ≥ '+a+'% · nắm vững ≥ '+m+'%');
    toast(P0.on?'Đã bật luyện tập có chủ đích cho lớp '+c.id+'.':'Đã tắt luyện tập có chủ đích; mọi bài học được mở.');return null}});
}
function pLes(li){
  const c=selected();if(pDenied(c))return;const l=c.lessonsData[li];
  openDlg({title:'Yêu cầu của bài học “'+esc(l.name)+'”',text:'Để trống ô nào thì dùng cấu hình chung của lớp (điểm trung bình ≥ '+PR(c).avg+'%, nắm vững ≥ '+PR(c).mas+'%).',okLabel:'Lưu yêu cầu',fields:[
    {k:'a',label:'Điểm trung bình bài tập tối thiểu của bài học (%)',val:l.pa!=null?String(l.pa):''},
    {k:'s',label:'Mức nắm vững tối thiểu mặc định của các mục tiêu trong bài (%)',val:l.pm!=null?String(l.pm):''},
    {k:'o',label:'Mục tiêu có yêu cầu riêng: mỗi dòng “mã | %”. Mã trong bài: '+l.objs.map(o=>o.code).join(', '),val:l.objs.filter(o=>o.pm!=null).map(o=>o.code+' | '+o.pm).join(NL),area:true}],ok:v=>{
    const rd=t=>{t=t.trim();if(!t)return null;const n=parseInt(t,10);return n>=1&&n<=100&&String(n)===t?n:NaN};
    const a=rd(v.a),s0=rd(v.s);
    if(Number.isNaN(a))return 'Điểm trung bình phải là số nguyên từ 1 đến 100 hoặc để trống.';
    if(Number.isNaN(s0))return 'Mức nắm vững mặc định phải là số nguyên từ 1 đến 100 hoặc để trống.';
    const ov=new Map();
    for(const ln of v.o.split(NL).map(x=>x.trim()).filter(Boolean)){
      const p=ln.split(/[|\s]+/).filter(Boolean),code=(p[0]||'').toUpperCase(),n=rd(p[1]||'');
      const o=l.objs.find(x=>x.code.toUpperCase()===code);
      if(!o)return 'Mục tiêu '+esc(code)+' không thuộc bài học này.';
      if(n==null||Number.isNaN(n)||p.length!==2)return 'Dòng “'+esc(ln)+'” cần đúng dạng “mã | %” với % từ 1 đến 100.';
      if(ov.has(o))return 'Không đặt trùng yêu cầu cho '+esc(code)+'.';
      ov.set(o,n);
    }
    l.pa=a;l.pm=s0;l.objs.forEach(o=>{o.pm=ov.has(o)?ov.get(o):null});l.upd=stamp();
    toast('Đã lưu yêu cầu luyện tập của bài học.');return null}});
}
function pWaive(si){
  const c=selected();if(pDenied(c))return;const s=c.students[si],l=pOrder(c).find(x=>!pDone(c,s,x));if(!l)return;
  openDlg({title:'Cho '+esc(s.name)+' đi tiếp?',text:'Bỏ qua yêu cầu luyện tập của bài “'+esc(l.name)+'” cho riêng học sinh này. Điểm và mức nắm vững vẫn giữ nguyên; chỉ việc mở bài kế tiếp thay đổi. Có thể thu hồi sau.',okLabel:'Cho đi tiếp',ok:()=>{
    (s.waive||(s.waive=new Set())).add(l);
    LOG.unshift('Luyện tập có chủ đích ('+c.id+'): cho '+s.name+' đi tiếp qua bài “'+l.name+'”');
    toast('Đã cho '+s.name+' đi tiếp.');return null}});
}
function pUnwaive(si){
  const c=selected();if(pDenied(c))return;const s=c.students[si];
  openDlg({title:'Thu hồi việc cho đi tiếp?',text:'Các bài học được cho đi tiếp của '+esc(s.name)+' sẽ lại phải đạt yêu cầu luyện tập. Bài nào học sinh đã đạt thật thì vẫn mở.',okLabel:'Thu hồi',ok:()=>{
    s.waive=new Set();LOG.unshift('Luyện tập có chủ đích ('+c.id+'): thu hồi việc cho đi tiếp của '+s.name);toast('Đã thu hồi.');return null}});
}
function pReq(c,l){
  const P0=PR(c),r=[];
  if(P0.mode!=='mas'){const n=pAsgs(c,l).length;r.push(n?'Điểm trung bình '+n+' bài tập ≥ '+pAvgMin(c,l)+'%':'Chưa có bài tập gắn với bài học')}
  if(P0.mode!=='avg')r.push(l.objs.length?l.objs.map(o=>esc(o.code)+' ≥ '+pMasMin(c,l,o)+'%').join(', '):'Chưa có mục tiêu');
  return r.join('<br>');
}
function pCell(c,s,l){
  if(pBlock(c,s,l))return `<span class='pill plain'>${ic('lock',14)}Chưa mở</span>`;
  if(pDone(c,s,l))return `<span class='pill good'>${ic('check',14)}Đạt</span>`+(pWaived(s,l)?`<div class='muted'>Được cho đi tiếp</div>`:'');
  const it=pCrit(c,s,l),av=it.find(x=>x.k==='avg'),bad=it.filter(x=>x.k==='mas'&&!x.ok).length,stuck=pStuck(c,s,l);
  const d=[av?'TB '+(av.v==null?'–':pct(av.v)+'%')+' · '+av.done+'/'+av.total+' bài':'',bad?bad+' mục tiêu chưa đạt':''].filter(Boolean).join(' · ');
  return `<span class='pill ${stuck?'need':'prog'}'>${ic(stuck?'alert':'trend',14)}${stuck?'Hết lượt làm':'Đang luyện'}</span>${d?`<div class='muted'>${d}</div>`:''}`;
}
function pPanels(c){
  const P0=PR(c),O=pOrder(c),own=owns(c);
  const rows=O.map(l=>{
    const li=c.lessonsData.indexOf(l),n=c.students.filter(s=>pDone(c,s,l)).length;
    const miss=P0.mode!=='avg'?l.objs.filter(o=>!pAsgs(c,l).some(a=>(a.objs||[]).includes(o.idx))).map(o=>esc(o.code)):[];
    return `<tr><td><b>${esc(l.name)}</b><div class='muted'>${esc(topicOf(c,l).title)}</div></td><td>${pReq(c,l)}${miss.length?`<div class='muted'>Chưa có bài tập gắn với ${miss.join(', ')}: học sinh khó đạt yêu cầu này.</div>`:''}</td><td>${P0.on?n+'/'+c.students.length:'–'}</td><td>${own?`<button class='btn light' onclick='pLes(${li})' aria-label='Đặt yêu cầu cho ${esc(l.name)}'>Đặt yêu cầu</button>`:''}</td></tr>`}).join('');
  const cfg=`<section class='panel' aria-labelledby='h-pr'><div class='row between'><h2 id='h-pr'>Luyện tập có chủ đích</h2><span class='pill ${P0.on?'good':'plain'}'>${P0.on?'Đang bật':'Đang tắt'}</span></div><p class='lead' style='margin-top:4px'>Học sinh làm bài tập và luyện tập lại cho đến khi đạt yêu cầu của bài học thì bài kế tiếp mới mở. Bài tập không tính vào yêu cầu này.</p><div class='row between' style='margin-bottom:12px'><span class='muted'>${P0.on?esc(PMODE[P0.mode])+' · điểm trung bình bài tập ≥ '+P0.avg+'% · nắm vững mỗi mục tiêu ≥ '+P0.mas+'% (mặc định của lớp)':'Tắt: học sinh xem được mọi bài học đã xuất bản.'}</span>${own?`<button class='btn' onclick='pCfg()'>Cấu hình</button>`:''}</div>${P0.on?(O.length?`<div class='tablewrap'><table><thead><tr><th scope='col'>Bài học (theo thứ tự mở)</th><th scope='col'>Yêu cầu để mở bài kế tiếp</th><th scope='col'>Đã đạt</th><th scope='col'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class='empty'>Chưa có bài học nào được xuất bản.</div>`):''}</section>`;
  if(!P0.on||!O.length||!c.students.length)return cfg;
  const prog=`<section class='panel' aria-labelledby='h-pp'><h2 id='h-pp'>Tiến độ luyện tập của học sinh</h2><p class='lead'>Số liệu tính từ bài tập đã chấm; bài đang chờ chấm lại vẫn tính theo lần chấm gần nhất.</p><div class='tablewrap'><table><thead><tr><th scope='col'>Học sinh</th>${O.map(l=>`<th scope='col'>${esc(l.name)}</th>`).join('')}<th scope='col'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${c.students.map((s,si)=>{const cur=O.find(l=>!pDone(c,s,l));return `<tr><td class='student'>${esc(s.name)}</td>${O.map(l=>`<td>${pCell(c,s,l)}</td>`).join('')}<td>${own?`<span class='row'>${cur?`<button class='btn light' onclick='pWaive(${si})' aria-label='Cho ${esc(s.name)} đi tiếp'>Cho đi tiếp</button>`:''}${s.waive&&s.waive.size?`<button class='btn light' onclick='pUnwaive(${si})' aria-label='Thu hồi cho ${esc(s.name)}'>Thu hồi</button>`:''}</span>`:''}</td></tr>`}).join('')}</tbody></table></div></section>`;
  return cfg+prog;
}


/* --- Thông báo cho học sinh khi một bài học được mở --- */
const _se0=scanEvents;
window.scanEvents=function(){
  _se0();
  classes.forEach(c=>{
    const O=pOrder(c);
    c.students.forEach(s=>{
      const st=PR(c).on?O.map(l=>pBlock(c,s,l)?'0':'1').join(''):'';
      snap(s,st,(p,n)=>{if(!p||!n||p.length!==n.length)return;O.forEach((l,i)=>{if(p[i]==='0'&&n[i]==='1')notify('LESSON_UNLOCKED','Đã mở bài học: '+l.name,{page:'lessons',c,ref:l},s.email)})});
    });
  });
};
