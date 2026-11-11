/* EducMind · js/07-pages-basic.js
   Các trang đời đầu của giáo viên: tổng quan thư mục, bài học, bài tập, bài kiểm tra. */
/* ===== Các trang ===== */
function overview(){
  const c=selected(),g=gaps(c),m=pct(avg(c)),nh=needHelp(c);
  return `
  <div class="grid">
    ${metric('students','Học sinh',c.count,'Trong lớp '+c.id)}
    ${metric('mastery','Mức nắm vững trung bình',m+'%','Tổng hợp '+c.goals.length+' mục tiêu')}
    ${metric('gaps','Lỗ hổng đang mở',openGaps(c).length,'Học sinh – mục tiêu dưới 0,50')}
    ${metric('assignments','Bài tập đã giao',c.assignments.length,'Bài tập đã giao của lớp')}
  </div>
  <div class="cols">
    <section class="panel" aria-labelledby="h-goals">
      <div class="row between"><h2 id="h-goals">Tổng quan mục tiêu học tập</h2><span class="pill plain">${c.topic}</span></div>
      <p class="lead">Mức nắm vững của cả lớp theo từng mục tiêu.</p>
      <div class="tablewrap"><table>
        <thead><tr><th scope="col">Mục tiêu học tập</th><th scope="col">Mức nắm vững</th><th scope="col">Trạng thái</th></tr></thead>
        <tbody>${c.goals.map((goal,i)=>`<tr>
          <td>${gl(c,i)}</td>
          <td style="min-width:130px"><b>${hasData(c,i)?pct(c.scores[i])+'%':'Chưa có dữ liệu'}</b>${bar(c.scores[i],tier(c.scores[i]),'Mức nắm vững: '+goal)}</td>
          <td>${hasData(c,i)?tierPill(c.scores[i]):'–'}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>
    <section class="panel" aria-labelledby="h-attn">
      <h2 id="h-attn">Cần chú ý</h2>
      <p class="lead">${g.length?g.length+' mục tiêu có học sinh đang hổng':'Không có lỗ hổng theo ngưỡng minh họa'} · ${nh.length}/${c.count} học sinh cần hỗ trợ</p>
      ${g.length?g.map(x=>`<div class="item"><div><b>${x.g}</b><div class="muted">Mức nắm vững ${pct(x.m)}%</div></div><span class="pill need">${ic('alert',14)}Lỗ hổng</span></div>`).join(''):`<div class="empty">${ic('check',22)}<br>Lớp ${c.id} đang ổn.</div>`}
      <button class="btn light" style="margin-top:8px" onclick="setPage('gaps')">Xem lỗ hổng kiến thức${ic('arrow',16)}</button>
    </section>
  </div>
  <section class="panel" aria-labelledby="h-act">
    <h2 id="h-act">Hoạt động gần đây</h2>
    <p class="lead">Tiến độ nộp bài của lớp ${c.id}.</p>
    ${c.assignments.map(a=>`<div class="item"><div style="flex:1;min-width:0"><b>${a.name}</b><div class="muted">Hạn nộp ${a.due} · ${a.graded} bài đã chấm</div>${bar(a.submitted/c.count,'','Tiến độ nộp: '+a.name)}</div><span class="pill plain">${a.submitted}/${c.count} đã nộp</span></div>`).join('')}
    ${note('Khi chuyển lớp, toàn bộ thống kê, học sinh, bài học, bài tập và kết quả sẽ thay đổi theo lớp được chọn.')}
  </section>`;
}
function lessons(){
  const c=selected();
  return `<section class="panel" aria-labelledby="h-ls">
    <div class="row between"><h2 id="h-ls">Khóa học Tin học · ${c.id}</h2><span class="pill good">${ic('check',14)}Đang hoạt động</span></div>
    <p class="lead">Chủ đề: ${c.topic}</p>
    ${c.lessonsData.map(l=>`<div class="item"><div><b>${l.name}</b><div class="muted">${l.goals.length} mục tiêu học tập · ${l.goals.join(' · ')}</div></div><span class="pill good">${ic('check',14)}${l.status}</span></div>`).join('')}
    <button class="btn light" style="margin-top:10px" onclick="toast('Đây là prototype dữ liệu mẫu; thao tác tạo bài học chưa kết nối backend.')">${ic('plus',16)}Tạo bài học mẫu</button>
  </section>`;
}
function assignments(){
  const c=selected(),ai=Math.min(gradeAi,c.assignments.length-1),a=c.assignments[ai];
  return `<section class="panel" aria-labelledby="h-as">
    <div class="row between"><h2 id="h-as">Bài tập của lớp ${c.id}</h2><button class="btn" onclick="addAssignment()">${ic('plus',16)}Tạo bài tập</button></div>
    <p class="lead" style="margin-top:4px">Theo dõi tiến độ nộp và chấm bài.</p>
    <div class="tablewrap"><table>
      <thead><tr><th scope="col">Bài tập</th><th scope="col">Hạn nộp</th><th scope="col">Đã nộp</th><th scope="col">Đã chấm</th><th scope="col">Trạng thái</th></tr></thead>
      <tbody>${c.assignments.map(x=>`<tr><td><b>${x.name}</b></td><td>${x.due}</td><td style="min-width:110px">${x.submitted}/${c.count}${bar(x.submitted/c.count,'','Đã nộp: '+x.name)}</td><td style="min-width:110px">${x.graded}/${c.count}${bar(x.graded/c.count,'good','Đã chấm: '+x.name)}</td><td><span class="pill good">${ic('check',14)}${x.status}</span></td></tr>`).join('')}</tbody>
    </table></div>
  </section>
  <section class="panel" aria-labelledby="h-gr">
    <h2 id="h-gr">Chấm bài và phản hồi</h2>
    <p class="lead">Điểm hợp lệ từ 0 đến ${a.max}. Lưu điểm sẽ tạo hoặc cập nhật bằng chứng học tập rồi tính lại mức nắm vững ngay.</p>
    <p class="muted" style="margin:0 0 10px">Mục tiêu gắn với bài tập: ${a.objs.map(j=>c.goals[j]).join('; ')}</p>
    <div class="tablewrap"><table>
      <thead><tr><th scope="col">Học sinh</th><th scope="col">Bài nộp</th><th scope="col">Chấm</th><th scope="col">Điểm (/${a.max})</th></tr></thead>
      <tbody>${c.students.map((s,i)=>{const ok=!!a.subs[i].has,sc=a.subs[i].score;return `<tr><td class="student">${s.name}</td><td>${ok?'<span class="pill prog">Đã nộp</span>':'<span class="pill plain">Chưa nộp</span>'}</td><td>${sc!=null?'<span class="pill good">'+ic('check',14)+'Đã chấm</span>':ok?'<span class="pill need">Chờ chấm</span>':'–'}</td><td>${ok?`<input id="sc-${i}" type="number" min="0" max="${a.max}" step="0.1" value="${sc??''}" style="width:90px" aria-label="Điểm của ${s.name}"> <button class="btn light" onclick="saveGrade(${ai},${i})">Lưu điểm</button>`:'–'}</td></tr>`}).join('')}</tbody>
    </table></div>
  </section>`;
}
function assessments(){
  const c=selected();
  return `<section class="panel" aria-labelledby="h-qz">
    <div class="row between"><h2 id="h-qz">Kết quả kiểm tra · ${c.id}</h2><span class="pill good">${ic('check',14)}${c.quiz.status}</span></div>
    <p class="lead">Tổng hợp lượt làm và điểm trung bình.</p>
    <div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:0">
      ${metric('assessments','Tên bài kiểm tra',c.quiz.name,'Theo nội dung '+c.topic,true)}
      ${metric('students','Lượt làm',c.quiz.attempts+'/'+c.count,'Học sinh đã tham gia')}
      ${metric('mastery','Điểm trung bình',c.quiz.average+'/10','Dữ liệu minh họa')}
    </div>
    ${attemptTable(c)}${note('Điểm trung bình được tính từ điểm chính thức cao nhất của từng học sinh đã hoàn tất chấm, không lấy lượt cao nhất của cả lớp.')}
  </section>`;
}
