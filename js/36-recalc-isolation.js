/* EducMind · js/36-recalc-isolation.js
   Cô lập lỗi khi tính lại mức nắm vững; advance() mô phỏng ngày trôi qua. */
/* ===== Đợt 9: cô lập lỗi khi tính lại (AC-H01.5) ===== */
const ERRLOG=[],FAULTS=new Set();
const _recalcPair=recalcPair;
recalcPair=function(s,j){
  const c=classes.find(x=>x.students.includes(s))||{id:'?',goals:[]},key=c.id+'|'+s.email+'|'+j;
  try{
    if(FAULTS.has(key))throw new Error('Dữ liệu bằng chứng không hợp lệ (lỗi mô phỏng)');
    _recalcPair(s,j);
    s.mt=s.mt||[];s.mt[j]=today;
    ERRLOG.forEach(e=>{if(e.key===key&&!e.fixed){e.fixed=true;e.fixDay=today}});
  }catch(err){
    const open=ERRLOG.find(e=>e.key===key&&!e.fixed);
    if(open){open.tries++;open.last=today}
    else ERRLOG.unshift({key,day:today,last:today,cls:c.id,name:s.name,goal:c.goals[j]||'',oldDay:(s.mt&&s.mt[j]!=null)?s.mt[j]:0,msg:err.message,tries:1,fixed:false});
  }
};
function advance(n){
  today+=n;let k=0;const e0=ERRLOG.reduce((a,e)=>a+(e.fixed?0:1),0),f0=ERRLOG.length;
  const before=new Set(ERRLOG.filter(e=>!e.fixed));let fail=0;
  classes.forEach(c=>{
    c.students.forEach(s=>c.goals.forEach((_,j)=>{
      const key=c.id+'|'+s.email+'|'+j,had=ERRLOG.filter(e=>e.key===key&&!e.fixed).length,t0=ERRLOG.length;
      recalcPair(s,j);k++;
      const still=ERRLOG.filter(e=>e.key===key&&!e.fixed).length;
      if(still)fail++;
    }));
    recalcClass(c);
  });
  LOG.unshift('Ngày +'+(today-DAY0)+': lịch định kỳ tính lại '+k+' cặp (học sinh, mục tiêu): thành công '+(k-fail)+', lỗi '+fail+(fail?' (đã ghi nhật ký, giữ số cũ, sẽ thử lại ở lần chạy sau)':''));
  render();toast(fail?'Đã chạy tính lại: '+fail+' cặp lỗi bị cô lập, các cặp còn lại vẫn được tính.':'Đã chạy tính lại, không có lỗi.');
}
function openFault(){
  const c=selected();
  if(!c.students.length||!c.goals.length){toast('Lớp chưa có học sinh hoặc mục tiêu.');return}
  const sl=c.students.map((s,i)=>(i+1)+'. '+s.name),gs=c.goals.map((g,j)=>(j+1)+'. '+codeOf(c,j)+' '+g);
  openDlg({title:'Mô phỏng lỗi ở một cặp',okLabel:'Gây lỗi',text:'Đánh dấu dữ liệu của cặp (học sinh, mục tiêu) là hỏng. Ở lần tính lại tới, cặp này lỗi và bị bỏ qua, các cặp khác vẫn được tính. Khi chọn Khắc phục rồi chạy lại, cặp này tính lại bình thường.',fields:[{k:'s',label:'Học sinh',val:sl[0],sel:sl},{k:'g',label:'Mục tiêu',val:gs[0],sel:gs}],ok:v=>{
    const s=c.students[sl.indexOf(v.s)],j=gs.indexOf(v.g);
    if(!s||j<0)return 'Hãy chọn học sinh và mục tiêu.';
    FAULTS.add(c.id+'|'+s.email+'|'+j);toast('Đã gây lỗi ở cặp: '+s.name+' · '+codeOf(c,j)+'. Bấm "Chạy lại ngay" để thấy lỗi được cô lập.');return null}});
}
function clearFaults(){FAULTS.clear();render();toast('Đã khắc phục dữ liệu. Bấm "Chạy lại ngay" để cặp lỗi được tính lại ở lần chạy kế tiếp.')}
