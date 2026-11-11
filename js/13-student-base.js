/* EducMind · js/13-student-base.js
   Góc nhìn học sinh: thanh điều hướng, đồng hồ mô phỏng, hạn nộp, đổi vai trò, studentPage(). */
/* ===== Đợt 3: góc nhìn học sinh (US-S01–S07) ===== */
const NAVS=[
 ['',[['dashboard','Tổng quan']]],
 ['Học tập',[['calendar','Lịch & việc cần làm'],['lessons','Bài học'],['assignments','Bài tập'],['assessments','Bài kiểm tra']]],
 ['Kết quả & phân tích',[['results','Kết quả học tập'],['mastery','Mức nắm vững'],['gaps','Lỗ hổng kiến thức'],['recommend','Gợi ý học tập']]]
];
const STT={dashboard:'Tổng quan',calendar:'Lịch & việc cần làm',lessons:'Bài học',assignments:'Bài tập',assessments:'Bài kiểm tra',results:'Kết quả học tập',mastery:'Mức nắm vững',gaps:'Lỗ hổng kiến thức',recommend:'Gợi ý học tập'};
P.results=P.trend;
let stuIdx=0,taking=false,redo=null,asgQ=null,asgPick=false,asgPickObj='all',asgHook=null,aiForAsg=null;
let calendarOffset=0,calendarSelected='';
const me=()=>{const c=selected();if(role==='S'&&sess)return c.students.find(s=>s.email===sess.email);return c.students[Math.min(stuIdx,c.students.length-1)]};
const T0=Date.now();
let skew=0;
const simNow=()=>new Date(2026,9,31,12).getTime()+(today-DAY0)*864e5+(Date.now()-T0)+skew;
const dueMs=a=>{const p=a.due.split('/');return new Date(+p[2],+p[1]-1,+p[0],23,59).getTime()};
const lateMs=a=>a.lateClose?dmy(a.lateClose,23,59):dueMs(a)+3*864e5;
const inWin=a=>simNow()<=dueMs(a)||(a.allowLate&&simNow()<=lateMs(a));
const fdate=ms=>new Date(ms).toLocaleDateString('vi-VN');
const lessonOf=(c,j)=>c.lessonsData.find(l=>l.objs.some(o=>o.idx===j));
const lastEv=s=>Math.max(...s.ev.map(e=>e.length?Math.max(...e.map(x=>x.day)):-1));
classes.forEach(c=>c.students.forEach(s=>{s.att.best=s.att.last;s.rs={}}));
function switchRole(){role=role==='T'?'S':'T';stuIdx=0;taking=false;page=role==='S'?'lessons':'overview';render();window.scrollTo(0,0)}
function studentPage(){if(!me())return `<section class='panel'><h2>Lớp chưa có học sinh</h2><div class='empty'>Hãy thêm học sinh vào lớp để xem góc nhìn học sinh.</div></section>`;if(!SP[page])page='lessons';return SP[page]()}
