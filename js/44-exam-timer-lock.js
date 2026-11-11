/* EducMind · js/44-exam-timer-lock.js
   Làm bài kiểm tra: đếm ngược, tự nộp khi hết giờ và khóa màn hình cho đến khi nộp. */
/* --- AC-S03.3: đếm ngược và tự nộp khi hết hạn lượt --- */
const fmtT=ms=>{const t=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
function cdHtml(a){return `<div class='cdbar' id='cdbar' role='timer' aria-label='Thời gian còn lại của lượt làm'><span>Thời gian còn lại</span><b id='cd'>${fmtT(a.cur.end-simNow())}</b></div><span id='cdLive' class='sr' role='status'></span>`}
function tick(){
  if(!logged||role!=='S'||!sess)return;
  const c=selected(),s=c&&me();if(!s||!s.att||!s.att.cur)return;
  const rem=s.att.cur.end-simNow();
  if(rem<=0){
    const att=submitAttempt(c,s);taking=false;
    const msg='Hết giờ: hệ thống đã tự nộp các câu đã lưu'+(att.status==='GRADED'?'. Điểm lượt này: '+att.total.toFixed(1)+'/'+qMax(c)+'.':'; còn câu chờ giáo viên chấm.');
    if(!dlg)render();toast(msg);return;
  }
  const el=document.getElementById('cd');
  if(el){el.textContent=fmtT(rem);const b=document.getElementById('cdbar');if(b)b.classList.toggle('warn',rem<=60000);
    const lv=document.getElementById('cdLive'),k=rem<=10000?3:rem<=60000?2:rem<=300000?1:0;
    if(lv&&k!==cdWarn){cdWarn=k;lv.textContent=['','Còn 5 phút','Còn 1 phút','Còn 10 giây'][k]}}
}
setInterval(tick,1000);
function clockTool(){
  const s=me(),cur=s&&s.att&&s.att.cur;
  return `<details style='margin-top:14px'><summary class='muted'>Công cụ thử nghiệm (chỉ có trong prototype)</summary><div class='row' style='margin-top:8px'><button class='btn light' onclick='skewClock(300000)'>Tua đồng hồ +5 phút</button>${cur?`<button class='btn light' onclick='skewToEnd()'>Tua tới còn 10 giây</button>`:''}</div><p class='muted' style='font-size:12px;margin:6px 0 0'>Để thử tự nộp khi hết hạn lượt mà không phải chờ. Đồng hồ mô phỏng cũng ảnh hưởng hạn nộp bài tập.</p></details>`;
}
function skewClock(ms){skew+=ms;render();toast('Đã tua đồng hồ mô phỏng +'+Math.round(ms/60000)+' phút.')}
function skewToEnd(){const s=me();if(!s.att.cur)return;skew+=Math.max(0,s.att.cur.end-10000-simNow());cdWarn=0;render();toast('Đã tua tới còn khoảng 10 giây.')}

/* --- 2. Làm bài kiểm tra: khóa màn hình, không thoát được cho đến khi nộp hoặc hết giờ --- */
const examLock=()=>{try{if(!logged||role!=='S'||!sess||!taking)return false;const s=me();return !!(s&&s.att&&s.att.cur)}catch(e){return false}};
const _shell0=shell;
window.shell=function(content){
  if(!examLock())return _shell0(content);
  const n=me().att.cur.leaves||0;
  content=content.replace(/<button class='btn light' onclick='taking=false;render\(\)'>Tạm dừng<\/button>/g,'').replace('nếu thoát, em quay lại làm tiếp mà không tốn thêm lượt','em không thể thoát khỏi màn hình này cho đến khi nộp bài hoặc hết giờ');
  app.innerHTML=`<header class='top'>${brandLogoHtml()}<span class='spacer'></span><span class='pill ${n?'need':'plain'}' id='leaveChip' role='status'>Rời màn hình: ${n} lần</span><div class='user'>${avatarHtml()}<span>${esc(acctName())}</span></div></header><div class='layout' style='grid-template-columns:minmax(0,1fr);max-width:900px'><main class='main' id='main'><div class='head'><div><h1 id='pageTitle' tabindex='-1'>Đang làm bài kiểm tra</h1><p class='sub'>Chế độ làm bài: không chuyển trang, không đăng xuất được cho đến khi nộp bài hoặc hết giờ.</p></div></div>${content}${dlgHtml()}</main></div>`;
};
const _start0=window.startQuiz;
window.startQuiz=function(){
  const c=selected(),s=me(),q=c.quiz,rs=!!(s.att&&s.att.cur);
  openDlg({title:rs?'Tiếp tục làm bài?':'Bắt đầu làm bài?',text:'Bài “'+esc(q.name)+'” giới hạn '+q.dur+' phút'+(rs?'; đồng hồ vẫn tính từ lúc bắt đầu lượt.':'; đồng hồ đếm ngược chạy ngay khi bắt đầu.')+' Khi làm bài em không thể chuyển trang, đăng xuất hay thoát ra; mỗi lần rời khỏi màn hình đều được ghi lại. Hết giờ hệ thống tự nộp các câu đã lưu.',okLabel:rs?'Tiếp tục':'Bắt đầu',ok:()=>{dlg=null;_start0();try{history.pushState(null,'')}catch(e){}return null}});
};
const _fin0=window.finishQuiz;
window.finishQuiz=function(){
  openDlg({title:'Nộp bài?',text:'Sau khi nộp em không sửa được lượt này.',okLabel:'Nộp bài',ok:()=>{dlg=null;if(!examLock()){render();return null}_fin0();return null}});
};
let leftFlag=false;
function examLeave(){
  if(!examLock()||leftFlag)return;leftFlag=true;
  const a=me().att.cur;a.leaves=(a.leaves||0)+1;
  const el=document.getElementById('leaveChip');if(el){el.textContent='Rời màn hình: '+a.leaves+' lần';el.className='pill need'}
}
function examBack(){
  if(!leftFlag)return;leftFlag=false;
  if(examLock())toast('Em vừa rời khỏi màn hình làm bài (lần '+(me().att.cur.leaves||1)+'). Hành vi này được ghi lại.');
}
document.addEventListener('visibilitychange',()=>document.hidden?examLeave():examBack());
window.addEventListener('blur',examLeave);
window.addEventListener('focus',examBack);
window.addEventListener('beforeunload',e=>{if(examLock()){e.preventDefault();e.returnValue=''}});
window.addEventListener('popstate',()=>{if(examLock()){try{history.pushState(null,'')}catch(e){}toast('Không thể quay lại khi đang làm bài.')}});
['copy','cut','paste','contextmenu'].forEach(t=>document.addEventListener(t,e=>{if(examLock()){e.preventDefault();toast('Đang làm bài: không dùng sao chép, dán hoặc chuột phải.')}}));
setInterval(()=>{
  if(examLock()&&sess)sess.t=Date.now();                                  /* phiên không hết hạn khi đang làm bài */
  else if(document.getElementById('leaveChip')){dlg=null;render()}        /* hết giờ/đã nộp: mở khóa giao diện */
},1000);
