/* EducMind · js/68-demo-curriculum.js
   Dữ liệu học tập mẫu: danh mục chủ đề / bài học Tin học và mô hình mạng máy tính. */
/* ===== Sửa giao diện thư mục và thay dữ liệu học tập mẫu bằng danh mục người dùng cung cấp ===== */
const CURRICULUM=[
 {title:'MÁY TÍNH VÀ XÃ HỘI TRI THỨC',lessons:[
  'Bài 1. Thông tin và xử lí thông tin']}
];
function resetAcademicDemoData(){
  classes.forEach((c,ci)=>{
    c.topic='';c.lessons=[];c.goals=[];c.scores=[];c.lessonsData=[];c.assignments=[];c.bank=[];c.trash=[];c.cres=[];
    c.quiz={name:'',status:'Nháp',dur:15,open:'',close:'',qs:[],deleted:true,scope:{type:'course'}};c.maxAtt=3;
    c.topics=[];c.topicDel=false;c.cres=[];
    c.students.forEach(s=>{s.ev=[];s.mastery=[];s.gaps=[];s.att={used:0,last:0,best:null,real:null,cur:null};s.atts=[];s.attOld=[];s.rs={};s.known=new Set()});
    if(c.grade===10){
      c.topics=CURRICULUM.map((t,i)=>({id:'CURR-'+c.id+'-'+(i+1),title:t.title,desc:'',status:'Đã xuất bản'}));
      c.lessonsData=[];
      CURRICULUM.forEach((t,ti)=>t.lessons.forEach(name=>c.lessonsData.push({name,status:'Đã xuất bản',desc:'',goals:[],res:[],objs:[],tid:c.topics[ti].id,upd:null})));
      c.topic=c.topics[0]?.title||'';
    }
    c.count=c.students.length;
  });
  LOG.length=0;
  if(typeof AIREQ!=='undefined')AIREQ.length=0;
  if(typeof NOTIFS!=='undefined')NOTIFS.length=0;
}
resetAcademicDemoData();
/* Khôi phục một bộ mục tiêu thật cho lớp demo sau thao tác reset dữ liệu học tập.
   Các bài mẫu Sinh tồn và bài nộp kết quả bên dưới dùng đúng ba mục tiêu này. */
(function initNetworkLearningModel(){
  const c=classes.find(x=>x.id==='10A1');if(!c)return;
  const goals=['Nhận biết mạng LAN, MAN, WAN','Phân biệt vai trò các giao thức TCP/IP','Cấu hình và nhận biết địa chỉ IP'];
  c.topic='Mạng máy tính';c.lessons=['Mạng máy tính và Internet'];c.goals=goals;c.scores=goals.map(()=>0);c.topicDel=false;
  if(!c.topics.length)c.topics.push({id:'CURR-'+c.id+'-1',title:'MẠNG MÁY TÍNH VÀ INTERNET',desc:'',status:'Đã xuất bản'});
  c.topics[0].title='MẠNG MÁY TÍNH VÀ INTERNET';c.topics[0].status='Đã xuất bản';
  let l=c.lessonsData[0];if(!l){l={tid:c.topics[0].id};c.lessonsData.push(l)}
  Object.assign(l,{name:'Mạng máy tính và Internet',desc:'Các khái niệm LAN, giao thức mạng và địa chỉ IP.',status:'Đã xuất bản',tid:c.topics[0].id,
    goals:goals.map((desc,idx)=>({idx,code:'LO0'+(idx+1),desc})),
    objs:goals.map((desc,idx)=>({idx,code:'LO0'+(idx+1),desc}))});
  c.students.forEach(s=>{s.ev=goals.map(()=>[]);s.mastery=goals.map(()=>null);s.gaps=goals.map(()=>({status:'NONE'}));s.conf=goals.map(()=>null)});
})();
