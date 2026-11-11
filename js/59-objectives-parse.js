/* EducMind · js/59-objectives-parse.js
   Nhập mục tiêu từ văn bản: tách dòng, làm sạch, đánh mã mục tiêu. */
/* ==========================================================================
   THAY ĐỔI 39 — Nhập mục tiêu bằng nhiều cách + soạn đề từ giáo án
   1) Dán văn bản theo cú pháp “Mã, Nội dung mục tiêu” (mỗi dòng một mục tiêu)
   2) Tải tệp Excel/Word có bảng “Mã mục tiêu | Nội dung mục tiêu”
   3) Tải giáo án (.docx/.txt) — hệ thống tự tìm phần Mục tiêu và trích xuất
   4) Trong trình tạo bài tập/bài kiểm tra: nguồn “Từ giáo án (AI đề xuất)”
   ========================================================================== */
let OBJIMP=null, asgPlan=null;
const OBJ_START=/^(muc tieu|yeu cau can dat)/;
const OBJ_STOP=/^(noi dung|hoat dong|tien trinh|thiet bi|tai lieu|chuan bi|kien thuc trong tam|ket luan|cung co|dan do|bai tap ve nha|rut kinh nghiem|phu luc|ghi chu|danh gia|kiem tra|hinh thuc|phuong phap|san pham|to chuc)/;
const OBJ_SUB=/^(ve |i{1,3}\.|[0-9]\.)\s*(kien thuc|nang luc|pham chat|thai do|ky nang)/;
const OBJ_LABEL=/^(muc tieu( bai hoc| day hoc| can dat)?|yeu cau can dat|noi dung( muc tieu)?|ten muc tieu( bai hoc)?)$/;
const OBJ_VERB=/^(trinh bay|neu|phan biet|giai thich|van dung|nhan biet|hieu|mo ta|liet ke|so sanh|phan tich|danh gia|thuc hien|su dung|tao|viet|xac dinh|ke ten|tom tat|tinh|chung minh|lap|thiet ke|phat bieu|de xuat|ap dung|nhan ra|chi ra|doc|quan sat)/;
function objCleanLine(s){
  let t=String(s==null?'':s).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  t=t.replace(/^[-–—•*+·,;:\s]+/,'').replace(/^\(?\d+[.)]\s*/,'').replace(/^[ivxIVX]{1,4}[.)]\s+/,'').replace(/^[a-zA-Z][.)]\s*/,'').replace(/^\([a-zA-Z0-9]+\)\s*/,'');
  return t.trim();
}
function objUsedSet(l){return new Set(((l&&l.objs)||[]).map(o=>String(o.code||'').toUpperCase()))}
function objNextCode(used){let n=1;while(used.has('LO'+String(n).padStart(2,'0')))n++;return 'LO'+String(n).padStart(2,'0')}
function objGoalIndex(c,desc){const k=nz(desc),i=c.goals.findIndex(g=>nz(g)===k);const j=i>=0?i:addGoal(c,desc);reviveGoal(c,j);return j}
/* Thêm lại mục tiêu đã xoá thì bỏ dấu “đã xoá” của mục tiêu chung để lời khuyên, bảng điểm hoạt động lại bình thường */
function reviveGoal(c,j){
  c.trash=c.trash.filter(t=>{
    if(t.type!=='Mục tiêu'||!(t.objIdx||[]).includes(j))return true;
    t.objIdx=t.objIdx.filter(x=>x!==j);
    return t.objIdx.length>0;
  });
  return j;
}
/* Đọc văn bản dán vào hoặc nội dung tệp: mỗi dòng một mục tiêu, mã có thể để trống */
function parseObjectivesText(text,l){
  const used=objUsedSet(l),items=[],warn=[],err=[],seen=new Set();
  String(text==null?'':text).replace(/\r/g,'').split('\n').forEach((raw,i)=>{
    const line=objCleanLine(raw);if(!line)return;
    const k=nz(line);
    if(OBJ_LABEL.test(k))return;
    if(/^ma muc tieu\s*(,|\||;|\t)/.test(k))return;
    let code='',desc=line;
    const m=/^([^,;|\t]{1,26})\s*[,;|\t]\s*(.+)$/.exec(line);
    if(m){
      const head=m[1].trim(),rest=m[2].trim(),hk=nz(head);
      if(OBJ_LABEL.test(hk))desc=rest;
      else if(/^[A-Za-z][A-Za-z0-9._-]{0,11}$/.test(head)&&rest.length>3){code=head.toUpperCase();desc=rest}
    }
    desc=String(desc||'').replace(/\s+/g,' ').trim();
    if(desc.length<6){err.push('Dòng '+(i+1)+': “'+line.slice(0,40)+'…” quá ngắn nên bị bỏ qua.');return}
    if(seen.has(nz(desc))){warn.push('Dòng '+(i+1)+': trùng nội dung với mục tiêu phía trên nên bị bỏ qua.');return}
    if(code&&used.has(code)){const nc=objNextCode(used);warn.push('Dòng '+(i+1)+': mã '+code+' đã có trong bài học, đổi thành '+nc+'.');code=nc}
    if(!code)code=objNextCode(used);
    if(used.has(code)){err.push('Dòng '+(i+1)+': mã '+code+' bị trùng nên bị bỏ qua.');return}
    used.add(code);seen.add(nz(desc));items.push({code,desc});
  });
  return {items,warn,err};
}
