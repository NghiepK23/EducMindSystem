/* EducMind · js/01-sample-data.js
   Dữ liệu mẫu demo đã gỡ bỏ (chỉ dùng cho chế độ demo đã ngừng hoạt động). */
/* ===== Dữ liệu mẫu ===== */
const DAY0=100;
let today=DAY0,LOG=[],gradeAi=0;
const HL=30,T_OPEN=.5,T_CLOSE=.65;
const classSeed=[];
const first=['Minh','Lan Anh','Đức Duy','Gia Hân','Hoàng Nam','Khánh Linh','Tuấn Kiệt','Ngọc Mai'];
const surnames=['Nguyễn','Trần','Lê','Phạm','Võ','Đặng','Bùi','Hoàng'];
function jitter(a,b){return (a*3+b*5)%5}
const classes=classSeed.map((c,ci)=>({...c,owner:c.owner||'co.lan@educmind.vn',
  students:Array.from({length:c.count},(_,i)=>({id:c.id+'-HS'+(i+1),
    name:i===0?first[(ci+1)%first.length]:surnames[(i+ci)%surnames.length]+' '+first[(i+ci+2)%first.length],
    email:'hs'+(ci+1)+(i+1)+'@school.edu.vn',
    ev:c.scores.map((v,j)=>{const m=Math.max(.15,Math.min(.98,v+((i%3)-1)*.07+(j%2)*.025));const n=2+(i+jitter(ci,i)+j)%4;return Array.from({length:n},(_,k)=>({s:Math.max(0,Math.min(1,m+(k%2?-.03:.03))),day:DAY0-(k*6+j+1),src:'Bài tập'}))}),mastery:[],conf:[],gaps:c.scores.map(()=>({status:'NONE'})),
    att:{used:1+(i%2),last:0}})),
  lessonsData:c.lessons.map((name,i)=>({name,status:'Đã xuất bản',goals:c.goals.slice(i===0?0:1)})),
  assignments:[
    {name:'Luyện tập: '+c.topic,status:'Đã xuất bản',due:'05/11/2026',submitted:Math.max(1,c.count-1),graded:Math.max(0,c.count-3)},
    {name:'Vận dụng: '+c.goals[0],status:'Đã xuất bản',due:'09/11/2026',submitted:Math.max(1,c.count-2),graded:Math.max(0,c.count-4)}],
  quiz:{name:'Bài tập '+c.topic,status:'Đã xuất bản',attempts:Math.max(1,c.count-1),average:(5.8+ci*.35).toFixed(1)}}));
