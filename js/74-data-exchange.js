/* EducMind · js/74-data-exchange.js
   Nhập danh sách / xuất dữ liệu lớp ra CSV. */
/* ===== Bước 5: nhập danh sách / xuất dữ liệu lớp ===== */
function csvCell(v){const x=String(v==null?'':v);return /[",;\n\r]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x}
function downloadCsv(filename,rows){
  const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Đã xuất '+filename+' (CSV UTF-8, mở được bằng Excel).');
}
function exportClassData(kind){
  const c=selected();let name='',rows=[];
  if(kind==='roster'){
    name='danh-sach-hoc-sinh-'+c.id+'.csv';rows=[['Lớp','Họ tên','Email','Ngày vào lớp']].concat(c.students.map(s=>[c.id,s.name,s.email,s.joinedAt||'']));
  }else if(kind==='progress'){
    name='muc-do-nam-vung-'+c.id+'.csv';rows=[['Lớp','Học sinh','Email','Mã mục tiêu','Mục tiêu','Mức nắm vững (%)','Số bằng chứng','Lỗ hổng']];
    c.students.forEach(st=>c.goals.forEach((g,j)=>rows.push([c.id,st.name,st.email,codeOf(c,j),g,st.mastery[j]==null?'':pct(st.mastery[j]),(st.ev[j]||[]).length,(st.gaps[j]||{}).status||''])));
  }else if(kind==='evidence'){
    name='bang-chung-hoc-tap-'+c.id+'.csv';rows=[['Lớp','Học sinh','Email','Mã mục tiêu','Mục tiêu','Ngày','Điểm (%)','Nguồn','Tham chiếu']];
    c.students.forEach(st=>c.goals.forEach((g,j)=>(st.ev[j]||[]).forEach(e=>rows.push([c.id,st.name,st.email,codeOf(c,j),g,trendDate(e.day),pct(e.s),e.src||'',e.key||'']))));
  }else{
    name='ket-qua-bai-tap-'+c.id+'.csv';rows=[['Lớp','Bài tập','Trạng thái bài','Hạn nộp','Điểm tối đa','Học sinh','Email','Trạng thái nộp','Điểm','Nhận xét','Rubric']];
    c.assignments.forEach(a=>c.students.forEach((st,i)=>{const b=(a.subs||[])[i]||{};rows.push([c.id,a.name,a.status,a.due,a.max,st.name,st.email,b.has?(b.status||'Đã nộp'):'Chưa nộp',b.score==null?'':b.score,b.fb||'',(b.rubricScores||[]).map(r=>r.name+': '+r.score+'/'+r.max+(r.comment?' ('+r.comment+')':'')).join(' | ')])}));
  }
  downloadCsv(name,rows);
}
function dataExchangePage(){
  const c=selected();return `<div class='data-exchange-page'><section class='panel data-exchange-head'><div><span class='cal-eyebrow'>DỮ LIỆU LỚP · ${esc(c.id)}</span><h2>Nhập / xuất dữ liệu</h2><p>Nhập danh sách học sinh hoặc câu hỏi theo mẫu; xuất tiến độ, bằng chứng và kết quả thành CSV UTF-8 để mở bằng Excel.</p></div></section><div class='data-exchange-grid'><section class='panel'><div class='exchange-icon'>${ic('upload',19)}</div><h3>Nhập dữ liệu</h3><p>Hệ thống sẽ xem trước và kiểm tra các dòng trước khi ghi nhận. Không nhập đè điểm số hoặc bằng chứng học tập.</p><div class='exchange-actions'><button class='btn' onclick="importFile('students')">${ic('students',16)}Nhập danh sách học sinh</button><button class='btn light' onclick="importFile('questions')">${ic('questions',16)}Nhập ngân hàng câu hỏi</button><button class='btn light' onclick="addAssignment('UPLOAD')">Tạo bài tập từ tệp Excel/Word</button></div><small>Danh sách học sinh: CSV, Excel hoặc Word theo mẫu. Câu hỏi: CSV/Excel/Word theo mẫu trong màn nhập.</small></section><section class='panel'><div class='exchange-icon is-export'>${ic('download',19)}</div><h3>Xuất dữ liệu của lớp</h3><p>Các tệp CSV có hàng tiêu đề, mã hóa UTF-8 và mở được trong Excel. Chỉ xuất dữ liệu thuộc lớp đang chọn.</p><div class='exchange-actions'><button class='btn light' onclick="exportClassData('roster')">Danh sách học sinh</button><button class='btn light' onclick="exportClassData('progress')">Mức nắm vững theo mục tiêu</button><button class='btn light' onclick="exportClassData('evidence')">Bằng chứng học tập chi tiết</button><button class='btn light' onclick="exportClassData('grades')">Bài nộp, điểm & rubric</button><button class='btn' onclick="setPage('report')">${ic('trend',16)}Mở báo cáo tiến bộ</button></div><small>Chưa hỗ trợ nhập điểm từ tệp; điểm và kết quả phân tích chỉ thay đổi qua quy trình chấm của giáo viên.</small></section></div><section class='panel exchange-safety'><b>Kiểm soát dữ liệu</b><p>Kiểm tra lớp đang chọn trước khi nhập/xuất. Tệp chứa thông tin học sinh và kết quả học tập là dữ liệu riêng tư; chỉ chia sẻ với người được phép.</p></section></div>`;
}
