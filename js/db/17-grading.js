/* EducMind · js/db/17-grading.js
   Trang “Chấm điểm & Kết quả” — đúng tên và vị trí trong điều hướng của prototype.
   Một cửa tổng hợp mọi bài đang chờ chấm (bài tập + lượt làm bài kiểm tra); mở từng mục
   để chấm điểm và nhận xét ngay tại màn hình chi tiết hiện có. */

DB_PAGES.grading = {
  title: 'Chấm điểm & Kết quả',
  sub: () => (dbIsTeacher() ? 'Tất cả bài đang chờ chấm ở một nơi; mở từng bài để chấm điểm và nhận xét.' : 'Điểm và nhận xét của em nằm ở trang “Kết quả học tập”.'),
  async load() {
    if (!dbIsTeacher()) return {};
    const content = await dbLoadContent();
    const [assignments, assessments] = DB.course
      ? await Promise.all([dbCall(EducMindDB.listAssignments(DB.course.id)), dbCall(EducMindDB.listAssessments(DB.course.id))])
      : [[], []];
    const ids = assignments.map((a) => a.id), eids = assessments.map((e) => e.id);
    const [submissions, attempts, roster] = await Promise.all([
      dbCallIn(EducMindDB.listSubmissions, ids),
      dbCallIn(EducMindDB.listAttempts, eids),
      dbLoadRoster(),
    ]);
    return { ...content, assignments, assessments, submissions, attempts, ...roster };
  },
  view(d) { return dbIsTeacher() ? dbGradingTeacher(d) : dbGradingStudent(); },
};

function dbGradingStudent() {
  return `<section class="panel">${dbEmpty('Trang này dành cho giáo viên. Em xem điểm và nhận xét trong “Kết quả học tập”.')}
    <div class="row">${dbBtn('Mở Kết quả học tập', 'go', { page: 'report' }, '')}</div>
  </section>`;
}

function dbGradingTeacher(d) {
  const subsBy = dbGroup(d.submissions, 'assignment_id'), attBy = dbGroup(d.attempts, 'assessment_id');
  const nameOf = (sid) => h(dbName(d.profiles[sid]));
  /* Các bài tập còn bài chờ chấm: mỗi học sinh một dòng, mở đúng màn chấm của bài đó. */
  const asgRows = [];
  d.assignments.forEach((a) => {
    (subsBy[a.id] || []).filter((s) => s.score == null).forEach((s) => {
      asgRows.push(`<tr>
        <th scope="row">${nameOf(s.student_id)}</th>
        <td><button type="button" class="db-link" data-act="go" data-page="assignments" data-id="${h(a.id)}">${h(a.title)}</button><div class="muted">${dbLessonTitle(d, a.lesson_id) || 'Chưa gắn bài học'}</div></td>
        <td>${dbPill(s.status === 'LATE' ? 'Đã nộp muộn' : 'Đã nộp', 'prog')}<div class="muted">${dbDateTime(s.submitted_at)}</div></td>
        <td class="db-cell-actions">${dbBtn('Chấm bài', 'go', { page: 'assignments', id: a.id }, 'mini')}</td>
      </tr>`);
    });
  });
  /* Lượt làm bài kiểm tra đã nộp, chờ chấm câu tự luận. */
  const attRows = [];
  d.assessments.forEach((e) => {
    (attBy[e.id] || []).filter((t) => t.status === 'SUBMITTED').forEach((t) => {
      attRows.push(`<tr>
        <th scope="row">${nameOf(t.student_id)}</th>
        <td><button type="button" class="db-link" data-act="go" data-page="assessments" data-id="${h(e.id)}">${h(e.title)}</button><div class="muted">${dbWindowText(e)}</div></td>
        <td>${dbPill('Lượt ' + h(t.attempt_number) + ' · chờ chấm', 'prog')}<div class="muted">Nộp lúc ${dbDateTime(t.submitted_at)}</div></td>
        <td class="db-cell-actions">${dbBtn('Chấm bài', 'go', { page: 'assessments', id: e.id, tab: 'attempts' }, 'mini')}</td>
      </tr>`);
    });
  });
  const graded = d.submissions.filter((s) => s.score != null).length + d.attempts.filter((t) => t.status === 'GRADED').length;
  return `<div class="grid db-metrics">
    ${metric('grade', 'Chờ chấm bài tập', asgRows.length, 'bài nộp chưa có điểm')}
    ${metric('assessments', 'Chờ chấm kiểm tra', attRows.length, 'lượt làm chờ chấm')}
    ${metric('check', 'Đã chấm', graded, 'bài nộp và lượt làm')}
    ${metric('students', 'Học sinh', d.members.length, 'trong lớp đang chọn')}
  </div>
  <section class="panel" aria-labelledby="db-h-gr1">
    <h2 id="db-h-gr1">Bài tập chờ chấm</h2>
    <p class="lead">Điểm từ 0 đến điểm tối đa của từng bài; lưu điểm xong mức nắm vững được tính lại.</p>
    ${asgRows.length ? dbTable(['Học sinh', 'Bài tập', 'Trạng thái', '<span class="sr">Thao tác</span>'], asgRows, 'Bài tập chờ chấm') : dbEmpty('Không có bài nộp nào chờ chấm.')}
  </section>
  <section class="panel" aria-labelledby="db-h-gr2">
    <h2 id="db-h-gr2">Lượt làm bài kiểm tra chờ chấm</h2>
    <p class="lead">Phần trắc nghiệm đã được chấm tự động; các câu tự luận cần giáo viên xác nhận.</p>
    ${attRows.length ? dbTable(['Học sinh', 'Bài kiểm tra', 'Trạng thái', '<span class="sr">Thao tác</span>'], attRows, 'Lượt làm chờ chấm') : dbEmpty('Không có lượt làm nào chờ chấm.')}
  </section>`;
}
