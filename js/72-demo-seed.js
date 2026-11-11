/* EducMind · js/72-demo-seed.js
   Nạp dữ liệu demo cuối cùng: bài tập trò chơi mẫu, kết quả mẫu, dọn tài khoản demo. */
/* Bài tập trò chơi có sẵn cho học sinh thử: Sinh tồn tri thức · Mạng máy tính.
   Bài gắn câu hỏi thật vào luồng nộp/chấm/ghi bằng chứng hiện có; chỉ tạo một lần trong mỗi lần tải ứng dụng. */
(function seedInteractiveGameAssignment(){
  const c=classes.find(x=>x.id==='10A1')||classes[0];
  if(!c)return;
  const priorDemo=c.assignments.findIndex(a=>a.aid==='TUG-DEMO-10A1'||(a.interactiveDemo&&/kéo co/i.test(a.name||'')));
  if(priorDemo>=0&&!(c.assignments[priorDemo].subs||[]).some(b=>b&&b.has))c.assignments.splice(priorDemo,1);
  if(c.assignments.some(a=>a.aid==='SURV-DEMO-10A1'))return;
  const defs=[
    {content:'Mạng LAN thường kết nối thiết bị trong phạm vi nào?',type:'SINGLE_CHOICE',opts:['Một phòng, gia đình hoặc trường học','Một quốc gia','Toàn cầu bằng vệ tinh','Chỉ thiết bị Bluetooth'],ans:0,objs:[0],explain:'LAN (Local Area Network) kết nối thiết bị trong phạm vi nhỏ như gia đình, văn phòng hoặc trường học.'},
    {content:'Giao thức IP có vai trò chính nào?',type:'SINGLE_CHOICE',opts:['Định địa chỉ và chuyển gói tin giữa các mạng','Lưu mật khẩu người dùng','Hiển thị trang web','Phát Wi-Fi'],ans:0,objs:[1],explain:'IP dùng địa chỉ IP để chuyển gói tin tới mạng hoặc thiết bị đích.'},
    {content:'Địa chỉ nào có định dạng IPv4 hợp lệ?',type:'SINGLE_CHOICE',opts:['192.168.1.25','192.168.1.300','192.168.1','300.1.1.1'],ans:0,objs:[2],explain:'IPv4 có bốn số, mỗi số từ 0 đến 255, ngăn cách bằng dấu chấm.'},
    {content:'Chọn hai thiết bị có thể kết nối vào mạng LAN.',type:'MULTIPLE_CHOICE',opts:['Máy tính xách tay','Máy in mạng','Cái bàn gỗ','Đèn pin'],ans:[0,1],objs:[0],explain:'Máy tính và máy in mạng là thiết bị đầu cuối có thể trao đổi dữ liệu qua LAN.'},
    {content:'DNS thường giúp máy tính làm việc gì?',type:'SINGLE_CHOICE',opts:['Phân giải tên miền thành địa chỉ IP','Tăng tốc độ quạt máy tính','Mã hóa mọi tệp trong ổ cứng','Cấp điện cho router'],ans:0,objs:[1],explain:'DNS giúp tra tên miền, ví dụ example.com, thành địa chỉ IP mà mạng có thể định tuyến.'},
    {content:'TCP hỗ trợ truyền dữ liệu tin cậy bằng cách kiểm tra và sắp xếp lại các gói tin.',type:'TRUE_FALSE',opts:['Đúng','Sai'],ans:0,objs:[1],explain:'TCP kiểm soát việc truyền nhận, thứ tự và gửi lại dữ liệu khi cần.'},
    {content:'Thiết bị nào thường chuyển tiếp dữ liệu giữa các mạng khác nhau?',type:'SINGLE_CHOICE',opts:['Router','Bàn phím','Màn hình','Webcam'],ans:0,objs:[1],explain:'Router định tuyến gói tin giữa các mạng, chẳng hạn mạng gia đình và Internet.'},
    {content:'Địa chỉ 192.168.1.24 thường thuộc loại nào?',type:'SINGLE_CHOICE',opts:['Địa chỉ IPv4 riêng dùng trong mạng nội bộ','Địa chỉ IPv6','Tên miền công cộng','Địa chỉ MAC'],ans:0,objs:[2],explain:'Dải 192.168.0.0–192.168.255.255 được dành cho địa chỉ IPv4 riêng.'},
    {content:'Chọn các địa chỉ thuộc dải IPv4 riêng.',type:'MULTIPLE_CHOICE',opts:['10.0.0.8','172.16.5.4','172.32.5.4','8.8.8.8'],ans:[0,1],objs:[2],explain:'Các dải riêng gồm 10.0.0.0/8, 172.16.0.0/12 và 192.168.0.0/16.'},
    {content:'Trong mạng Wi-Fi gia đình, các thiết bị kết nối không dây vẫn có thể thuộc cùng một LAN.',type:'TRUE_FALSE',opts:['Đúng','Sai'],ans:0,objs:[0],explain:'LAN có thể dùng Ethernet hoặc Wi-Fi; “cục bộ” nói về phạm vi mạng, không bắt buộc phải có dây.'},
    {content:'Subnet mask 255.255.255.0 thường cho biết phần mạng chiếm bao nhiêu bit?',type:'SINGLE_CHOICE',opts:['24 bit','8 bit','16 bit','32 bit'],ans:0,objs:[2],explain:'255.255.255.0 tương đương tiền tố /24, tức 24 bit đầu là phần mạng.'},
    {content:'WAN thường có phạm vi địa lý lớn hơn LAN.',type:'TRUE_FALSE',opts:['Đúng','Sai'],ans:0,objs:[0],explain:'WAN (Wide Area Network) kết nối các mạng trên phạm vi rộng, có thể qua nhiều thành phố hoặc quốc gia.'}
  ];
  const ids=defs.map((d,i)=>{
    let q=c.bank.find(x=>!x.del&&x.content===d.content);
    if(!q){q={id:'SURV10A1Q'+(i+1)};c.bank.push(q)}
    Object.assign(q,{content:d.content,type:d.type,opts:d.opts.slice(),ans:Array.isArray(d.ans)?d.ans.slice():d.ans,objs:d.objs.slice(),explain:d.explain,diff:d.diff||'MEDIUM',bloom:d.bloom||'Vận dụng',src:q.src||'MANUAL',upd:stamp()});
    return {qid:q.id,w:1};
  });
  const a={aid:'SURV-DEMO-10A1',cid:c.id,name:'Thử nghiệm Sinh tồn tri thức · Mạng máy tính',
    desc:'Khám phá 12 trạm kiến thức về mạng máy tính. Đáp án đúng giúp nạp năng lượng; đáp án sai mất một khiên nhưng mở lời giải để em học tiếp.',
    kind:'QUIZ',gameMode:'survival',scope:{type:'course'},qs:ids,objs:[0,1,2],max:12,
    due:dmyStr(simNow()+14*864e5),allowLate:false,lateClose:null,maxTries:3,
    status:'Đã xuất bản',submitted:0,graded:0,upd:'Bài mẫu có sẵn',interactiveDemo:true,
    subs:c.students.map(()=>({score:null,has:false,tries:0,status:'',extra:0,fb:'',text:'',file:null,edited:false,qa:[],hist:[]}))};
  c.assignments.unshift(a);
})();

/* Bài nộp mẫu đã chấm để học sinh xem được kết quả, chi tiết từng câu và bằng chứng mức nắm vững.
   Tách khỏi game sinh tồn để Lan Anh vẫn có thể bắt đầu lượt chơi mới. */
(function seedStudentLearningResult(){
  const c=classes.find(x=>x.id==='10A1'),s=c&&c.students.find(x=>x.email==='hs11@school.edu.vn');
  if(!c||!s)return;
  const prior=c.assignments.find(a=>a.aid==='LANANH-RESULT-10A1');
  if(prior){
    /* Bài kết quả demo này được thực hiện theo format trò chơi tương tác; sửa dữ liệu demo cũ chưa lưu format. */
    prior.gameMode='survival';const priorB=prior.subs&&prior.subs[c.students.indexOf(s)];
    if(priorB&&priorB.has&&!priorB.presentation)priorB.presentation='survival';
    if(priorB&&priorB.text==='Bài làm dạng trắc nghiệm · đã nộp và được chấm')priorB.text='Đã hoàn thành trò chơi tương tác Sinh tồn tri thức';
    return;
  }
  const specs=[
    {content:'Mạng LAN thường kết nối thiết bị trong phạm vi nào?',answer:0,ok:true,fb:'Tốt: em nhận biết đúng phạm vi mạng cục bộ.'},
    {content:'Giao thức IP có vai trò chính nào?',answer:0,ok:true,fb:'Tốt: IP định địa chỉ và hỗ trợ chuyển gói tin.'},
    {content:'Địa chỉ nào có định dạng IPv4 hợp lệ?',answer:1,ok:false,fb:'Ôn lại IPv4: mỗi địa chỉ có bốn số, và mỗi số phải nằm trong khoảng 0–255.'},
    {content:'Chọn hai thiết bị có thể kết nối vào mạng LAN.',answer:[0,1],ok:true,fb:'Chính xác: máy tính và máy in mạng đều có thể là thiết bị trong LAN.'},
    {content:'DNS thường giúp máy tính làm việc gì?',answer:0,ok:true,fb:'Chính xác: DNS phân giải tên miền thành địa chỉ IP.'}
  ];
  const qs=specs.map((d,i)=>{
    const q=c.bank.find(x=>!x.del&&x.content===d.content);if(!q)return null;
    const label=q.type==='MULTIPLE_CHOICE'?d.answer.map(k=>q.opts[k]).join('; '):q.opts[d.answer];
    return {q,qid:q.id,w:2,d,answerLabel:label};
  }).filter(Boolean);
  if(qs.length!==specs.length)return;
  const a={aid:'LANANH-RESULT-10A1',cid:c.id,name:'Bài luyện tập mẫu · Mạng máy tính',
    desc:'Bài làm minh họa theo trò chơi tương tác Sinh tồn tri thức, đã chấm để học sinh xem điểm, phản hồi và tiến bộ theo từng mục tiêu.',kind:'QUIZ',gameMode:'survival',
    scope:{type:'course'},qs:qs.map(x=>({qid:x.qid,w:x.w})),objs:[0,1,2],max:10,
    due:dmyStr(simNow()-864e5),allowLate:false,lateClose:null,maxTries:3,status:'Đã xuất bản',submitted:1,graded:1,upd:'Bài làm mẫu',sampleResult:true,
    subs:c.students.map(()=>({score:null,has:false,tries:0,status:'',extra:0,fb:'',text:'',file:null,edited:false,qa:[],hist:[]}))};
  const si=c.students.indexOf(s),b=a.subs[si];
  b.has=true;b.tries=1;b.status='GRADED';b.presentation='survival';b.text='Đã hoàn thành trò chơi tương tác Sinh tồn tri thức';
  b.fb='Kết quả tốt. Em đã nắm được LAN, IP và DNS; cần ôn lại quy tắc giới hạn từng octet của địa chỉ IPv4.';
  b.qa=qs.map(x=>({q:x.q.content,t:x.q.type,a:x.answerLabel,w:x.w,objs:(x.q.objs||[]).slice(),got:x.d.ok?x.w:0,fb:x.d.fb,ok:x.d.ok}));
  c.assignments.unshift(a);
  asgFinal(c,0,si);
  a.submitted=1;a.graded=1;
})();

/* Giữ lại đúng hai tài khoản demo được yêu cầu; toàn bộ luồng xác thực và phân quyền không đổi. */
const _lanAnhAccount=classes.flatMap(c=>c.students).find(s=>s.name==='Lan Anh');
const _keptDemoAccounts=new Set([TEACHER,_lanAnhAccount&&_lanAnhAccount.email].filter(Boolean));
Object.keys(ACCT).forEach(email=>{if(!_keptDemoAccounts.has(email))delete ACCT[email]});
/* Đảm bảo tài khoản demo HS Lan Anh tồn tại và đăng nhập được bằng mật khẩu chung. */
if(_lanAnhAccount){ACCT[_lanAnhAccount.email]=Object.assign(ACCT[_lanAnhAccount.email]||{}, {role:'STUDENT',name:_lanAnhAccount.name,pw:hashPw('demo123'),deleted:false})}
TOKS.length=0;
MAIL.length=0;
if(typeof NOTIFS!=='undefined')for(let i=NOTIFS.length-1;i>=0;i--)if(!_keptDemoAccounts.has(NOTIFS[i].to))NOTIFS.splice(i,1);
