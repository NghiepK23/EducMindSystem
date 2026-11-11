/* EducMind · js/35-notifications.js
   Thông báo: tạo, đếm chưa đọc, mở thông báo, và scanEvents() phát hiện sự kiện mới. */
/* --- US-G03: thông báo --- */
function notify(type,title,tg,to){
  if(tg&&tg.lesson&&tg.outs)tg={page:tg.forAsg?'assignments':'questions',c:tg.c,aiId:tg.id};
  if(tg&&(tg.page==='assessments'||tg.page==='insight'))tg={page:'assignments',tab:'quiz',c:tg.c,ref:tg.ref};
  NOTIFS.unshift({id:++NID,type,title,tg:tg||{},to:to||TEACHER,read:false,at:stamp(),readAt:null});
}
const myNotifs=()=>sess?NOTIFS.filter(n=>n.to===sess.email):[];
/* Gửi thông báo cho toàn bộ học sinh của lớp khi giáo viên xuất bản nội dung mới.
   Gọi ngay tại thao tác xuất bản: object vừa tạo thường đã “Đã xuất bản” ngay từ lần quét đầu
   nên bộ dò trạng thái cũ không thấy chuyển Nháp → Đã xuất bản và không bao giờ phát thông báo. */
function notifyClass(c,type,title,tg){(c.students||[]).forEach(s=>notify(type,title,tg,s.email))}
const myUnread=()=>myNotifs().filter(n=>!n.read).length;
/* Thông báo đặt mật khẩu lần đầu: ghim, không bỏ qua / không xóa được, tự mất sau khi đổi mật khẩu thành công */
const isPinned=n=>n.type==='ACCOUNT_CREATED'&&!!(ACCT[n.to]||{}).mustChange;
function dropSetpwNotif(email){for(let i=NOTIFS.length-1;i>=0;i--)if(NOTIFS[i].type==='ACCOUNT_CREATED'&&NOTIFS[i].to===email)NOTIFS.splice(i,1)}
function notifBtn(){
  const u=myUnread(),lbl='Thông báo'+(u?', '+u+' chưa xem':'');
  /* Nút đã ở dạng icon-only: con số chưa xem phải là một badge nhìn thấy được, không chỉ nằm trong aria-label. */
  return `<button class='btn light icon-only notif-btn' data-iconified='1' onclick='openNotifs()' aria-label='${lbl}' title='${lbl}'>${ic('bell',18)}<span class='sr'>Thông báo</span>${u?`<span class='nb' aria-hidden='true'>${u>9?'9+':u}</span>`:''}</button>`;
}
function openNotifs(){
  const L=myNotifs().slice().sort((a,b)=>isPinned(b)-isPinned(a)).slice(0,20);
  openDlg({title:'Thông báo',okLabel:'Đánh dấu tất cả đã xem',text:L.length?L.map(n=>{const pn=isPinned(n);return `<button type='button' onclick='openNotif(${n.id})' style='display:block;width:100%;text-align:left;border:1px solid ${pn?'var(--need-bar)':'var(--line)'};background:${n.read?'var(--surface)':'var(--brand-soft)'};border-radius:9px;padding:9px 11px;margin:0 0 6px;cursor:pointer;font:inherit;color:inherit'><b>${n.read?'':'● '}${esc(n.title)}</b>${pn?` <span class='pill need'>Bắt buộc</span>`:''}<div class='muted' style='font-size:12px'>${pn?'Không thể bỏ qua hoặc xóa. Bấm vào để đặt mật khẩu riêng; thông báo tự mất sau khi đổi mật khẩu thành công.':n.at}</div></button>`}).join(''):'Chưa có thông báo nào.',ok:()=>{myNotifs().forEach(n=>{if(!n.read&&!isPinned(n)){n.read=true;n.readAt=stamp()}});if(myNotifs().some(isPinned))toast('Thông báo đặt mật khẩu riêng không thể bỏ qua: nó chỉ mất sau khi em đổi mật khẩu thành công.');return null}});
}
/* Mỗi loại thông báo mở đúng màn hình nghiệp vụ:
   bài học mới → đúng bài học đó; bài tập mới → đúng thẻ bài tập của lớp;
   học sinh nộp bài → danh sách chấm của đúng bài tập đó, con trỏ ở dòng của học sinh;
   học sinh nộp bài kiểm tra → đúng phần chấm lượt làm của bài kiểm tra. */
let gradeForce=null;
function notifLessonOf(c,ref){
  const sc=scopeObj(c,ref&&ref.scope);
  if(sc&&sc.type==='lesson'&&sc.ref&&c.lessonsData.includes(sc.ref))return sc.ref;
  if(sc&&sc.type==='topic'){const l=c.lessonsData.find(x=>x.tid===sc.id);if(l)return l}
  if(ref&&ref.objs&&ref.objs.length){const l=lessonOf(c,ref.objs[0]);if(l)return l}
  return c.lessonsData[0]||null;
}
function folderOpenGrading(c,l,kind,index,tab,flash){
  if(!c)return false;
  folderTopicId=(l&&l.tid)||null;folderLessonName=l?l.name:null;
  grItemType=kind||'asg';gradeAi=+index||0;grTab=tab||'mark';
  gradeForce=kind==='quiz'?'quiz':(+index||0);page='grading';taking=false;redo=null;
  render();window.scrollTo(0,0);
  if(flash){flashId=flash;render()}
  return true;
}
function openNotif(id){
  const n=NOTIFS.find(x=>x.id===id);if(!n||!sess||n.to!==sess.email)return;
  if(!n.read&&!isPinned(n)){n.read=true;n.readAt=stamp()}dlg=null;
  const t=n.tg||{},c=t.c;
  if(t.act==='setpw'){if((ACCT[sess.email]||{}).mustChange)changePw(true);else{render();toast('Em đã đặt mật khẩu riêng cho tài khoản này.')}return}
  if(!classes.includes(c)){render();toast('Nội dung không còn khả dụng.');return}
  current=c.id;taking=false;redo=null;gradeForce=null;dlg=null;
  const asg=t.ref&&c.assignments.includes(t.ref)?t.ref:null,ai=asg?c.assignments.indexOf(asg):-1;
  const si=t.who?c.students.findIndex(s=>s.email===t.who):-1;
  const S=role==='S',T=role==='T';
  if(S&&n.type==='NEW_RECOMMENDATION'){
    const key=t.recKey,s0=me();if(key)markRecKeys(s0,[key],'notification');
    const rec=key&&recsOf(c,s0).find(x=>x[0]+'|'+x[2]===key);
    if(rec&&rec[4]){openTarget(rec[4]);toast('Đã mở gợi ý: '+rec[2]+'.');return}
    page='recommend';focusId='nav-recommend';render();toast('Đã ghi nhận gợi ý đã xem.');return;
  }
  /* giáo viên: học sinh nộp bài → mở đúng danh sách chấm của bài đó, làm nổi dòng của học sinh */
  if(T&&(n.type==='NEW_SUBMISSION'||n.type==='SUBMISSION_RESUBMITTED')&&asg)
    return void folderOpenGrading(c,notifLessonOf(c,asg),'asg',ai,'mark',si>=0?'grow-'+si:null);
  /* giáo viên: có lượt làm bài kiểm tra cần chấm → mở đúng phần chấm lượt làm */
  if(T&&n.type==='NEW_ASSESSMENT_ATTEMPT_SUBMITTED')
    return void folderOpenGrading(c,notifLessonOf(c,c.quiz),'quiz',0,'result');
  /* học sinh: bài tập mới / được cấp thêm lượt → mở luôn phiếu làm bài của đúng bài tập đó */
  if(S&&(n.type==='NEW_ASSIGNMENT_PUBLISHED'||n.type==='EXTRA_TRY_GRANTED')&&asg){
    const s0=me(),b0=asg.subs[c.students.indexOf(s0)];
    const canDo=!!b0&&(asgIsQ(asg)?rdAllowed(c,s0,asg,b0):(!b0.has||rdAllowed(c,s0,asg,b0)));
    page='assignments';render();window.scrollTo(0,0);
    if(canDo){if(asgIsQ(asg))openAssignmentMode(ai);else workOpen(ai);return}
    focusId='as-'+ai;flashId='as-'+ai;render();window.scrollTo(0,0);return;
  }
  /* học sinh: bài đã chấm / có nhận xét → mở đúng thẻ bài tập để xem điểm */
  if(S&&(n.type==='ASSIGNMENT_GRADED'||n.type==='AI_FB_SENT')&&asg){
    page='assignments';focusId='as-'+ai;flashId='as-'+ai;render();window.scrollTo(0,0);return;
  }
  /* học sinh: nhận xét cho bài kiểm tra → mở Kết quả */
  if(S&&n.type==='AI_FB_SENT'&&t.ref===c.quiz){
    page='results';focusId='nav-results';render();window.scrollTo(0,0);return;
  }
  /* học sinh: bài kiểm tra → trang bài kiểm tra, hoặc Kết quả khi đã có điểm */
  if(S&&(n.type==='NEW_ASSESSMENT_PUBLISHED'||n.type==='ASSESSMENT_GRADED')){
    page=n.type==='ASSESSMENT_GRADED'?'results':'assessments';focusId='nav-'+page;render();window.scrollTo(0,0);return;
  }
  /* học sinh: bài học mới / bài học vừa được mở → mở đúng không gian bài học đó */
  if(S&&(n.type==='NEW_LESSON_PUBLISHED'||n.type==='LESSON_UNLOCKED')&&t.ref){
    const li=c.lessonsData.indexOf(t.ref),lv=c.lessonsData[li];
    if(lv&&lv.status==='Đã xuất bản'){stuOpenLesson(li);return}
    /* bài học chưa xuất bản hoặc đã bị gỡ: mở đúng chủ đề chứa nó */
    if(lv&&lv.tid)stuTopicState[lv.tid]=true;
    page='lessons';focusId='nav-lessons';render();
    const el=lv&&lv.tid&&document.getElementById('stopic-'+lv.tid);
    if(el){flashId='stopic-'+lv.tid;render()}
    window.scrollTo(0,0);return;
  }
  /* giáo viên: bài học vừa xuất bản → mở đúng bài học trong thư mục */
  if(T&&n.type==='NEW_LESSON_PUBLISHED'&&t.ref)return void dashboardOpen('goals',t.ref.tid,t.ref.name);
  /* nhánh chung cho các loại còn lại (gợi ý học tập, tài khoản, …) */
  let ok=!!t.page;
  if(ok&&t.ref){const r=t.ref;ok=r===c.quiz?!c.quiz.deleted:(c.lessonsData.includes(r)||c.assignments.includes(r))}
  if(!ok){render();toast('Nội dung không còn khả dụng.');return}
  if(T&&t.page==='assignments'&&asg){const l=notifLessonOf(c,asg);return void dashboardOpen('assignments',l&&l.tid,l&&l.name)}
  page=t.page;if(t.aiId)aiOpen=t.aiId;if(t.tab)asgTab=t.tab;
  focusId='nav-'+page;render();window.scrollTo(0,0);
}
function snap(o,st,f){const p=SNAP.get(o);SNAP.set(o,st);if(p!==undefined&&p!==st)f(p,st)}
function scanEvents(){
  classes.forEach(c=>{
    const all=(type,title,tg)=>notifyClass(c,type,title,tg);
    /* thông báo xuất bản được phát ngay tại thao tác xuất bản (notifyClass), không dò lại ở đây */
    c.lessonsData.forEach(l=>snap(l,l.status,()=>{}));
    c.assignments.forEach(a=>{
      snap(a,a.status,()=>{});
      a.subs.forEach((b,i)=>{
        const s=c.students[i];if(!s)return;
        if(SNAP.get(b)===undefined&&b.has)b.ever=true;
        snap(b,(b.has?1:0)+':'+(b.score!=null?1:0),(p,n)=>{
          if(p[0]==='0'&&n[0]==='1'){notify(b.ever?'SUBMISSION_RESUBMITTED':'NEW_SUBMISSION',s.name+(b.ever?' đã nộp lại bài tập: ':' đã nộp bài: ')+a.name,{page:'assignments',c,ref:a,who:s.email},c.owner);b.ever=true}
          if(p[2]==='0'&&n[2]==='1')notify('ASSIGNMENT_GRADED','Bài tập “'+a.name+'” của bạn đã được chấm điểm',{page:'results',c,ref:a},s.email);
        });
      });
    });
    const q=c.quiz;
    if(!q.deleted)snap(q,q.status,()=>{});
    c.students.forEach(s=>{
      s.atts.forEach(t=>snap(t,t.status,(p,n)=>{
        if(p==='IN_PROGRESS'&&n!=='IN_PROGRESS')notify('NEW_ASSESSMENT_ATTEMPT_SUBMITTED','Có bài kiểm tra cần chấm: '+s.name+' (lượt '+t.n+')',{page:'assessments',c,who:s.email},c.owner);
        if(p!=='GRADED'&&n==='GRADED')notify('ASSESSMENT_GRADED','Bài tập của bạn đã có điểm',{page:'results',c,ref:c.quiz},s.email);
      }));
      const active=activeRecs(c,s),keys=new Set(active.map(x=>x[0]+'|'+x[2]));
      if(s.known)keys.forEach(k=>{if(!s.known.has(k)){const x=active.find(z=>z[0]+'|'+z[2]===k);notify('NEW_RECOMMENDATION','Gợi ý học tập: '+k.split('|')[0]+' · '+k.split('|').slice(1).join('|'),{page:'recommend',c,recKey:k},s.email)}});
      s.known=keys;
    });
  });
}
