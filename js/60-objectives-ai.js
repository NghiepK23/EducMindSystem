/* EducMind · js/60-objectives-ai.js
   Trích xuất mục tiêu từ giáo án: bộ phân tích trong trang và gọi Gemini (khi có khóa API). */
/* Tìm phần mục tiêu trong một giáo án: quét tiêu đề rồi lấy các dòng bên dưới */
/* ==========================================================================
   Bộ máy trích xuất mục tiêu từ giáo án (AI hỗ trợ, chạy ngay trong trang)
   Thay cho cách “quét tiêu đề rồi lấy mọi dòng bên dưới”: phân tích nhiều
   tầng — nhận dạng tiêu đề mục tiêu, chấm điểm từng vùng, tách câu, gộp dòng
   bị ngắt, loại dòng nhiễu (hoạt động, thiết bị, sản phẩm…).
   ========================================================================== */
/* ===== Cấu hình AI: Gemini là nhà cung cấp chính của dự án =====
   - Khóa API lấy tại https://aistudio.google.com/apikey
   - Cách đặt khóa (ưu tiên từ trên xuống): nhập trong “Tài khoản của bạn” →
     tham số ?geminiKey=… trên đường dẫn → hằng số key bên dưới.
   - Không có khóa → dùng bộ máy phân tích trong trang (chạy offline, không cần mạng). */
const OBJAI={
  provider:'gemini',
  model:'gemini-2.5-flash',          /* đổi sang gemini-2.5-pro nếu cần chất lượng cao hơn */
  key:'',                             /* dán khóa API ở đây nếu muốn cố định trong tệp */
  endpoint:'https://generativelanguage.googleapis.com/v1beta/models/',
  timeout:25000,
  used:''                             /* 'gemini' hoặc 'local' — nguồn của kết quả gần nhất */
};
function objAIKey(){
  try{const a=(typeof acctRec==='function')?acctRec():null;if(a&&a.aiKey)return String(a.aiKey).trim()}catch(e){}
  try{const q=new URLSearchParams(location.search).get('geminiKey');if(q)return String(q).trim()}catch(e){}
  return String(OBJAI.key||'').trim();
}
/* Động từ nhận thức — “mạnh”: gần như chỉ xuất hiện trong mục tiêu */
const OBJAI_STRONG='nhan biet|nhan dien|nhan ra|ke ten|liet ke|neu|phat bieu|trinh bay|mo ta|phan tich|phan loai|phan biet|so sanh|giai thich|tong hop|danh gia|chung minh|van dung|ap dung|thuc hien|thuc hanh|su dung|khai thac|thiet ke|xay dung|viet|lap trinh|tinh toan|quan sat|thu thap|xu li|chia se|hop tac|tu hoc|tu chu|giao tiep|giai quyet|sang tao|trung thuc|cham chi|nhan ai|yeu nuoc|bao ve|giu gin|ton trong|co y thuc|hinh thanh|phat trien|ren luyen|cam nhan|bay to|ung dung|tom tat|khai quat|lien he|de xuat|lua chon|thuyet trinh|tranh luan|nhan xet|mo phong|trinh dien|dat duoc|lam duoc|bieu dien|tinh|giai|doc|ve|dem|tao';
/* Động từ “yếu”: phải đi kèm “được” mới tính */
const OBJAI_WEAK='biet|hieu|tra loi';
const OBJAI_VS=new RegExp('(^|[^a-z])('+OBJAI_STRONG+')([^a-z]|$)');
const OBJAI_VWk=new RegExp('(^|[^a-z])('+OBJAI_WEAK+')([^a-z]|$)');
const OBJAI_VD=new RegExp('(^|[^a-z])('+OBJAI_WEAK+')(\\s+(duoc|dược))');

/* Tiền tố số hiệu cho tiêu đề: “I.”, “2.”, “PHẦN III.”, “CHƯƠNG 2.”, “MỤC 1.” */
const OBJAI_NUM='(?:(?:phan|chuong|muc|bai|tiet)\\s+)?(?:(?:[ivxlc]{1,5}|[0-9]{1,2})\\s*[.):-])\\s*';
/* Tiêu đề “phần mục tiêu” */
const OBJAI_HEAD=new RegExp('^(?:'+(OBJAI_NUM)+')?\\s*'+
  '(muc tieu(?: (?:bai hoc|day hoc|chung|can dat|mon hoc|tiet hoc))?|muc dich(?: yeu cau)?(?: bai hoc)?|'+
  'yeu cau can dat|yeu cau ve (?:kien thuc|nang luc|pham chat)|yeu cau bai hoc|'+
  'kien thuc(?:,)? (?:ki nang|ky nang)(?:,)?(?: thai do)?|nang luc(?:,)? pham chat|chuan kien thuc|'+
  'muc tieu va yeu cau|nang luc(?: (?:chung|dac thu|so|cot loi|tu chu|giao tiep|hop tac|giai quyet van de|sang tao))?|'+
  'pham chat(?: chu yeu)?|kien thuc|ki nang|ky nang|thai do)\\s*(?:[:.]|$)');
/* Dòng mở đầu vùng mục tiêu nhưng không phải tiêu đề */
const OBJAI_OPEN=new RegExp('^(sau (?:khi )?(?:bai|tiet) hoc|sau bai hoc nay|hoc xong bai nay|sau bai hoc,? hoc sinh|ket thuc bai hoc)');
/* Tiêu đề phần KHÔNG phải mục tiêu → dừng vùng */
const OBJAI_STOP=new RegExp('^(?:'+(OBJAI_NUM)+')?\\s*'+
  '(noi dung|tien trinh|hoat dong|thiet bi|do dung|hoc lieu|tai lieu|phuong phap|hinh thuc|chuan bi|san pham|'+
  'to chuc thuc hien|kiem tra|danh gia|cung co|dan do|bai tap ve nha|rut kinh nghiem|phu luc|ghi chu|'+
  'ho so day hoc|thong tin chung|boi canh|on dinh|khoi dong|muc tieu cua hoat dong|'+
  'yeu cau can dat cua hoat dong|ke hoach bai day|muc luc|loi noi dau|dinh huong|du kien|'+
  'thoi gian|phieu hoc tap|may tinh|may chieu|video|tranh anh|dap an|loi giai|tuan|tiet|ngay|buoi|'+
  'hinh thanh kien thuc|luyen tap|van dung|mo dau|tong ket|on tap|cau tra loi|ket qua|thuc hanh luon)\\b');
/* Tiêu đề phần LỚN (chắc chắn kết thúc vùng mục tiêu) */
const OBJAI_HARD=new RegExp('^(?:'+(OBJAI_NUM)+')?\\s*'+
  '(noi dung|tien trinh|hoat dong|thiet bi|do dung|hoc lieu|tai lieu|phuong phap|hinh thuc|chuan bi|san pham|'+
  'to chuc thuc hien|kiem tra|danh gia|cung co|dan do|bai tap ve nha|rut kinh nghiem|phu luc|ghi chu|'+
  'ho so day hoc|thong tin chung|boi canh|muc luc|loi noi dau|dinh huong|du kien|ke hoach bai day)\\b');
/* Nhãn phụ nằm trong vùng mục tiêu (bỏ qua nhưng biết là nhãn) */
const OBJAI_SUB=new RegExp('^(?:(?:[a-z]|[ivx]{1,4}|[0-9]{1,2})\\s*[.)]\\s*)?'+
  '(ve )?(kien thuc|ki nang|ky nang|thai do|nang luc(?: (?:chung|dac thu|so|tu chu|giao tiep|hop tac|giai quyet|sang tao|tin hoc|may tinh))?|'+
  'pham chat(?: (?:chu yeu|chu yeu|trach nhiem|trung thuc|cham chi|nhan ai|yeu nuoc))?|'+
  'nang luc dac thu|nang luc chung|yeu cau)\\s*[:.]?$');
/* Dòng chắc chắn là nhiễu */
const OBJAI_NOISE=new RegExp('^(gv|hs|giao vien|hoc sinh|thoi gian|san pham|to chuc|noi dung|hoat dong|'+
  'phieu hoc tap|may tinh|may chieu|tranh anh|video|hoc lieu|dap an|loi giai|ban ghi|'+
  'tuan \\d+|tiet \\d+|ngay \\d+|buoi \\d+)');

/* Dòng có mở đầu bằng động từ nhận thức → là mục tiêu, không phải tiêu đề phần */
function objAIStartsVerb(raw){
  const k=nz(objAIClean(raw)).replace(/^[^a-z0-9]+/,'');
  return objAIIsVerb(k.split(' ').slice(0,3).join(' '));
}
/* Cấp của một tiêu đề: 1 = PHẦN/CHƯƠNG/I., 2 = 1., 3 = 2.1., 4 = a) */
function objAILevel(raw){
  const t=nz(String(raw==null?'':raw)).trim();
  if(!t)return 0;
  if(/^(phan|chuong|chu de)\s+([ivxlc]+|\d+)\s*[.:)]/.test(t))return 1;
  if(/^[ivxlc]{1,5}\s*[.)]/.test(t))return 1;
  if(/^\d{1,2}\.\d{1,2}\s*[.)]?/.test(t))return 3;
  if(/^\d{1,2}\s*[.)]/.test(t))return 2;
  if(/^[a-zđ]\s*[.)]/.test(t))return 4;
  return 0;
}
/* Một dòng là tiêu đề phần mục tiêu? (loại trừ nhãn phụ “1. Kiến thức:”, “Về năng lực:”…) */
function objAIIsHeadLine(raw){
  const k=nz(String(raw==null?'':raw)).replace(/^[^a-z0-9]+/,'');
  if(!k||k.length>=120)return false;
  if(OBJAI_SUB.test(k)&&k.length<70)return false;
  if(objAIStartsVerb(raw)&&!/^muc tieu|^yeu cau can dat|^muc dich/.test(k))return false;
  return OBJAI_HEAD.test(k);
}
/* Câu mô tả hoạt động dạy học (không phải mục tiêu) */
const OBJAI_ACT=/(tra loi cau hoi|thao luan (?:nhom|cap|theo)|quan sat (?:tranh|video|hinh)|nhan xet|ket luan|ghi (?:bai|chep)|lam bai tap|chua bai|bao cao ket qua|trinh bay truoc lop|cho y kien|tra loi phieu|hoan thanh phieu)/;
function objAIIsVerb(k){return OBJAI_VS.test(k)||OBJAI_VD.test(k)}
function objAIClean(s){
  let t=String(s==null?'':s).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  t=t.replace(/^[-–—•*+·▪●○]+/,'').replace(/^\(?[0-9]+[.)]\s*/,'').replace(/^\(?[a-zA-Z]\)\s*/,'')
     .replace(/^[ivxlcIVXLC]{1,4}[.)]\s+/,'').replace(/^[a-zA-Z][.)]\s*/,'');
  t=t.replace(/^(?:hoc sinh|hs|sinh vien|sau bai hoc,?\s*hoc sinh|sau khi hoc xong,?\s*hoc sinh)\s*[:,-]?\s*/i,'');
  return t.replace(/\s+/g,' ').trim();
}
function objAIBullet(raw){
  return /^\s*(?:[-–—•*+·▪●○]|\(?\d{1,2}[.)]|\(?[a-zđ][.)]|\(?[ivxlc]{1,4}[.)])\s+/i.test(String(raw||''));
}
/* Tách một dòng dài thành nhiều mục tiêu (dùng khi nhiều mục bị dồn 1 dòng) */
function objAISplit(line){
  const parts=[];let buf='';
  const chunks=String(line).replace(/\s*;\s*/g,'; ').split(/(?<=[;.])\s+/);
  if(chunks.length<2)return [line];
  chunks.forEach(ch=>{
    const k=nz(objAIClean(ch));
    const marker=/^\s*(\(?\d{1,2}[.)]|[-–—•·*+]|[a-zđ]\s*[.)])\s+/i.test(ch);
    const subject=/^(hoc sinh|hs|sinh vien|sau bai hoc)\b/.test(k);
    const startsNew=marker||subject;
    if(buf&&startsNew){parts.push(buf.trim());buf=ch}
    else buf=buf?buf+' '+ch:ch;
  });
  if(buf)parts.push(buf.trim());
  return parts.filter(p=>nz(p).length>=6);
}
/* Lấy các mục tiêu trong một vùng dòng */
function objAITake(block){
  const out=[];let cur='';
  const push=()=>{const t=String(cur).replace(/\s+/g,' ').replace(/[;.,]+$/,'').trim();if(t&&nz(t).length>=6)out.push(t);cur=''};
  block.forEach(raw=>{
    const bullet=objAIBullet(raw),line=objAIClean(raw),k=nz(line);
    if(!k)return;
    if(OBJAI_SUB.test(k)&&k.length<70){push();return}
    /* dòng mở đầu kiểu hoạt động / thiết bị / thời gian: bỏ, ngắt mục đang ghép */
    const subjNoise=OBJAI_NOISE.test(k)&&!(/^(hoc sinh|hs|giao vien|gv)\b/.test(k)&&OBJAI_VS.test(k.slice(0,60))&&!OBJAI_ACT.test(k));
    if(subjNoise){push();return}
    if(k.replace(/[^a-z0-9]/g,'').length<6){push();return}
    const verb=objAIIsVerb(k);
    /* mục tiêu mở bằng dấu “:” thì các gạch đầu dòng bên dưới là ý của chính nó */
    if(cur&&bullet&&/[:;]\s*$/.test(cur)){cur+=' '+line;return}
    const curOpen=!!cur&&!/[.;!?]$/.test(cur);
    const lower=/^[a-zà-ỹđ]/.test(String(raw).trim());
    if(cur&&!bullet&&curOpen&&nz(cur).length<260&&(lower||!verb)){cur+=' '+line;return}   /* dòng bị ngắt giữa câu */
    if(cur&&(bullet||verb))push();
    if(!cur&&!bullet&&!verb)return;                                             /* dòng không phải mục tiêu */
    if(bullet||verb){push();cur=line}                                           /* dòng nối tiếp nhưng câu đã đóng → bỏ */
  });
  push();
  const flat=[];
  out.forEach(t=>{objAISplit(t).forEach(x=>flat.push(x))});
  const seen=new Set(),res=[];
  flat.map(t=>t.replace(/\s+/g,' ').replace(/^[,;.\-–—\s]+|[,;.\s]+$/g,'').trim())
      .filter(t=>nz(t).length>=8)
      .forEach(t=>{
        let c=objAIClean(t);
        if(!c)return;
        /* bỏ mã mục tiêu ở đầu câu: “MT1:”, “LO01.”, “Mục tiêu 2:” … */
        c=c.replace(/^(?:mt|lo|mt|m|o)\s*\d{1,3}\s*[.:)-]\s*/i,'').replace(/^muc tieu\s*\d{1,3}\s*[.:)-]\s*/i,'').trim();
        if(!c)return;
        /* bỏ chủ ngữ “Học sinh” ở đầu câu cho gọn */
        const kc=nz(c);
        const sub=/^(hoc sinh|hs|sinh vien|sau bai hoc,? hoc sinh|sau khi hoc xong,? hoc sinh)\s*[,:-]?\s*/.exec(kc);
        if(sub&&nz(c.slice(sub[0].length)).length>=8)c=c.slice(sub[0].length);
        c=c.replace(/\s+/g,' ').trim();
        if(!c)return;
        c=c[0].toUpperCase()+c.slice(1);
        const key=nz(c);
        if(seen.has(key))return;
        seen.add(key);res.push(c);
      });
  return res;
}
function objAIScore(items){
  let s=0;
  items.forEach(t=>{
    const k=nz(t);
    if(objAIIsVerb(k))s+=2;
    if(k.length>=15&&k.length<=200)s+=1;
    if(/^(nang luc|pham chat|kien thuc|thai do|hoat dong)/.test(k))s-=2;
  });
  return s;
}
/* ====== Bộ máy chính: trả về {found, lines, note} ====== */
function objAIExtract(text){
  const raw=String(text==null?'':text).replace(/\r/g,'').split('\n')
    .map(s=>String(s).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  if(!raw.length)return {found:false,lines:[],note:'empty'};
  const lines=raw.map(s=>({raw:s,k:nz(objAIClean(s)),head:objAIIsHeadLine(s),stop:OBJAI_STOP.test(nz(s).replace(/^[^a-z0-9]+/,''))}));
  /* 1. Thử từng “vùng mục tiêu”: bắt đầu ở tiêu đề/dòng mở, dừng ở phần kế tiếp */
  const cands=[];
  lines.forEach((L,i)=>{
    const isHead=objAIIsHeadLine(L.raw);
    const isOpen=OBJAI_OPEN.test(nz(objAIClean(L.raw)));
    if(!isHead&&!isOpen)return;
    const block=[];let gap=0;
    const startLevel=objAILevel(L.raw)||1;
    for(let j=i+1;j<lines.length;j++){
      const N=lines[j],nk=nz(N.raw).replace(/^[^a-z0-9]+/,'');
      if(objAIIsHeadLine(N.raw))break;
      /* Hết mục cùng cấp hoặc cấp trên (II., 2., PHẦN…) là hết phần mục tiêu */
      const lv=objAILevel(N.raw);
      const isSub=OBJAI_SUB.test(nk)&&nk.length<70;
      if(lv&&lv<=startLevel&&!isSub&&!objAIStartsVerb(N.raw))break;
      /* “Đánh giá được …”, “Vận dụng được …” là mục tiêu chứ không phải tiêu đề phần */
      const objShape=objAIStartsVerb(N.raw)&&/(^|\s)duoc(\s|$)/.test(nk);
      const isStop=OBJAI_STOP.test(nk)&&!objShape&&(nk.length<70||!objAIIsVerb(objAIClean(N.raw)));
      if(isStop){
        /* Dòng chặn mềm (Sản phẩm, Khởi động, Phiếu học tập…) thường xen giữa
           các dòng của bảng giáo án: bỏ qua vài dòng rồi đọc tiếp.
           Tiêu đề phần lớn (Nội dung, Tiến trình, Thiết bị…) thì dừng hẳn. */
        if(OBJAI_HARD.test(nk)&&objAITake(block).length)break;
        if(++gap>3)break;
        continue;
      }
      if(objAIBullet(N.raw)||objAIIsVerb(nz(objAIClean(N.raw))))gap=0;else if(++gap>4)break;
      block.push(N.raw);
      if(block.length>60)break;
    }
    const items=objAITake(block);
    if(!items.length)return;
    /* ưu tiên vùng nằm sớm trong văn bản, vùng có tiêu đề rõ ràng */
    const pos=i/Math.max(1,lines.length);
    const score=objAIScore(items)+(isHead?4:1)+Math.max(0,3-pos*4);
    cands.push({start:i,items,head:isHead,open:isOpen,score});
  });
  cands.sort((a,b)=>b.score-a.score);
  if(cands.length&&cands[0].items.length){
    const best=cands[0];
    return {found:!!(best.head||best.open),lines:best.items.slice(0,40),note:'section'};
  }
  /* 2. Không thấy tiêu đề: quét toàn văn, ưu tiên dòng có dấu đầu dòng + động từ */
  const bullets=raw.filter(s=>objAIBullet(s)&&objAIIsVerb(nz(objAIClean(s))));
  const pool=bullets.length?bullets:raw.filter(s=>objAIIsVerb(nz(objAIClean(s))));
  const items=objAITake(pool);
  return {found:false,lines:items.slice(0,40),note:'scan'};
}
/* Đường dùng chung với giao diện hiện tại */
function planObjectiveLines(text){
  const R=objAIExtract(text);
  return {found:R.found,lines:R.lines,note:R.note};
}
/* ====== Tuỳ chọn: nhờ mô hình ngôn ngữ khi đã cấu hình endpoint ====== */
/* ====== Gọi Gemini (nhà cung cấp chính) ====== */
const OBJAI_SYS='Bạn là trợ lý soạn bài cho giáo viên phổ thông Việt Nam. Nhiệm vụ: đọc giáo án và chỉ trích ra MỤC TIÊU BÀI HỌC (yêu cầu cần đạt của cả bài). Trả lời bằng JSON đúng schema, không thêm lời bình.';
const OBJAI_ASK=[
  'Trích xuất MỤC TIÊU BÀI HỌC (yêu cầu cần đạt của cả bài) từ giáo án dưới đây.',
  'Quy tắc bắt buộc:',
  '1. Chỉ lấy phần mục tiêu lớn của bài, thường nằm ở đầu giáo án: MỤC TIÊU / MỤC ĐÍCH YÊU CẦU / YÊU CẦU CẦN ĐẠT.',
  '2. KHÔNG lấy mục tiêu của từng hoạt động, nhiệm vụ, câu hỏi, sản phẩm học tập, thiết bị, nội dung hay tiến trình dạy học.',
  '3. Giữ nguyên câu chữ tiếng Việt, không thêm số thứ tự, không giải thích, không rút gọn làm mất ý.',
  '4. Nếu một mục tiêu có các ý sau dấu hai chấm thì giữ nguyên toàn bộ các ý đó trong CÙNG một mục tiêu.',
  '5. Nếu giáo án chia Về kiến thức / Về năng lực / Về phẩm chất thì lấy mục tiêu của cả ba nhóm.',
  '6. Tối đa 12 mục tiêu, mỗi mục tiêu là một chuỗi. Không có mục tiêu nào thì trả về {"objectives": []}.',
  '',
  'Định dạng trả về: {"objectives": ["...", "..."]}',
  '',
  'NỘI DUNG GIÁO ÁN:',
  '---'
].join('\n');
function objAIParseModelJSON(raw){
  const t=String(raw||'').replace(/```[a-z]*/gi,'');
  const o=/\[[\s\S]*\]/.exec(t), b=/\{[\s\S]*\}/.exec(t);
  let arr=null;
  try{ if(b){const j=JSON.parse(b[0]);if(j&&Array.isArray(j.objectives))arr=j.objectives} }catch(e){}
  if(!arr)try{ if(o)arr=JSON.parse(o[0]) }catch(e){}
  if(!Array.isArray(arr))return null;
  const out=[];
  arr.forEach(x=>{
    const t=typeof x==='string'?x:String((x&&(x.noi_dung||x.text||x.desc||x.name))||'');
    const c=t.replace(/\s+/g,' ').replace(/^[-–—•·*\d.)\s]+/,'').trim();
    if(nz(c).length>=8&&!out.some(y=>nz(y)===nz(c)))out.push(c);
  });
  return out.length?out.slice(0,20):null;
}
async function objAIGemini(text){
  const key=objAIKey();
  if(!key||typeof fetch!=='function')return null;
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=ctl?setTimeout(()=>{try{ctl.abort()}catch(e){}},OBJAI.timeout||25000):null;
  try{
    const body={
      systemInstruction:{parts:[{text:OBJAI_SYS}]},
      contents:[{role:'user',parts:[{text:OBJAI_ASK+'\n'+String(text).slice(0,14000)}]}],
      generationConfig:{
        temperature:0.1,
        responseMimeType:'application/json',
        responseSchema:{type:'OBJECT',properties:{objectives:{type:'ARRAY',items:{type:'STRING'}}},required:['objectives']}
      }
    };
    const res=await fetch(OBJAI.endpoint+encodeURIComponent(OBJAI.model)+':generateContent',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify(body),
      signal:ctl?ctl.signal:undefined
    });
    if(!res.ok)return null;
    const j=await res.json();
    const parts=((j&&j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts)||[]);
    const raw=parts.map(p=>p&&p.text?p.text:'').join('');
    return objAIParseModelJSON(raw);
  }catch(e){return null}
  finally{if(timer)clearTimeout(timer)}
}
/* Điều phối: Gemini trước, lỗi/không có khóa thì dùng bộ máy trong trang */
async function planObjectiveLinesSmart(text){
  const viaAI=await objAIGemini(text);
  if(viaAI&&viaAI.length){OBJAI.used='gemini';return {found:true,lines:viaAI,note:'gemini'}}
  OBJAI.used='local';
  return objAIExtract(text);
}

/* Bộ đọc văn bản thuần cho .docx/.txt/.xlsx (dùng lại bộ giải nén Office của trang) */
function docxLines(z){
  const b=z.get('word/document.xml');
  if(!b)throw new Error('Tệp Word không có phần nội dung đọc được.');
  const out=[];
  String(new TextDecoder().decode(b)).replace(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g,(m,body)=>{const t=xjoin(body);if(t)out.push(t);return m});
  return out;
}
/* Đọc .docx theo thứ tự thật: đoạn văn và từng ô của bảng (mỗi ô một dòng).
   Giáo án thường nằm trong bảng nhiều cột; gộp ô theo hàng sẽ làm mất cấu trúc mục tiêu. */
function docxFlowLines(z){
  const b=z.get('word/document.xml');
  if(!b)return [];
  const x=new TextDecoder().decode(b),out=[];
  const re=/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let m;
  while((m=re.exec(x))){
    const chunk=m[0];
    if(chunk.indexOf('<w:tbl')===0){
      chunk.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g,(mr,tr)=>{
        tr.replace(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g,(mc,tc)=>{
          const inner=[];
          tc.replace(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g,(mp,pb)=>{const t=xjoin(pb);if(t)inner.push(t);return mp});
          if(!inner.length){const t=xjoin(tc);if(t)inner.push(t)}
          inner.forEach(l=>out.push(l));
          return mc;
        });
        out.push('');
        return mr;
      });
    }else{
      const t=xjoin(chunk);
      if(t)out.push(t);
    }
  }
  return out;
}
/* Văn bản để trích xuất mục tiêu từ tệp giáo án */
async function objPlanFileText(f){
  const ext=(String(f.name).split('.').pop()||'').toLowerCase();
  if(ext==='docx'){
    const z=await unzipBuf(await f.arrayBuffer());
    const fl=docxFlowLines(z);
    return fl.join('\n')||docxTableLines(z)||docxLines(z).join('\n');
  }
  if(ext==='xlsx'||ext==='xls'||ext==='csv'){
    const rows=await readRows(f);
    return rows.map(r=>(r||[]).map(x=>String(x==null?'':x).trim()).filter(Boolean).join(' | ')).filter(Boolean).join('\n');
  }
  if(ext==='txt'||ext==='md')return new TextDecoder('utf-8').decode(await f.arrayBuffer());
  throw new Error('Chỉ đọc được .docx, .txt, .csv hoặc .xlsx.');
}
function docxTableLines(z){
  let rows=[];
  try{rows=docxRows(z)||[]}catch(e){rows=[]}
  if(!rows.length)return '';
  return rows.map(r=>(r||[]).map(x=>String(x==null?'':x).trim()).filter(Boolean).join(', ')).filter(Boolean).join('\n');
}
async function objLinesFromFile(f){
  const ext=(String(f.name).split('.').pop()||'').toLowerCase();
  if(ext==='docx'){
    const z=await unzipBuf(await f.arrayBuffer()),t=docxTableLines(z);
    return t||docxLines(z).join('\n');
  }
  if(ext==='xlsx'||ext==='xls'||ext==='csv'){
    const rows=await readRows(f);
    return rows.map(r=>(r||[]).map(x=>String(x==null?'':x).trim()).filter(Boolean).join(', ')).filter(Boolean).join('\n');
  }
  if(ext==='txt'||ext==='md'){
    return new TextDecoder('utf-8').decode(await f.arrayBuffer());
  }
  throw new Error('Chỉ đọc được .docx, .txt, .csv hoặc .xlsx.');
}
