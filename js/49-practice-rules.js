/* EducMind · js/49-practice-rules.js
   Luyện tập có chủ đích: quy tắc mở khóa bài học theo điểm bài tập và mức nắm vững. */
/* ===== Đợt 10: luyện tập có chủ đích =====
   Học sinh làm bài tập (không tính bài kiểm tra) và luyện tập lại cho đến khi đạt yêu cầu của bài học
   thì bài học kế tiếp mới mở. Giáo viên cấu hình: điều kiện áp dụng, điểm trung bình bài tập tối thiểu,
   mức nắm vững tối thiểu cho từng mục tiêu. Cấu hình có 3 tầng: lớp → bài học → mục tiêu. */
P.lock='<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>';
P.grading='<rect x="4.5" y="4" width="15" height="17" rx="3.5"/><path d="M9 4V3h6v1"/><path d="M8.6 12.6l2.5 2.5 4.6-5.1"/>';
P.pause='<rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/>';
P.submit='<path d="M4 12.5l5 5L20 6.5"/>';
const PMODE={both:'Cả hai điều kiện',avg:'Chỉ điểm trung bình bài tập',mas:'Chỉ mức nắm vững'};
const PMODEK=Object.keys(PMODE),PMODEV=PMODEK.map(k=>PMODE[k]);
function PR(c){return c.prac||(c.prac={on:false,mode:'both',avg:70,mas:70})}
classes.forEach(PR);
/* Lớp mẫu demo đã gỡ bỏ — chỉ bật khi còn dữ liệu demo (hiện classes rỗng). */
{const _demoPrac=classes.find(c=>c.id==='10A1')||classes[0];if(_demoPrac)_demoPrac.prac.on=true;}

/* --- Quy tắc tính --- */
const pAvgMin=(c,l)=>l.pa!=null?l.pa:PR(c).avg;
const pMasMin=(c,l,o)=>o.pm!=null?o.pm:(l.pm!=null?l.pm:PR(c).mas);
function pOrder(c){const r=[];c.topics.filter(t=>t.status==='Đã xuất bản').forEach(t=>c.lessonsData.filter(l=>l.tid===t.id&&l.status==='Đã xuất bản').forEach(l=>r.push(l)));return r}
/* Bài tập thuộc bài học: gắn với mục tiêu của bài học, hoặc phạm vi đặt đúng bài học đó. Bài tập không tính. */
function pAsgs(c,l){return c.assignments.filter(a=>a.status==='Đã xuất bản'&&scopeLive(c,a)&&((a.objs||[]).some(j=>l.objs.some(o=>o.idx===j))||(a.scope&&a.scope.type==='lesson'&&a.scope.ref===l)))}
/* Mức nắm vững chỉ từ bằng chứng của bài tập (cùng công thức giảm theo thời gian), bỏ bằng chứng bài kiểm tra */
function pMas(s,j){let w=0,t=0;(s.ev[j]||[]).forEach(x=>{if(x.src!=='Bài tập')return;const k=Math.pow(.5,(today-x.day)/HL);w+=k*x.s;t+=k});return t?w/t:null}
function pCrit(c,s,l){
  const P0=PR(c),si=c.students.indexOf(s),it=[];
  if(P0.mode!=='mas'){
    const A=pAsgs(c,l);
    if(A.length){
      const g=A.filter(a=>a.subs[si]&&a.subs[si].score!=null),v=g.length?mean(g.map(a=>a.subs[si].score/a.max)):null,need=pAvgMin(c,l);
      it.push({k:'avg',done:g.length,total:A.length,v,need,ok:g.length===A.length&&v+1e-9>=need/100});
    }
  }
  if(P0.mode!=='avg')l.objs.forEach(o=>{const m=pMas(s,o.idx),need=pMasMin(c,l,o);it.push({k:'mas',o,m,need,ok:m!=null&&m+1e-9>=need/100})});
  return it;
}
const pWaived=(s,l)=>!!(s.waive&&s.waive.has(l));
/* Bài học không có yêu cầu nào áp dụng thì coi như đạt, để học sinh không bị kẹt */
const pDone=(c,s,l)=>pWaived(s,l)||pCrit(c,s,l).every(x=>x.ok);
function pBlock(c,s,l){
  if(!PR(c).on)return null;
  for(const p of pOrder(c)){if(p===l)return null;if(!pDone(c,s,p))return p}
  return null;
}
const pLesOfAsg=(c,a)=>pOrder(c).filter(l=>pAsgs(c,l).includes(a));
function pAsgBlock(c,s,a){
  if(!PR(c).on)return null;
  const L=pLesOfAsg(c,a);if(!L.length||L.some(l=>!pBlock(c,s,l)))return null;
  return pBlock(c,s,L[0]);
}
function pCanRedo(c,s,a){
  const b=a.subs[c.students.indexOf(s)];
  if(!PR(c).on||!b||!b.has||b.score==null||!(a.maxTries>=1)||pTriesOf(b)>=pMax(a,b))return false;
  return pLesOfAsg(c,a).some(l=>!pBlock(c,s,l)&&!pDone(c,s,l));
}
const pTriesOf=b=>b?(b.tries||(b.has?1:0)):0;
/* Số lượt tối đa của từng học sinh = lượt cơ bản của bài tập (cả lớp) + lượt giáo viên cấp thêm riêng cho em đó (b.extra) */
const pMax=(a,b)=>(a.maxTries>=1?a.maxTries:0)+((b&&b.extra)||0);
const pPrevTxt=(a,h)=>h.score==null?'chưa chấm':h.score+'/'+a.max;
const pHist=(a,b)=>b&&b.has?`<div class='muted' style='margin-top:6px'>Đã dùng ${pTriesOf(b)}/${pMax(a,b)} lượt làm${b.extra?' (gồm '+b.extra+' lượt giáo viên cấp thêm)':''}${b.hist&&b.hist.length?' · các lần trước: '+b.hist.map(h=>pPrevTxt(a,h)).join(' → '):''}</div>`:'';
const pTry=(a,b)=>b&&b.hist&&b.hist.length?` <span class='muted'>(lần ${pTriesOf(b)}/${pMax(a,b)} · lần trước ${pPrevTxt(a,b.hist[b.hist.length-1])})</span>`:'';
function pRedoBtn(c,s,a,i){
  const b=a.subs[c.students.indexOf(s)];
  if(pCanRedo(c,s,a))return `<button type='button' class='btn student-redo-cta' data-noicon='1' onclick='openAssignmentMode(${i})'>${ic('play',16)}<span>${b.redo?'Tiếp tục · chọn trò chơi':'Chọn trò chơi luyện tập'} · còn ${pMax(a,b)-pTriesOf(b)} lượt</span></button>`;
  if(PR(c).on&&b&&b.has&&b.score!=null&&pTriesOf(b)>=pMax(a,b)&&pLesOfAsg(c,a).some(l=>!pBlock(c,s,l)&&!pDone(c,s,l)))return `<span class='muted'>Em đã dùng hết ${pMax(a,b)} lượt làm bài này. Hãy nhờ giáo viên hỗ trợ.</span>`;
  return '';
}
function pStuck(c,s,l){const si=c.students.indexOf(s),A=pAsgs(c,l);return A.length>0&&A.every(a=>{const b=a.subs[si];return b&&b.has&&b.score!=null&&pTriesOf(b)>=pMax(a,b)})}
const pLockedAsg=(a,i,blk)=>`<div class='item' id='as-${i}' tabindex='-1' style='display:block'><div class='row between'><div><span class='row' style='gap:6px;align-items:center'>${ic('lock',16)}<b>${esc(a.name)}</b></span><div class='muted'>Bài tập thuộc bài học chưa mở. Em cần đạt yêu cầu luyện tập của bài “${esc(blk.name)}” trước.</div></div><span class='pill plain'>Chưa mở</span></div></div>`;
