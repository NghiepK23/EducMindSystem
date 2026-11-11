/* EducMind · js/30-auth-session.js
   Quy tắc phiên đăng nhập: hết hạn khi không hoạt động, băm mật khẩu demo, mã đặt lại mật khẩu. */
/* ===== Đợt 8: thông báo (US-G03) và tài khoản (US-G01, G02, G04) ===== */
const TEACHER='co.lan@educmind.vn',SESS_IDLE=30,PW_MIN=8,RESET_MIN=15,TOKS=[],MAIL=[],SNAP=new WeakMap();
function hashPw(p){let h=5381;for(let i=0;i<p.length;i++)h=((h<<5)+h+p.charCodeAt(i))>>>0;return 'h'+h.toString(16)}
Object.keys(ACCT).forEach(k=>{if(ACCT[k].pw===undefined)ACCT[k].pw=hashPw('demo123')});
const acctName=()=>sess?((ACCT[sess.email]||{}).name||sess.email):'';
const visClasses=()=>!sess?[]:role==='S'?classes.filter(x=>x.students.some(s=>s.email===sess.email)):classes.filter(x=>x.owner===sess.email);
function authGuard(){
  if(!logged||!sess)return;
  if(sess.exp||Date.now()-sess.t>SESS_IDLE*60000){logged=false;sess=null;role='T';dlg=null;taking=false;authMode='login';authMsg='';authErr='Phiên làm việc đã hết hạn do không hoạt động. Thao tác chưa lưu không được ghi nhận. Hãy đăng nhập lại.'}
  else sess.t=Date.now();
}
/* --- US-G02: mã đặt lại mật khẩu --- */
function sendReset(email,first){
  TOKS.filter(t=>t.email===email&&!t.used).forEach(t=>{t.used=true});
  const raw='tk'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);
  TOKS.push({email,hash:hashPw(raw),exp:simNow()+(first?7*864e5:RESET_MIN*60000),used:false});
  MAIL.unshift({to:email,subject:first?'Đặt mật khẩu lần đầu cho tài khoản EducMind':'Đặt lại mật khẩu EducMind',raw});
}
const tokRec=()=>authTok?TOKS.find(t=>t.hash===hashPw(authTok)):null;
function quickList(){
  const lanAnh=classes.flatMap(c=>c.students).find(s=>s.name==='Lan Anh');
  return [{label:'Cô Lan (giáo viên)',email:TEACHER}].concat(lanAnh?[{label:'HS Lan Anh · '+lanAnh.email,email:lanAnh.email}]:[]);
}
