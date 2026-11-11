/* EducMind · js/05-helpers.js
   Hàm tiện ích dùng chung: lớp đang chọn, phần trăm, mức nắm vững, danh mục điều hướng, tiêu đề trang. */
/* ===== Hàm tiện ích ===== */
const selected=()=>{const v=visClasses();return v.find(c=>c.id===current)||v[0]};
const pct=v=>Math.round((v||0)*100);
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sAvg=s=>{const v=s.mastery.filter(x=>x!=null);return v.length?mean(v):0};
const avg=c=>mean(c.students.map(sAvg));
const openGaps=c=>c.students.flatMap(s=>s.gaps.map((g,j)=>({s,j,g})).filter(x=>x.g.status==='OPEN'));
const gaps=c=>c.goals.map((g,i)=>({g,i,m:c.scores[i],n:c.students.filter(s=>s.gaps[i].status==='OPEN').length})).filter(x=>x.n>0);
const needHelp=c=>c.students.filter(s=>s.mastery.some(v=>v!=null)&&sAvg(s)<.5);
/* Mức nắm vững: <40% Cần ôn · 40–69% Đang tiến bộ · ≥70% Vững (như bản gốc) */
const tier=v=>v<.4?'need':v<.7?'prog':'good';
const TIER={need:{label:'Cần ôn',icon:'alert'},prog:{label:'Đang tiến bộ',icon:'trend'},good:{label:'Vững',icon:'check'}};
const tierPill=v=>{const t=tier(v);return `<span class="pill ${t}">${ic(TIER[t].icon,14)}${TIER[t].label}</span>`};
const bar=(v,cls,label)=>`<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct(v)}" aria-label="${label}"><span class="${cls||''}" style="width:${pct(v)}%"></span></div>`;
const NAV=[
 ['',[['dashboard','Tổng quan']]],
 ['',[['overview','Thư mục học tập']]],
 ['Bài tập & Chấm điểm',[['calendar','Lịch & việc cần làm'],['assignments','Bài tập & kiểm tra'],['grading','Chấm điểm & Kết quả']]],
 ['Đánh giá học tập',[['report','Báo cáo tiến bộ'],['mastery','Mức độ nắm vững'],['gaps','Lỗ hổng kiến thức'],['recommend','Gợi ý học tập']]],
 ['Quản lý',[['classes','Lớp học phụ trách'],['students','Học sinh'],['questions','Ngân hàng câu hỏi'],['history','Lịch sử chỉnh sửa'],['data','Nhập / xuất dữ liệu']]]
];
/* Các trang độc lập (không nằm trong thư mục Chủ đề > Bài học) */
const navIcon={assignments:'navAsg',grading:'navGrade',history:'calendar',report:'trend',data:'overview'};
const STANDALONE_PAGES=['dashboard','calendar','history','report','data','classes','students','questions','assignments','grading','mastery','gaps','recommend'];
const TITLES={dashboard:'Tổng quan',calendar:'Lịch & việc cần làm',history:'Lịch sử chỉnh sửa',report:'Báo cáo tiến bộ',data:'Nhập / xuất dữ liệu',overview:'Thư mục học tập',classes:'Lớp học phụ trách',students:'Học sinh',questions:'Ngân hàng câu hỏi',lessons:'Bài học và mục tiêu',assignments:'Bài tập & kiểm tra',grading:'Chấm điểm & Kết quả',assessments:'Bài tập',mastery:'Mức độ nắm vững',gaps:'Lỗ hổng kiến thức',report:'Báo cáo tiến bộ',recommend:'Gợi ý học tập'};
const title=()=>{if(role==='S'&&page==='lessons'&&typeof stuLessonView!=='undefined'&&stuLessonView){const c=classes.find(x=>x.id===stuLessonView.cid),l=c&&c.lessonsData[stuLessonView.li];if(l)return l.name}return role==='T'&&!STANDALONE_PAGES.includes(page)?folderTitle():((role==='S'&&STT[page])||TITLES[page])};
function brandLogoHtml(){return `<div class='logo' aria-label='EducMind'><span class='logo-mark' aria-hidden='true'><svg viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M8.5 15.8c5.5-2.1 10.7-1.1 15.5 2.8 4.8-3.9 10-4.9 15.5-2.8v17.1c-5.5-2.1-10.7-1.1-15.5 2.8-4.8-3.9-10-4.9-15.5-2.8V15.8Z' fill='rgba(255,255,255,.16)' stroke='white' stroke-width='2.2' stroke-linejoin='round'/><path d='M24 18.6v17' stroke='white' stroke-width='2' stroke-linecap='round'/><path d='M13.8 22c2.9-.5 5.3.1 7.5 1.5M13.8 27.2c2.9-.5 5.3.1 7.5 1.5M34.2 22c-2.9-.5-5.3.1-7.5 1.5M34.2 27.2c-2.9-.5-5.3.1-7.5 1.5' stroke='white' stroke-width='1.7' stroke-linecap='round'/><path d='M34.6 7.6v5.8M31.7 10.5h5.8M40.5 15.2v3.6m-1.8-1.8h3.6' stroke='white' stroke-width='1.8' stroke-linecap='round'/></svg></span><span class='logo-word'><strong>Educ</strong><i>Mind</i></span></div>`}
