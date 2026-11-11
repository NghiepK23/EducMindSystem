/* EducMind · js/37-avatar-ownership.js
   Ảnh đại diện, người phụ trách lớp (owns) và phạm vi chủ đề / bài học. */
/* ===== Đợt 10: gợi ý trỏ nội dung đích (S06), đếm ngược lượt làm (S03), phạm vi bài kiểm tra (T06),
   nhiều giáo viên và phân quyền (T01, T02A, T07), tải tài liệu thật (S01) ===== */
let flashId=null,cdWarn=0;
const initials=()=>acctName().split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';
/* Ảnh đại diện: chữ viết tắt + bộ màu, hoặc ảnh người dùng tải lên */
const AV_THEMES=[['default','Mặc định'],['blue','Xanh dương'],['green','Xanh lá'],['violet','Tím'],['amber','Hổ phách'],['rose','Hồng']];
const AV_KEYS=AV_THEMES.map(x=>x[0]);
const acctRec=()=>sess?(ACCT[sess.email]||(ACCT[sess.email]={})):null;
const avOf=()=>{const a=acctRec();return (a&&a.avatar)||{}};
function avatarHtml(big){
  const av=avOf(),cls='avatar'+(AV_KEYS.includes(av.theme)&&av.theme!=='default'?' av-'+av.theme:'');
  const st=big?" style='width:44px;height:44px;font-size:1rem;flex:none'":'';
  return `<span class='${cls}'${st} aria-hidden='true'>${av.photo?`<img src='${av.photo}' alt=''>`:initials()}</span>`;
}
const ownerName=c=>(ACCT[c.owner]||{}).name||c.owner;
const owns=c=>!!c&&!!sess&&sess.role==='T'&&c.owner===sess.email;
/* Phạm vi có thể được lưu dạng chuỗi ở dữ liệu cũ; chuẩn hoá về dạng {type,…} khi đọc. */
function scopeObj(c,s){
  if(!s||typeof s!=='string')return s;
  const t=s.trim();
  if(t==='Cả lớp'||t==='')return {type:'course'};
  if(t.indexOf('Chủ đề: ')===0){const x=c.topics.find(k=>k.title===t.slice(8));if(x)return {type:'topic',id:x.id}}
  if(t==='Một chủ đề'&&c.topics[0])return {type:'topic',id:c.topics[0].id};
  if(t.indexOf('Bài học: ')===0){const x=c.lessonsData.find(k=>k.name===t.slice(9));if(x)return {type:'lesson',ref:x}}
  if(t==='Một bài học'&&c.lessonsData[0])return {type:'lesson',ref:c.lessonsData[0]};
  return {type:'course'};
}
const scopeLbl=(c,sc)=>{const s=scopeObj(c,sc);return !s||s.type==='course'?'Cả lớp':s.type==='topic'?'Chủ đề: '+((c.topics.find(t=>t.id===s.id)||{title:'(đã xóa)'}).title):'Bài học: '+(s.ref?s.ref.name:'(đã xóa)')};
