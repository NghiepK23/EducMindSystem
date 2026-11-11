/* EducMind · js/54-permissions.js
   Phân quyền giữa các giáo viên: bảng kiểm tra và lớp rào quyền cho mọi thao tác ghi.
   Lưu ý: Phải nạp SAU mọi tệp khai báo các hàm có tên trong danh sách rào quyền ở cuối tệp (hàm chưa khai báo sẽ bị bỏ qua, không được rào). */
/* --- AC-T01.1, T02A.5, T07.4: nhiều giáo viên, mỗi lớp một người phụ trách --- */
const PERMLOG=[];
const PERM_OPS=[['Xem kết quả học tập của lớp','AC-T07.4'],['Tạo lớp','AC-T01.1'],['Tạo chủ đề trong lớp','AC-T02A.5'],['Sửa chủ đề của lớp','AC-T02A.5'],['Xóa chủ đề của lớp','AC-T02A.5']];
/* Chọn lớp và thao tác ngay trên trang (không dùng hộp thoại); kết quả hiện bằng khung ngay dưới nút và được cuộn tới */
const PERMSEL={c:null,o:0};
let PERMRES=null;
function permPanel(){
  if(role!=='T'||!sess)return '';
  const n=[...new Set(classes.map(x=>x.owner))].length;
  if(!PERMSEL.c||!classes.some(x=>x.id===PERMSEL.c)){const ot=classes.find(x=>x.owner!==sess.email);PERMSEL.c=(ot||classes[0]).id}
  const r=PERMRES;
  const res=r?`<div id='permRes' tabindex='-1' class='notice' role='status' style='background:${r.ok?'var(--good-soft)':'var(--err-bg)'};color:${r.ok?'var(--good)':'var(--err-ink)'}'>${ic(r.ok?'check':'alert',16)}<div><b>${r.ok?'Được phép':'Bị từ chối'}</b> · ${esc(r.msg)}</div></div>`:'';
  return `<section class='panel' aria-labelledby='h-pm'><h2 id='h-pm'>Kiểm tra phân quyền giữa các giáo viên</h2><p class='lead'>Hệ thống có ${n} giáo viên, mỗi lớp có đúng một người phụ trách; giáo viên chỉ thấy và thao tác trên lớp của mình. Thử một thao tác trên lớp của mình (được phép) và trên lớp của giáo viên khác (bị từ chối). Đây là kiểm tra ở tầng prototype: backend thật phải kiểm tra lại ở mọi API.</p><div class='row' style='align-items:flex-end'><div class='selectbox' style='min-width:240px'><label for='pm-c'>Lớp</label><select id='pm-c' onchange='PERMSEL.c=this.value'>${classes.map(x=>`<option value="${esc(x.id)}" ${x.id===PERMSEL.c?'selected':''}>${esc(x.id)} · ${esc(ownerName(x))}</option>`).join('')}</select></div><div class='selectbox' style='min-width:260px'><label for='pm-o'>Thao tác</label><select id='pm-o' onchange='PERMSEL.o=+this.value'>${PERM_OPS.map((x,i)=>`<option value="${i}" ${i===PERMSEL.o?'selected':''}>${esc(x[0])}</option>`).join('')}</select></div><button class='btn' id='pm-go' type='button' onclick='permTry()'>Thực hiện</button></div>${res}${PERMLOG.length?`<div class='tablewrap' style='margin-top:12px'><table><thead><tr><th scope='col'>Thao tác</th><th scope='col'>Lớp (người phụ trách)</th><th scope='col'>Kết quả</th><th scope='col'>Tiêu chí</th></tr></thead><tbody>${PERMLOG.slice(0,8).map(x=>`<tr><td>${esc(x.op)}</td><td>${esc(x.cls)} (${esc(x.owner)})</td><td>${x.ok?`<span class='pill good'>Được phép</span>`:`<span class='pill need'>Bị từ chối</span>`}</td><td>${x.ac}</td></tr>`).join('')}</tbody></table></div>`:''}</section>`;
}
function permTry(){
  try{
    const sc=document.getElementById('pm-c'),so=document.getElementById('pm-o');
    if(sc)PERMSEL.c=sc.value;if(so)PERMSEL.o=+so.value;
    const c=classes.find(x=>x.id===PERMSEL.c);if(!c)throw new Error('không tìm thấy lớp '+PERMSEL.c);
    const op=PERM_OPS[PERMSEL.o]||PERM_OPS[0],ok=owns(c),msg=(ok?'lớp '+c.id+' do bạn phụ trách':'lớp '+c.id+' do '+ownerName(c)+' phụ trách, không thuộc quyền của bạn')+' · thao tác: '+op[0]+' ('+op[1]+').';
    PERMLOG.unshift({op:op[0],cls:c.id,owner:ownerName(c),ok,ac:op[1]});
    PERMRES={ok,msg};toast((ok?'Được phép: ':'Bị từ chối: ')+msg);
  }catch(e){PERMRES={ok:false,msg:'Không thực hiện được: '+(e&&e.message||e)}}
  flashId='permRes';render();
}
/* Lớp rào quyền cho các thao tác ghi: dù giao diện chỉ hiện lớp của mình, mọi thao tác đều kiểm tra lại chủ lớp */
['editClass','delClass','addStudents','removeStudent','newTopic','editTopic','togTopic','moveTopic','delTopic','newLesson','addObj','editLesson','togglePub','editObj','delObj','delLesson','pickFile','delRes','pickCourseFile','delCourseFile','addAssignment','togAsg','editAsg','delAsg','newQuiz','editQuiz','togglePubQ','delQuiz','addQ','rmQ','editQ','delQ','gradeAtt','saveGrade','dismissGap','newAIReq'].forEach(n=>{
  const f=window[n];if(typeof f!=='function')return;
  window[n]=function(){if(role==='T'){const c=selected();if(!owns(c)){toast('Bị từ chối: lớp này không do bạn phụ trách.');return}}return f.apply(this,arguments)};
});
