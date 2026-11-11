/* EducMind · js/19-calendar.js
   Lịch & việc cần làm: hạn nộp, lịch kiểm tra, bài chờ chấm. */
/* ===== Lịch & việc cần làm: tổng hợp hạn nộp, lịch kiểm tra và bài chờ chấm ===== */
function calDateKey(text){
  const v=String(text||'').trim();
  let m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if(m)return m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);
  m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v);return m?m[1]+'-'+m[2]+'-'+m[3]:'';
}
function calDateLabel(key){if(!key)return 'Chưa có ngày';const p=key.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function calEvents(){
  const source=role==='S'?[selected()]:visClasses(),out=[];
  source.filter(Boolean).forEach(c=>{
    const s=role==='S'?me():null,si=s?c.students.indexOf(s):-1;
    if(role==='S'&&si<0)return;
    (c.assignments||[]).forEach((a,i)=>{
      if(a.status!=='Đã xuất bản'||!scopeLive(c,a))return;
      const sub=s?((a.subs||[])[si]||{has:false,score:null}):null;
      if(s&&(sub.has||pAsgBlock(c,s,a)))return;
      const key=calDateKey(a.due);if(!key)return;
      out.push({key,title:a.name||'Bài tập',kind:'due',label:'Hạn nộp',classId:c.id,className:c.id,role,ref:i,late:!s&&a.submitted<c.count&&a.submitted>0});
    });
    const q=c.quiz||{};
    if(!q.deleted&&q.status==='Đã xuất bản'&&scopeLive(c,q)){
      const open=calDateKey(q.open),close=calDateKey(q.close);
      if(open)out.push({key:open,title:q.name||'Bài kiểm tra',kind:'exam',label:'Mở bài kiểm tra',classId:c.id,className:c.id,ref:'quiz'});
      if(close&&close!==open)out.push({key:close,title:q.name||'Bài kiểm tra',kind:'exam',label:'Đóng bài kiểm tra',classId:c.id,className:c.id,ref:'quiz'});
    }
    if(!s){
      (c.assignments||[]).forEach((a,i)=>{
        const waiting=(a.subs||[]).filter(x=>x&&x.has&&x.score==null).length;
        if(waiting)out.push({key:'',title:a.name||'Bài tập',kind:'grading',label:waiting+' bài chờ chấm',classId:c.id,className:c.id,ref:i,count:waiting});
      });
      const pending=(c.students||[]).reduce((n,x)=>n+(x.atts||[]).filter(a=>a.status==='SUBMITTED').length,0);
      if(pending)out.push({key:'',title:q.name||'Bài kiểm tra',kind:'grading',label:pending+' lượt kiểm tra chờ chấm',classId:c.id,className:c.id,ref:'quiz',count:pending});
    }
  });
  return out.sort((a,b)=>a.key.localeCompare(b.key)||a.title.localeCompare(b.title));
}
function calMoveMonth(delta){calendarOffset+=delta;const d=new Date(simNow());d.setDate(1);d.setMonth(d.getMonth()+calendarOffset);calendarSelected=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-01';render()}
function calChooseDay(key){calendarSelected=key;render()}
function calOpenEvent(e){
  if(e.classId&&visClasses().some(c=>c.id===e.classId))current=e.classId;
  if(role==='S'){page=e.kind==='exam'?'assessments':'assignments';focusId=e.kind==='exam'?'qz':'as-'+e.ref}
  else{page=e.kind==='grading'?'grading':'assignments';if(e.kind!=='grading')gradeAi=Number(e.ref)||0;focusId='nav-'+page}
  render();window.scrollTo(0,0);
}
function calendarPage(){
  const base=new Date(simNow());base.setDate(1);base.setMonth(base.getMonth()+calendarOffset);
  const y=base.getFullYear(),m=base.getMonth(),monthKey=y+'-'+('0'+(m+1)).slice(-2);
  if(!calendarSelected||!calendarSelected.startsWith(monthKey))calendarSelected=monthKey+'-01';
  const ev=calEvents(),monthEvents=ev.filter(x=>x.key.startsWith(monthKey)),byDay={};monthEvents.forEach(x=>(byDay[x.key]||(byDay[x.key]=[])).push(x));
  const firstDay=(new Date(y,m,1).getDay()+6)%7,lastDay=new Date(y,m+1,0).getDate(),cells=[];
  for(let i=0;i<firstDay;i++)cells.push(`<span class='cal-cell is-blank' aria-hidden='true'></span>`);
  for(let d=1;d<=lastDay;d++){
    const key=monthKey+'-'+('0'+d).slice(-2),items=byDay[key]||[],selected=key===calendarSelected;
    cells.push(`<button type='button' class='cal-cell${selected?' is-selected':''}${items.length?' has-events':''}' aria-label='${d} ${new Date(y,m,d).toLocaleDateString('vi-VN',{month:'long'})}, ${items.length} hoạt động' aria-pressed='${selected}' onclick="calChooseDay('${key}')"><b>${d}</b>${items.length?`<span class='cal-dots' aria-hidden='true'>${items.slice(0,3).map(x=>`<i class='${x.kind}'></i>`).join('')}</span>`:''}</button>`);
  }
  const selectedEvents=ev.filter(x=>x.key===calendarSelected),upcoming=ev.filter(x=>x.key&&x.key>=calDateKey(new Date(simNow()).toISOString().slice(0,10))).slice(0,5);
  const noDate=ev.filter(x=>!x.key),isTeacher=role!=='S';
  const monthName=base.toLocaleDateString('vi-VN',{month:'long',year:'numeric'});
  const renderEvent=e=>`<button type='button' class='cal-event ${e.kind}' onclick='calOpenEvent(${JSON.stringify(e).replace(/'/g,"&#39;")})'><span class='cal-event-date'>${e.key?calDateLabel(e.key):'Cần xử lý'}</span><span class='cal-event-main'><b>${esc(e.title)}</b><small>${esc(e.label)}${isTeacher?' · Lớp '+esc(e.className):''}</small></span><span class='cal-event-kind'>${e.kind==='due'?'Bài tập':e.kind==='exam'?'Kiểm tra':'Chấm bài'}</span></button>`;
  return `<div class='calendar-page'>
    <section class='panel cal-welcome'><div><span class='cal-eyebrow'>KẾ HOẠCH HỌC TẬP</span><h2>Lịch & việc cần làm</h2><p>${isTeacher?'Theo dõi hạn nộp, lịch kiểm tra và khối lượng cần chấm của các lớp.':'Các hạn nộp và lịch kiểm tra dành cho em, cùng những việc cần ưu tiên tiếp theo.'}</p></div><button class='btn light' onclick="calendarOffset=0;calendarSelected='';render()">${ic('calendar',16)}Tháng hiện tại</button></section>
    <div class='cal-layout'><section class='panel cal-month-panel'><div class='cal-month-head'><button type='button' class='btn light cal-nav' aria-label='Tháng trước' onclick='calMoveMonth(-1)'>‹</button><h3>${esc(monthName)}</h3><button type='button' class='btn light cal-nav' aria-label='Tháng sau' onclick='calMoveMonth(1)'>›</button></div><div class='cal-weekdays'>${['T2','T3','T4','T5','T6','T7','CN'].map(x=>`<span>${x}</span>`).join('')}</div><div class='cal-grid'>${cells.join('')}</div><div class='cal-legend'><span><i class='due'></i> Hạn nộp</span><span><i class='exam'></i> Kiểm tra</span>${isTeacher?`<span><i class='grading'></i> Chờ chấm</span>`:''}</div></section>
    <section class='panel cal-agenda'><div class='cal-agenda-head'><div><span class='cal-eyebrow'>${calDateLabel(calendarSelected)}</span><h3>Hoạt động trong ngày</h3></div><span class='pill plain'>${selectedEvents.length} hoạt động</span></div>${selectedEvents.length?`<div class='cal-event-list'>${selectedEvents.map(renderEvent).join('')}</div>`:`<div class='cal-empty'>Ngày này chưa có hạn nộp hoặc lịch kiểm tra.</div>`}</section></div>
    <section class='panel cal-upcoming'><div class='cal-agenda-head'><div><span class='cal-eyebrow'>ƯU TIÊN SẮP TỚI</span><h3>Việc sắp đến hạn</h3></div><span class='pill plain'>${upcoming.length} mục</span></div>${upcoming.length?`<div class='cal-event-list'>${upcoming.map(renderEvent).join('')}</div>`:`<div class='cal-empty'>Chưa có hạn nộp hoặc lịch kiểm tra sắp tới.</div>`}</section>
    ${isTeacher?`<section class='panel cal-upcoming'><div class='cal-agenda-head'><div><span class='cal-eyebrow'>DANH SÁCH CẦN XỬ LÝ</span><h3>Bài chờ chấm</h3></div><span class='pill ${noDate.length?'prog':'plain'}'>${noDate.length} mục</span></div>${noDate.length?`<div class='cal-event-list'>${noDate.map(renderEvent).join('')}</div>`:`<div class='cal-empty'>Hiện không có bài nộp hoặc lượt kiểm tra chờ chấm.</div>`}</section>`:''}
  </div>`;
}
