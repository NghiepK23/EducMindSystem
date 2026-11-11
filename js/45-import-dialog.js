/* EducMind · js/45-import-dialog.js
   Hộp thoại nhập câu hỏi / danh sách học sinh từ tệp Excel, CSV, Word; tải tệp mẫu. */
/* --- 3. Nhập câu hỏi / danh sách học sinh từ tệp Excel (.xlsx, .csv) hoặc Word (.docx có bảng) --- */
const IMPFMT={
  questions:{title:'Nhập câu hỏi từ tệp',file:'Mau_cau_hoi.xlsx',sheet:'Câu hỏi',w:[6,48,18,18,18,18,14,14,12,12],
    head:['STT','Câu hỏi','Đáp án A','Đáp án B','Đáp án C','Đáp án D','Đáp án đúng','Mục tiêu','Độ khó','Mức Bloom'],
    rows:[['1','Địa chỉ IPv4 gồm bao nhiêu bit?','8','16','32','64','C','','Dễ','Nhớ'],['2','Những thiết bị nào là thiết bị mạng?','Router','Switch','Bàn phím','Chuột','A, B','','Trung bình','Hiểu']],
    note:'Bắt buộc: Câu hỏi, các đáp án và Đáp án đúng. Nhiều chữ cái ở Đáp án đúng (ví dụ A, B) là câu nhiều lựa chọn; để trống các đáp án là câu tự luận. Cột Mục tiêu (mã cách nhau dấu phẩy, phải là mã mục tiêu có thật trong lớp đang chọn; để trống = câu tổng hợp, mã không có thì câu vẫn được nhập kèm cảnh báo), Độ khó (Dễ/Trung bình/Khó) và Mức Bloom là tùy chọn. Dòng lỗi được bỏ qua, các dòng còn lại vẫn nhập.'},
  students:{title:'Nhập danh sách học sinh từ tệp',file:'Mau_danh_sach_hoc_sinh.xlsx',sheet:'Học sinh',w:[6,28,34,26],
    head:['Họ tên','Email','Mật khẩu mặc định'],rows:[['Nguyễn Văn An','an.nv@school.edu.vn',''],['Trần Thị Bình','binh.tt@school.edu.vn','HocSinh@2026']]}
};
const nz=t=>String(t==null?'':t).toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
let IMPSTATE=null;
function impModal(html){let m=document.getElementById('impOv');if(!m){m=document.createElement('div');m.id='impOv';m.className='ov enter';document.body.appendChild(m)}m.innerHTML=`<div class='dlg' role='dialog' aria-modal='true' aria-label='Nhập từ tệp' style='max-width:680px'>${html}</div>`}
function impClose(){const m=document.getElementById('impOv');if(m)m.remove();IMPSTATE=null}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('impOv'))impClose()});
/* Mở thẳng hộp chọn tệp của máy tính; chỉ hiện bảng xem trước sau khi đã chọn tệp */
function impOpenPicker(kind){
  const S=IMPFMT[kind];
  let inp=document.getElementById('impFileDirect');
  if(!inp){
    inp=document.createElement('input');inp.type='file';inp.id='impFileDirect';inp.className='sr';inp.tabIndex=-1;
    inp.accept='.xlsx,.xls,.csv,.docx';inp.setAttribute('aria-hidden','true');
    document.body.appendChild(inp);
  }
  inp.onchange=()=>{
    const f=inp.files[0];inp.value='';
    if(!f)return;
    impModal(`<h2 style='font-size:18px'>${esc(S.title)}</h2><div id='impOut' role='status'></div>`);
    Promise.resolve(impPick(kind,f)).then(()=>{
      const out=document.getElementById('impOut');if(!out)return;
      let row=out.querySelector('.row');
      if(!row){row=document.createElement('div');row.className='row';row.style.marginTop='12px';out.appendChild(row)}
      if(!row.querySelector('.imp-close')){
        const b=document.createElement('button');b.type='button';b.className='btn light imp-close';b.textContent='Đóng';b.onclick=impClose;row.appendChild(b);
      }
    });
  };
  inp.click();
}
function importFile(kind){
  const c=selected();if(role==='T'&&!owns(c)){toast('Bị từ chối: lớp này không do bạn phụ trách.');return}
  const S=IMPFMT[kind];
  if(kind==='asg'){impOpenPicker(kind);return}   /* trình tạo bài tập: mở thẳng hộp chọn tệp của máy */
  let tableHtml = "";
  if(kind !== "students") {
    var th = "", tb = "";
    S.head.forEach(function(h){ th += "<th scope='col'>" + esc(h) + "</th>"; });
    S.rows.forEach(function(r){ tb += "<tr>" + r.map(function(x){ return "<td>" + esc(x) + "</td>"; }).join("") + "</tr>"; });
    tableHtml = "<div class='tablewrap fmt'><table><thead><tr>" + th + "</tr></thead><tbody>" + tb + "</tbody></table></div>";
  }
  var qNote = "";
  if(kind === "questions") {
    var codes = [];
    c.lessonsData.forEach(function(l){ (l.objs||[]).forEach(function(o){ var cd = String(o.code||"").toUpperCase(); if(cd && codes.indexOf(cd) < 0) codes.push(cd); }); });
    qNote = "<p class='muted' style='font-size:12.5px'>Mã mục tiêu đang có trong lớp " + esc(c.id) + ": " + codes.join(", ") + "v</p>";
  }
  impModal(`<h2 style='font-size:18px'>${S.title}</h2>${tableHtml}<p class='muted' style='font-size:12.5px'>${S.note||""}</p>${qNote}<div class='row' style='margin:12px 0'><button class='btn' onclick="document.getElementById('impFile').click()">Chọn tệp</button><button class='btn light' onclick="impTemplate('${kind}')">Tải mẫu Excel</button><button class='btn light' onclick="impTemplateWord('${kind}')">Tải mẫu Word</button><button class='btn light' onclick='impClose()'>Đóng</button></div><input id='impFile' class='sr' tabindex='-1' type='file' accept=".xlsx,.xls,.csv,.docx" onchange="impPick('${kind}',this.files[0])"><div id='impOut' role='status'></div>`);
  const f0=document.querySelector('#impOv .btn');if(f0)f0.focus();
}
async function impTemplate(kind){
  const S=IMPFMT[kind],b64=XLSXB64[kind]||XLSXB64.questions;
  if(!b64){impTemplateCsv(S);return}
  try{const kb=dlBlob(S.file,XLSXMIME,b64);toast('Đã tải tệp mẫu Excel: '+S.file+' · '+kb+' KB')}
  catch(e){toast('Trình duyệt chặn tải tệp ở khung xem thử — mở tệp HTML trực tiếp để tải mẫu.')}
}
/* Mẫu dạng CSV dùng khi chưa tải được thư viện Excel (trang xem không có mạng); Excel vẫn mở và lưu lại thành .xlsx được */
function impTemplateCsv(S){
  const q=v=>{const s=String(v==null?'':v);return /[",;\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const csv='\ufeff'+[S.head].concat(S.rows).map(r=>r.map(q).join(',')).join('\r\n');
  const name=S.file.replace(/\.xlsx$/,'.csv'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  try{
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);toast('Đã tải tệp mẫu: '+name+' (Excel mở được, có thể lưu lại thành .xlsx).');
  }catch(e){toast('Không lưu được tệp mẫu ở chế độ xem này.')}
}
