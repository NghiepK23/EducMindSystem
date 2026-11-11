/* EducMind · js/57-grading-demo-data.js
   Dữ liệu mẫu để thử luồng chấm bài (nạp / xóa) và hộp thoại chấm bài nộp tệp. */
/* ===== Dữ liệu mẫu để kiểm tra luồng chấm bài =====
   Nạp sẵn: mục tiêu + ngân hàng câu hỏi + 6 học sinh + 2 bài đã giao với đủ trạng thái
   (chờ chấm / đã chấm / nộp trễ / chưa nộp) để thử ngay trang Chấm điểm & Kết quả. */
const DEMO_GOALS=['Nhận biết thông tin, dữ liệu và vật mang tin','Trình bày được quá trình xử lí thông tin','Phân biệt dữ liệu và thông tin trong ví dụ thực tế'];
const DEMO_STUDENTS=[['Nguyễn Lan Anh','lananh'],['Trần Minh Khoa','minhkhoa'],['Lê Thu Hà','thuha'],['Phạm Gia Bảo','giabao'],['Vũ Hoàng My','hoangmy'],['Đỗ Quang Huy','quanghuy']];
function demoQs(){
  return [
    {content:'Thông tin là gì?',type:'SINGLE_CHOICE',opts:['Những hiểu biết về thế giới quanh ta','Các con số được nhập vào máy tính','Âm thanh phát ra từ loa','Tệp dữ liệu lưu trong USB'],ans:0,objs:[0],diff:'EASY',bloom:'Nhận biết',w:1},
    {content:'Vật mang tin là gì?',type:'SINGLE_CHOICE',opts:['Bộ não của con người','Thông tin đã được xử lí','Phương tiện lưu trữ và truyền thông tin','Kết quả tìm kiếm trên Internet'],ans:2,objs:[0],diff:'MEDIUM',bloom:'Nhận biết',w:1},
    {content:'Trình bày ngắn gọn ba bước của quá trình xử lí thông tin.',type:'SHORT_ANSWER',opts:[],ans:null,objs:[1],diff:'MEDIUM',bloom:'Hiểu',w:2},
    {content:'Lấy một ví dụ thực tế, chỉ rõ đâu là dữ liệu và đâu là thông tin sau khi xử lí.',type:'ESSAY',opts:[],ans:null,objs:[2],diff:'HARD',bloom:'Vận dụng',w:3}
  ];
}
const demoHas=()=>classes.some(c=>(c.assignments||[]).some(a=>a.demo));
function seedGradingDemo(force){
  const c=selected();
  if(!c){toast('Hãy chọn một lớp trước.');return}
  if(role!=='T'||!owns(c)){toast('Bị từ chối: lớp này không do bạn phụ trách.');return}
  if(c.assignments.some(a=>a.demo)){toast('Dữ liệu mẫu đã có sẵn trong lớp này.');return}
  /* 1. mục tiêu + bài học */
  if(!c.goals.length||c.goals.length<3)c.goals=DEMO_GOALS.slice();
  /* mục tiêu có thể nhiều hơn lúc lớp được tạo: bù mảng bằng chứng cho từng học sinh */
  c.students.forEach(s=>{
    for(let j=0;j<c.goals.length;j++){
      if(!s.ev[j])s.ev[j]=[];
      if(s.mastery.length<=j)s.mastery.push(null);
      if(s.gaps.length<=j)s.gaps.push({status:'NONE'});
    }
  });
  let L=c.lessonsData[0];
  if(!L){
    const t=c.topics[0]||{id:1,title:'MÁY TÍNH VÀ XÃ HỘI TRI THỨC'};
    if(!c.topics.length)c.topics.push(t);
    L={name:'Bài 1. Thông tin và xử lí thông tin',desc:'',status:'Đã xuất bản',goals:[],res:[],objs:[],tid:t.id,upd:stamp()};
    c.lessonsData.push(L);
  }
  L.objs=[{idx:0,code:'LO01'},{idx:1,code:'LO02'},{idx:2,code:'LO03'}];
  /* 2. học sinh */
  const findStu=n=>c.students.find(s=>s.name===n)||c.students.find(s=>n.endsWith(s.name))||c.students.find(s=>s.name.endsWith(n));
  DEMO_STUDENTS.forEach(x=>{if(!findStu(x[0]))addStudentRec(c,x[1]+'@hocsinh.edu.vn',x[0])});
  /* 3. ngân hàng câu hỏi (dùng lại nếu đã có câu cùng nội dung) */
  const defs=demoQs(),ids=defs.map(d=>{
    const old=c.bank.find(q=>!q.del&&q.content===d.content);
    if(old)return old.id;
    const id='DEMO'+(c.bank.length+1);
    c.bank.push({id,content:d.content,type:d.type,opts:d.opts,ans:d.ans,objs:d.objs,diff:d.diff,bloom:d.bloom,src:'MANUAL',upd:stamp()});
    return id;
  });
  const scope={type:'lesson',ref:L};
  const due=dmyStr(simNow()+4*864e5),lateClose=dmyStr(simNow()+6*864e5);
  /* 4. bài kiểm tra: 2 trắc nghiệm (tự chấm) + 1 trả lời ngắn + 1 tự luận (chấm tay) */
  const a1={demo:true,aid:'DEMOA1',cid:c.id,name:'Kiểm tra 15 phút · Thông tin và xử lí thông tin',desc:'Bài kiểm tra mẫu để thử luồng chấm điểm.',
    kind:'QUIZ',scope,qs:ids.map((qid,i)=>({qid,w:defs[i].w})),objs:[0,1,2],max:defs.reduce((n,d)=>n+d.w,0),
    due,allowLate:true,lateClose,maxTries:2,status:'Đã xuất bản',submitted:0,graded:0,upd:stamp(),
    subs:c.students.map(()=>({score:null,has:false}))};
  /* 5. bài nộp tệp: chấm tay bằng một ô điểm + nhận xét */
  const a2={demo:true,aid:'DEMOA2',cid:c.id,name:'Bài thu hoạch · Xử lí thông tin',desc:'Nộp báo cáo 1 trang: mô tả một tình huống thực tế và chỉ ra dữ liệu – thông tin.',
    kind:'FILE',scope,qs:[],objs:[1,2],max:10,due,allowLate:false,lateClose:null,maxTries:1,status:'Đã xuất bản',submitted:0,graded:0,upd:stamp(),
    subs:c.students.map(()=>({score:null,has:false}))};
  c.assignments.push(a1,a2);
  /* 6. bài nộp mẫu cho từng học sinh */
  const qaOf=(vals)=>defs.map((d,i)=>({q:d.content,t:d.type,a:(vals[i]&&vals[i][0])||'',w:d.w,objs:d.objs,got:vals[i]?vals[i][1]:null,fb:'',ok:d.type==='SINGLE_CHOICE'?(vals[i]&&vals[i][1]===d.w):null}));
  const sub=(a,si,o)=>{a.subs[si]=Object.assign({score:null,has:false,tries:0,status:'SUBMITTED',fb:'',text:'',file:null,edited:false,qa:[],hist:[]},o)};
  const idxName=n=>{const st=findStu(n);return st?c.students.indexOf(st):-1};
  const mk=(a,si,o)=>{sub(a,si,o);a.submitted=a.subs.filter(x=>x.has).length};

  /* Lan Anh: đã nộp, trắc nghiệm đúng cả 2, còn 2 câu tự luận chờ chấm */
  mk(a1,idxName('Nguyễn Lan Anh'),{has:true,tries:1,qa:qaOf([['A. Những hiểu biết về thế giới quanh ta',1],['C. Phương tiện lưu trữ và truyền thông tin',1],['Nhập vào → xử lí → xuất ra',null],['Nhiệt độ đo được là dữ liệu; “hôm nay trời nóng” là thông tin sau khi xử lí.',null]])});
  /* Minh Khoa: đã nộp, chưa chấm câu nào */
  mk(a1,idxName('Trần Minh Khoa'),{has:true,tries:1,qa:qaOf([['Những hiểu biết về thế giới quanh ta',1],['Thông tin đã được xử lí',0],['Thu nhận, xử lí, lưu trữ và truyền thông tin',null],['Điểm số trong sổ là dữ liệu, học lực xếp loại là thông tin.',null]])});
  /* Hoàng My: nộp trễ */
  mk(a1,idxName('Vũ Hoàng My'),{has:true,tries:2,status:'LATE',qa:qaOf([['Những hiểu biết về thế giới quanh ta',1],['Phương tiện lưu trữ và truyền thông tin',1],['',null],['',null]])});
  /* Thu Hà: đã chấm đủ 4 câu → có điểm, có bằng chứng nắm vững */
  mk(a1,idxName('Lê Thu Hà'),{has:true,tries:1,qa:qaOf([['Những hiểu biết về thế giới quanh ta',1],['Phương tiện lưu trữ và truyền thông tin',1],['Ba bước: thu nhận, xử lí, xuất thông tin.',1.5],['Ảnh chụp nhiệt kế là dữ liệu; kết luận “sốt 39 độ” là thông tin.',2.5]])});
  a1.subs[idxName('Lê Thu Hà')].fb='Trình bày rõ, ví dụ sát thực tế. Cần nêu thêm bước lưu trữ.';
  /* Gia Bảo: chưa nộp (để thử bộ lọc "Chưa nộp") */
  /* Quang Huy: đã chấm, điểm thấp hơn, để thấy mức nắm vững khác nhau */
  mk(a1,idxName('Đỗ Quang Huy'),{has:true,tries:1,qa:qaOf([['Những hiểu biết về thế giới quanh ta',1],['Kết quả tìm kiếm trên Internet',0],['Thu nhận và xử lí thông tin.',1],['Chưa lấy được ví dụ cụ thể.',1]])});
  a1.subs[idxName('Đỗ Quang Huy')].fb='Cần lấy ví dụ cụ thể và nêu đủ ba bước.';
  a1.graded=a1.subs.filter(x=>x.score!=null).length;

  /* bài nộp tệp */
  mk(a2,idxName('Nguyễn Lan Anh'),{has:true,tries:1,text:'BÁO CÁO XỬ LÍ THÔNG TIN\n\n1. Tình huống: đo nhiệt độ cơ thể bằng nhiệt kế điện tử.\n2. Dữ liệu: con số 39.2 hiện trên màn hình.\n3. Thông tin: kết luận “bạn đang sốt cao, cần nghỉ ngơi”.\n4. Ba bước: thu nhận → xử lí → xuất thông tin.',file:{name:'bao-cao-lan-anh.docx'}});
  mk(a2,idxName('Lê Thu Hà'),{has:true,tries:1,text:'BÁO CÁO\n\nVí dụ: giỏ hàng của một trang thương mại điện tử.\n- Dữ liệu: danh sách mặt hàng, số lượng, đơn giá.\n- Thông tin: tổng tiền phải trả và gợi ý mua thêm.\n- Quá trình: máy tính thu nhận dữ liệu, tính toán, xuất hoá đơn.',file:{name:'bao-cao-thu-ha.pdf'}});
  a2.subs[idxName('Lê Thu Hà')].score=8;
  a2.subs[idxName('Lê Thu Hà')].fb='Bố cục rõ, ví dụ tốt. Cần nêu thêm vật mang tin.';
  a2.graded=a2.subs.filter(x=>x.score!=null).length;

  /* 7. chấm sẵn hai bài kiểm tra đã có đủ điểm để hiện điểm và mức nắm vững */
  [['Lê Thu Hà'],['Đỗ Quang Huy']].forEach(([n])=>{const si=idxName(n);if(si>=0)asgFinal(c,c.assignments.indexOf(a1),si)});
  a2.objs.forEach(j=>{const si=idxName('Lê Thu Hà'),s=c.students[si],key='A'+a2.aid;
    const r=a2.subs[si].score/a2.max,x=s.ev[j].find(e=>e.key===key);
    if(x){x.s=r;x.day=today}else s.ev[j].push({s:r,day:today,src:'Bài tập',key});
    recalcPair(s,j)});
  recalcClass(c);
  LOG.unshift('Đã nạp dữ liệu mẫu chấm bài cho lớp '+c.id+': 2 bài, '+c.students.length+' học sinh.');
  asgTab='asg';grItemType='asg';gradeAi=0;grTab='mark';grFilA='all';grMore=25;
  render();
  toast('Đã nạp dữ liệu mẫu: 2 bài cần chấm cho '+c.students.length+' học sinh. Mở “Chấm điểm & Kết quả” để thử.');
}
function clearGradingDemo(){
  const c=selected();if(!c)return;
  const n=c.assignments.filter(a=>a.demo).length;
  if(!n){toast('Lớp này không có dữ liệu mẫu.');return}
  c.assignments=c.assignments.filter(a=>!a.demo);
  c.students.forEach(s=>{s.ev=s.ev.map(list=>list.filter(e=>!(e.key||'').startsWith('ADEMO')))});
  c.students.forEach((s,j)=>c.goals.forEach((_,k)=>recalcPair(s,k)));
  recalcClass(c);gradeAi=0;
  LOG.unshift('Đã xoá '+n+' bài mẫu khỏi lớp '+c.id+'.');
  render();toast('Đã xoá '+n+' bài mẫu.');
}
/* chấm bài nộp tệp bằng hộp thoại (trước đây nút Chấm đọc một ô nhập không còn tồn tại) */
function gradeFileDlg(ai,si){
  const c=selected(),a=c.assignments[ai],s=c.students[si],b=a.subs[si];
  if(!b||!b.has){toast('Học sinh này chưa nộp bài.');return}
  const work=(b.text?`<div class='muted' style='margin-top:8px;max-height:200px;overflow:auto;white-space:pre-wrap;font:400 .8125rem/1.5 var(--font-body)'>${esc(b.text)}</div>`:'')+(b.file?`<div class='muted' style='margin-top:8px'>Tệp đính kèm: ${esc(b.file.name)}</div>`:'');
  const hasRubric=!!(a.rubric&&a.rubric.length);
  const fields=hasRubric?rubricGradeFields(a,b):[{k:'sc',label:'Điểm (0–'+a.max+')',val:b.score==null?'':b.score}];
  fields.push({k:'fb',label:'Nhận xét chung cho học sinh',val:b.fb||'',area:true});
  openDlg({title:'Chấm bài nộp · '+s.name,text:`<b>${esc(a.name)}</b>${work}${hasRubric?`<div class='rubric-total-hint'>Nhập điểm theo từng tiêu chí; tổng sẽ tạo thành điểm bài tối đa ${a.max}.</div>`:''}`,okLabel:'Lưu điểm',fields,ok:v=>{
    let sc,rubricScores=null;
    if(hasRubric){const parsed=rubricRead(v,a);if(parsed.error)return parsed.error;sc=parsed.total;rubricScores=parsed.scores}
    else{const raw=String(v.sc||'').trim().replace(',','.');if(raw==='')return 'Hãy nhập điểm (0–'+a.max+').';sc=parseFloat(raw);if(isNaN(sc)||sc<0||sc>a.max)return 'Điểm phải từ 0 đến '+a.max+'.'}
    b.score=sc;b.fb=String(v.fb||'').trim();b.gradedBy=acctName();if(rubricScores)b.rubricScores=rubricScores;
    const key='A'+a.aid,before=s.mastery.slice();
    (a.objs||[]).forEach(j=>{if(!s.ev[j])s.ev[j]=[];const r=sc/a.max,x=s.ev[j].find(e=>e.key===key);if(x){x.s=r;x.day=today}else s.ev[j].push({s:r,day:today,src:'Bài tập',key});recalcPair(s,j)});
    recalcClass(c);a.graded=a.subs.filter(x=>x.score!=null).length;
    LOG.unshift('Chấm “'+a.name+'” cho '+s.name+' ('+c.id+'): '+((a.objs||[]).map(j=>c.goals[j]+' '+pct(before[j])+'%→'+pct(s.mastery[j])+'%').join('; ')||'không có mục tiêu gắn'));
    return null}});
}
