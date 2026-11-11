/* EducMind · js/20-question-bank-core.js
   Ngân hàng câu hỏi dùng chung theo khối: dạng câu hỏi, độ khó, liên kết lớp với ngân hàng. */
/* ===== Đợt 4: ngân hàng câu hỏi và bài kiểm tra (US-T05, T06, T13, T14, T15) ===== */
P.questions=P.assessments;
TITLES.questions='Ngân hàng câu hỏi';
let QID=1,pendOnly=false;
const NL=String.fromCharCode(10);
const QT={SINGLE_CHOICE:'Một lựa chọn',MULTIPLE_CHOICE:'Nhiều lựa chọn',TRUE_FALSE:'Đúng/Sai',SHORT_ANSWER:'Trả lời ngắn',ESSAY:'Tự luận'},QTK=Object.keys(QT),QTV=QTK.map(k=>QT[k]);
const DF={EASY:'Dễ',MEDIUM:'Trung bình',HARD:'Khó'},DFK=Object.keys(DF),DFV=DFK.map(k=>DF[k]);
const BL=['Nhớ','Hiểu','Vận dụng','Phân tích','Đánh giá','Sáng tạo'];
const ST={IN_PROGRESS:'Đang làm',SUBMITTED:'Đã nộp, chờ chấm',GRADED:'Đã chấm'};
const isObjT=t=>t!=='SHORT_ANSWER'&&t!=='ESSAY',isObj=q=>isObjT(q.type);
const qOf=(c,id)=>c.bank.find(q=>q.id===id);
const qMax=c=>c.quiz.qs.reduce((n,x)=>n+x.w,0);
const hasAtt=c=>c.students.some(s=>s.att.used>0);
const qLocked=(c,q)=>(hasAtt(c)&&c.quiz.qs.some(x=>x.qid===q.id))||c.assignments.some(a=>a.kind==='QUIZ'&&a.subs.some(b=>b&&(b.has||b.redo))&&(a.qs||[]).some(x=>x.qid===q.id));
const dmy=(t,h,m)=>{const p=t.trim().split('/');return new Date(+p[2],+p[1]-1,+p[0],h,m).getTime()};
const okD=t=>t.trim().split('/').length===3&&!isNaN(dmy(t,0,0));
const qWindow=c=>{const n=simNow();return n>=dmy(c.quiz.open,0,0)&&n<=dmy(c.quiz.close,23,59)};
const codeOf=(c,j)=>{const l=lessonOf(c,j),o=l&&l.objs.find(x=>x.idx===j);return o?o.code:'LO0'+(j+1)};
const codeMap=c=>{const m={};c.lessonsData.forEach(l=>l.objs.forEach(o=>{m[o.code.toUpperCase()]=o.idx}));return m};
const offOf=(c,s)=>{const g=s.atts.filter(x=>x.status==='GRADED');return g.length?Math.max(...g.map(x=>x.total)):null};
/* ===== Ngân hàng câu hỏi dùng chung theo KHỐI =====
   Mỗi khối (10, 11, 12) do giáo viên dạy có MỘT ngân hàng riêng, dùng chung cho mọi lớp thuộc khối đó.
   `c.bank` vẫn dùng được ở mọi nơi như cũ nhưng thực chất trỏ về ngân hàng của khối. */
const BANK={};
const bankKeyOf=(owner,grade)=>owner+'|'+grade;
function bankFor(owner,grade){const k=bankKeyOf(owner,grade);if(!BANK[k])BANK[k]=[];return BANK[k]}
const bankOf=c=>bankFor(c.owner||(sess&&sess.email)||'shared',c.grade);
function linkBank(c){
  const d=Object.getOwnPropertyDescriptor(c,'bank');
  if(d&&d.get&&d.set)return;
  const seed=Array.isArray(c.bank)?c.bank.slice():[];
  Object.defineProperty(c,'bank',{configurable:true,enumerable:true,
    get(){return bankOf(c)},
    set(v){const a=bankOf(c);a.length=0;(v||[]).forEach(x=>a.push(x))}});
  const b=bankOf(c);
  seed.forEach(q=>{if(!b.some(x=>x.id===q.id))b.push(q)});
}
/* Lớp cùng khối + cùng giáo viên → dùng chung ngân hàng */
const bankClasses=c=>visClasses().filter(x=>x.grade===c.grade);
/* Mã mục tiêu của câu hỏi: dùng mã đã lưu khi tạo, tránh lệch chỉ số giữa các lớp cùng khối */
function qCodes(c,q){
  if(q.objCodes&&q.objCodes.length)return q.objCodes;
  return (q.objs||[]).map(j=>codeOf(c,j));
}
/* Bài học của câu hỏi: ưu tiên nhãn đã lưu, nếu chưa có thì suy ra từ mục tiêu đầu tiên */
function qbLessonOf(c,q){
  if(q.lesson)return q.lesson;
  const j=(q.objs||[])[0];
  const l=j==null?null:lessonOf(c,j);
  return l?l.name:'';
}
/* Chuẩn hoá câu hỏi trước khi lưu vào ngân hàng (đúng format cho mọi nguồn: tự soạn, tệp, AI) */
function normQ(c,q){
  q.diff=q.diff||'MEDIUM';q.bloom=q.bloom||'Vận dụng';
  q.type=q.type&&QT[q.type]?q.type:'SINGLE_CHOICE';
  q.opts=Array.isArray(q.opts)?q.opts:[];
  q.objs=(q.objs||[]).filter(j=>typeof j==='number'&&j>=0);
  q.src=q.src||'MANUAL';
  if(!q.lesson){const l=q.objs.length?lessonOf(c,q.objs[0]):null;q.lesson=l?l.name:''}
  if(!q.objCodes||!q.objCodes.length)q.objCodes=q.objs.map(j=>codeOf(c,j));
  return q;
}
classes.forEach(linkBank);
function seedBank(c){
  c.bank=[];const add=o=>c.bank.push(Object.assign({id:'C'+(QID++),diff:'MEDIUM',bloom:'Vận dụng',src:'MANUAL',objs:[],opts:[],ans:null},o));
  c.goals.forEach((g,j)=>add({content:'Phát biểu nào đúng nhất về mục tiêu “'+g+'”?',type:'SINGLE_CHOICE',opts:optsOf({ans:j%3}),ans:j%3,objs:[j],bloom:'Hiểu'}));
  add({content:'Chọn tất cả phát biểu đúng khi vận dụng hai mục tiêu đầu của lớp.',type:'MULTIPLE_CHOICE',opts:['Phát biểu đúng thứ nhất','Phát biểu sai','Phát biểu đúng thứ hai','Phát biểu không liên quan'],ans:[0,2],objs:[0,1]});
  add({content:'Trình bày bằng lời của em: '+c.goals[0],type:'ESSAY',objs:[0],diff:'HARD',bloom:'Phân tích'});
  Object.assign(c.quiz,{qs:c.bank.map(q=>({qid:q.id,w:2})),open:'25/10/2026',close:'30/11/2026',status:'Đã xuất bản'});
  const mx=qMax(c);
  c.students.forEach(s=>{s.atts=Array.from({length:s.att.used},(_,k)=>{const r=k===s.att.used-1?s.att.last:Math.max(.2,s.att.last-.1);return {n:k+1,status:'GRADED',ratio:r,total:+(r*mx).toFixed(1),seed:true,at:'Dữ liệu mẫu'}})});
}
const _seededBanks=new Set();
classes.forEach(c=>{const k=bankKeyOf(c.owner||(sess&&sess.email)||'shared',c.grade);if(_seededBanks.has(k))return;_seededBanks.add(k);seedBank(c)});
