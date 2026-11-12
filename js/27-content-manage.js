/* EducMind · js/27-content-manage.js
   Quản lý nội dung: tài khoản mẫu, chủ đề, tạo lớp, thêm / xóa học sinh, tài liệu chung. */
/* ===== Đợt 7: quản lý nội dung (US-T00, T01, T02A, T02, T03) ===== */
let TID=1;
/* Tài khoản demo đã gỡ bỏ: hệ thống chỉ dùng tài khoản thật đăng ký qua Supabase. */
const ACCT={};
const topicOf=(c,l)=>c.topics.find(t=>t.id===l.tid)||{title:c.topic,status:'Đã xuất bản'};
const topicLive=(c,l)=>{const t=c.topics.find(x=>x.id===l.tid);return !!t&&t.status==='Đã xuất bản'};
const hasData=(c,j)=>c.students.some(s=>s.mastery[j]!=null);
const syncTopic=c=>{c.topic=c.topics[0]?c.topics[0].title:''};
function scopeLive(c,a){
  const s=a.scope;if(!s||s.type==='course')return true;
  if(s.type==='topic'){const t=c.topics.find(x=>x.id===s.id);return !!t&&t.status==='Đã xuất bản'}
  const l=c.lessonsData.find(x=>x===s.ref);return !!l&&l.status==='Đã xuất bản'&&topicLive(c,l);
}
classes.forEach(c=>{
  c.topics=[{id:'T'+(TID++),title:c.topic,desc:'Chủ đề '+c.topic,status:'Đã xuất bản'}];
  c.lessonsData.forEach(l=>{l.tid=c.topics[0].id});c.cres=[];c.left=[];c.addLog=[];
  if(c.assignments[0])c.assignments[0].scope={type:'lesson',ref:c.lessonsData[0]};
  if(c.assignments[1])c.assignments[1].scope={type:'topic',id:c.topics[0].id};
  if(c.quiz&&!c.quiz.deleted)c.quiz.scope={type:'lesson',ref:c.lessonsData[c.lessonsData.length-1]};
  c.students.forEach(s=>{ACCT[s.email]={role:'STUDENT',name:s.name}});
});
function addGoal(c,desc){
  const j=c.goals.length;c.goals.push(desc);c.scores.push(0);
  c.students.forEach(s=>{s.ev.push([]);s.mastery.push(null);s.gaps.push({status:'NONE'})});
  return j;
}
/* --- US-T00: lớp và học sinh --- */
/* Tên lớp = khối + ký hiệu lớp: 10A1 (khối 10, lớp A1), 11B2, 8A1 (THCS 6–9)… Khối suy ra từ tên lớp */
function parseClassId(name){
  const m=/^([0-9]{1,2})([A-Z][0-9]{1,2})$/.exec(String(name||'').trim().toUpperCase());
  if(!m)return null;
  const g=parseInt(m[1],10);
  return (g>=1&&g<=12)?{id:m[1]+m[2],grade:g}:null;
}
const CLS_ERR='Tên lớp phải theo định dạng khối + lớp, ví dụ 10A1 (khối 10, lớp A1), 11B2, 8A1 cho THCS (6–9) hoặc 10A1–12A9 cho THPT.';
function newClass(){
  openDlg({title:'Tạo lớp mới',text:'Sau khi lưu, bạn là người phụ trách lớp và có thể thêm học sinh, tạo chủ đề và bài học.',okLabel:'Tạo lớp',fields:[{k:'n',label:'Tên lớp',hint:'Khối lấy theo tên lớp — ví dụ 10A1 là khối 10, lớp A1; 8A1 là khối 8 (THCS).',val:''},{k:'y',label:'Năm học',val:'2026–2027'}],ok:v=>{
    const p=parseClassId(v.n);
    if(!String(v.n||'').trim())return 'Tên lớp không được để trống.';
    if(!p)return CLS_ERR;
    const n=p.id,g=p.grade;
    if(classes.some(x=>x.id===n))return 'Đã có lớp trùng tên.';
    classes.push({id:n,owner:sess.email,grade:g,sy:v.y.trim(),count:0,topic:'',lessons:[],goals:[],scores:[],teacher:'Cô Lan',students:[],lessonsData:[],assignments:[],quiz:{name:'',status:'Nháp',dur:15,open:'',close:'',qs:[],deleted:true},maxAtt:null,trash:[],bank:[],topics:[],cres:[],left:[],addLog:[]});
    current=n;page='students';toast('Đã tạo lớp '+n+'. Bạn là người phụ trách lớp này.');return null}});
}
function addStudentRec(c,email,name){
  const s={id:c.id+'-HS'+(c.students.length+1+c.left.length),name,email,ev:c.goals.map(()=>[]),mastery:c.goals.map(()=>null),gaps:c.goals.map(()=>({status:'NONE'})),att:{used:0,last:0,best:null,real:null,cur:null},atts:[],rs:{}};
  c.students.push(s);c.assignments.concat(c.trash.filter(t=>t.ref).map(t=>t.ref)).forEach(a=>a.subs.push({score:null,has:false}));c.count=c.students.length;
}
const DEFPW='EducMind@2026';
function addStudents(){
  const c=selected();
  openDlg({title:'Thêm học sinh vào lớp '+esc(c.id),text:'Mỗi dòng một học sinh: email, họ tên, có thể thêm mật khẩu riêng. Tài khoản mới dùng mật khẩu mặc định bên dưới và phải đổi ở lần đăng nhập đầu tiên; email đã có trong hệ thống chỉ được thêm vào lớp. Dòng không hợp lệ sẽ bị bỏ qua.',okLabel:'Thêm học sinh',fields:[{k:'t',label:'Danh sách (email, họ tên[, mật khẩu])',val:'',area:true},{k:'p',label:'Mật khẩu mặc định cho tài khoản mới (tối thiểu '+PW_MIN+' ký tự)',val:DEFPW}],ok:v=>{
    const lines=v.t.split(NL).map(x=>x.trim()).filter(Boolean),dpw=String(v.p||'');
    if(!lines.length)return 'Hãy nhập ít nhất một dòng.';
    if(dpw.length<PW_MIN)return 'Mật khẩu mặc định phải có ít nhất '+PW_MIN+' ký tự.';
    const log=[];let n=0;
    lines.forEach((ln,i)=>{
      const parts=ln.split(',').map(x=>x.trim()),email=(parts[0]||'').toLowerCase(),name=parts[1]||'',own=parts[2]||'',at=email.indexOf('@'),L='Dòng '+(i+1)+': ';
      if(at<1||!email.slice(at).includes('.')||email.includes(' ')){log.push(L+'email không hợp lệ ('+ln+').');return}
      const acc=ACCT[email];
      if(acc&&acc.role==='TEACHER'){log.push(L+email+' thuộc tài khoản giáo viên, bị từ chối.');return}
      if(c.students.some(s=>s.email===email)){log.push(L+email+' đã có trong lớp, không thêm lần hai.');return}
      let entry=null;
      if(acc)entry=L+email+': dùng tài khoản học sinh đã có, không tạo trùng.';
      else{
        if(!name){log.push(L+'thiếu họ tên cho tài khoản mới ('+email+').');return}
        const pw=own||dpw;
        if(pw.length<PW_MIN){log.push(L+'mật khẩu mặc định của '+email+' phải có ít nhất '+PW_MIN+' ký tự.');return}
        ACCT[email]={role:'STUDENT',name,pw:hashPw(pw),mustChange:true};
        notify('ACCOUNT_CREATED','Tài khoản EducMind của em đã được tạo. Hãy đặt mật khẩu riêng thay cho mật khẩu mặc định ('+acctName()+' thêm em vào lớp '+c.id+').',{act:'setpw'},email);
        entry={t:L+email+': đã tạo tài khoản, mật khẩu mặc định ',email,pw};
      }
      addStudentRec(c,email,name||acc.name);n++;log.push(entry);
    });
    c.addLog=log;toast('Đã thêm '+n+'/'+lines.length+' học sinh vào lớp.');return null}});
}
const addLogLine=l=>typeof l==='string'?`<div class='item'><div class='muted'>${esc(l)}</div></div>`:`<div class='item'><div class='muted'>${esc(l.t)}${(ACCT[l.email]||{}).mustChange?`<b style='color:var(--ink)'>${esc(l.pw)}</b> · học sinh chưa đặt mật khẩu riêng.`:'(đã ẩn: học sinh đã tự đặt mật khẩu riêng).'}</div></div>`;
function removeStudent(i){
  const c=selected(),s=c.students[i];
  openDlg({title:'Đưa '+esc(s.name)+' ra khỏi lớp?',text:'Học sinh không còn thấy nội dung học tập của lớp. Bằng chứng, mức nắm vững, bài nộp và lượt làm bài đã ghi nhận được giữ nguyên.',danger:true,okLabel:'Đưa ra khỏi lớp',ok:()=>{
    c.assignments.concat(c.trash.filter(t=>t.ref).map(t=>t.ref)).forEach(a=>{a.subs.splice(i,1);a.submitted=a.subs.filter(x=>x.has).length;a.graded=a.subs.filter(x=>x.score!=null).length});
    c.students.splice(i,1);c.left.push({s,at:stamp()});c.count=c.students.length;stuIdx=0;toast('Đã đưa học sinh ra khỏi lớp; kết quả học tập vẫn được giữ.');return null}});
}
function students(){
  const c=selected();
  return `<section class='panel' aria-labelledby='h-students'><div class='row between'><span style='flex:1'></span><button class='btn' onclick='addStudents()'>${ic('plus',16)}Thêm học sinh</button></div>${c.students.length?`<div class='tablewrap'><table><thead><tr><th scope='col' style='width:56px;text-align:center'>STT</th><th scope='col' style='text-align:center'>Học sinh</th><th scope='col' style='text-align:center'>Email</th><th scope='col' style='text-align:center'>Trạng thái</th><th scope='col'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${c.students.map((s,i)=>{const d=s.mastery.some(v=>v!=null),m=sAvg(s);return `<tr><td class='stt'>${i+1}</td><td class='student'>${esc(s.name)}</td><td>${esc(s.email)}${(ACCT[s.email]||{}).mustChange?` <span class='pill plain'>Chưa đặt mật khẩu riêng</span>`:''}</td><td>${!d?`<span class='pill plain'>Chưa có dữ liệu</span>`:m<.5?`<span class='pill need'>${ic('alert',14)}Cần hỗ trợ</span>`:`<span class='pill prog'>${ic('trend',14)}Đang học</span>`}</td><td><button class='btn light' onclick='removeStudent(${i})' aria-label='Đưa ${esc(s.name)} ra khỏi lớp'>Đưa ra khỏi lớp</button></td></tr>`}).join('')}</tbody></table></div>`:`<div class='empty'>Lớp chưa có học sinh. Chọn “Thêm học sinh” để bắt đầu.</div>`}</section>${c.addLog.length?`<section class='panel'><h2 style='font-size:15px'>Kết quả thêm học sinh gần nhất</h2><p class='lead'>Hãy gửi email và mật khẩu mặc định cho từng học sinh. Mỗi học sinh tự đặt mật khẩu riêng ở lần đăng nhập đầu; giáo viên không xem được mật khẩu riêng đó.</p>${c.addLog.map(addLogLine).join('')}</section>`:''}${c.left.length?`<section class='panel'><h2 style='font-size:15px'>Đã ra khỏi lớp</h2><p class='lead'>Kết quả học tập vẫn được giữ trong cơ sở dữ liệu.</p>${c.left.map(x=>`<div class='item'><div><b>${esc(x.s.name)}</b><div class='muted'>${esc(x.s.email)} · ${x.at}</div></div></div>`).join('')}</section>`:''}`;
}
/* --- US-T02A, T02: chủ đề, bài học, mục tiêu, tài liệu chung --- */
function goalsIn(c){
  if(mFil[0]==='L'&&+mFil.slice(1)>=c.lessonsData.length)mFil='all';
  if(mFil[0]==='T'&&!c.topics.some(t=>t.id===mFil.slice(1)))mFil='all';
  return c.goals.map((_,j)=>j).filter(j=>{const l=lessonOf(c,j);if(mFil==='all')return true;if(mFil==='del')return !l;if(!l)return false;if(mFil[0]==='T')return l.tid===mFil.slice(1);return c.lessonsData.indexOf(l)===+mFil.slice(1)});
}
function filterBar(c){
  const del=c.trash.some(t=>t.type==='Bài học'),op=(v,t)=>`<option value='${v}' ${mFil===v?'selected':''}>${esc(t)}</option>`;
  return `<div class='selectbox' style='max-width:360px;margin-bottom:12px'><label for='mf'>Lọc theo chủ đề hoặc bài học</label><select id='mf' onchange='mFil=this.value;render()'>${op('all','Tất cả mục tiêu')}${c.topics.map(t=>op('T'+t.id,'Chủ đề: '+t.title)).join('')}${c.lessonsData.map((l,i)=>op('L'+i,'Bài học: '+l.name)).join('')}${del?op('del','Bài học đã xóa'):''}</select></div>`;
}
function courseDocs(c){
  return `<section class='panel' aria-labelledby='h-cd'><div class='row between'><h2 id='h-cd' style='font-size:15px'>Tài liệu chung của lớp</h2><button class='btn light' onclick='pickCourseFile(-1)'>${ic('plus',16)}Đính kèm tài liệu</button></div><p class='muted' style='margin:4px 0 0'>Tối đa 50 MB · ${ALLOWED.join(', ').toUpperCase()}</p>${c.cres.map((r,ri)=>`<div class='row between' style='padding:5px 0'><span>${esc(r.name)} <span class='muted'>· ${fsize(r.size)}</span></span><span class='row'><button class='btn light' onclick='pickCourseFile(${ri})'>Thay tệp</button><button class='btn light' onclick='delCourseFile(${ri})'>Xóa</button></span></div>`).join('')}</section>`;
}
function pickCourseFile(ri){
  const inp=document.createElement('input');inp.type='file';
  inp.onchange=()=>{
    const f=inp.files[0];if(!f)return;const c=selected(),ext=f.name.split('.').pop().toLowerCase();
    if(f.size>52428800){toast('Tệp '+fsize(f.size)+' vượt giới hạn 50 MB, bị từ chối.');return}
    if(!ALLOWED.includes(ext)){toast('Định dạng .'+ext+' không được phép. Cho phép: '+ALLOWED.join(', ')+'.');return}
    const r={name:f.name,size:f.size,blob:f};if(ri>=0)c.cres[ri]=r;else c.cres.push(r);render();toast('Đã lưu tài liệu chung của lớp');
  };
  inp.click();
}
function delCourseFile(ri){
  const c=selected(),r=c.cres[ri];
  openDlg({title:'Xóa tài liệu chung?',text:esc(r.name)+' sẽ không còn tải được đối với học sinh.',danger:true,okLabel:'Xóa tài liệu',ok:()=>{c.trash.unshift({type:'Tài liệu',name:r.name,note:'Tài liệu chung của lớp; học sinh không còn tải được',objIdx:[],at:stamp()});c.cres.splice(ri,1);toast('Đã xóa mềm tài liệu');return null}});
}
