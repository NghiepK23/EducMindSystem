/* EducMind · js/db/10-home.js
   Trang Tổng quan của giáo viên và học sinh, và trang Lịch sử chỉnh sửa (chỉ giáo viên). */

DB_PAGES.home = {
  title: 'Tổng quan',
  sub: () => { const c = dbClass(); return c ? 'Lớp ' + h(c.name) + (dbClassMeta(c) ? ' · ' + dbClassMeta(c) : '') : ''; },
  async load() {
    if (!DB.classId) return {};
    const content = await dbLoadContent();
    const [assignments, assessments] = DB.course ? await Promise.all([dbCall(EducMindDB.listAssignments(DB.course.id)), dbCall(EducMindDB.listAssessments(DB.course.id))]) : [[], []];
    const objIds = content.objectives.map((o) => o.id);
    const [submissions, attempts, mastery, gaps, recsAll, roster] = await Promise.all([
      dbCallIn(EducMindDB.listSubmissions, assignments.map((a) => a.id)), dbCallIn(EducMindDB.listAttempts, assessments.map((e) => e.id)),
      dbCallIn(EducMindDB.listMastery, objIds), dbCallIn(EducMindDB.listGaps, objIds),
      dbIsTeacher() ? [] : dbCall(EducMindDB.listRecommendations()), dbIsTeacher() ? dbLoadRoster() : { members: [], profiles: {} },
    ]);
    const objSet = new Set(objIds), exSet = new Set(assessments.map((e) => e.id));
    return { ...content, assignments, assessments, submissions, attempts, mastery, gaps, ...roster, recs: recsAll.filter((r) => (r.objective_id && objSet.has(r.objective_id)) || (r.assessment_id && exSet.has(r.assessment_id))) };
  },
  view(d) { return dbIsTeacher() ? dbHomeTeacher(d) : dbHomeStudent(d); },
};
const dbTodo = (title, meta, page, arg, label) => `<div class="item"><div><b>${title}</b><div class="muted">${meta}</div></div>${dbBtn(label, 'go', { page, ...arg }, 'light mini')}</div>`;

function dbHomeTeacher(d) {
  const subsBy = dbGroup(d.submissions, 'assignment_id'), attBy = dbGroup(d.attempts, 'assessment_id');
  const toGrade = d.assignments.map((a) => ({ a, n: (subsBy[a.id] || []).filter((s) => s.score == null).length })).filter((x) => x.n);
  const toMark = d.assessments.map((e) => ({ e, n: (attBy[e.id] || []).filter((t) => t.status === 'SUBMITTED').length })).filter((x) => x.n);
  const waiting = toGrade.reduce((s, x) => s + x.n, 0) + toMark.reduce((s, x) => s + x.n, 0);
  const openGaps = d.gaps.filter((g) => g.status === 'OPEN').length, avg = dbMean(d.mastery.map((m) => Number(m.mastery_score)));
  const now = dbNow(), soon = now + 7 * 86400000;
  const upcoming = d.assignments.filter((a) => a.status === 'PUBLISHED' && new Date(a.due_at).getTime() >= now && new Date(a.due_at).getTime() <= soon);
  const openExams = d.assessments.filter((e) => e.status === 'PUBLISHED' && dbAssessmentWindow(e) === 'OPEN');
  const drafts = d.assignments.filter((a) => a.status === 'DRAFT').length + d.assessments.filter((e) => e.status === 'DRAFT').length + d.lessons.filter((l) => l.status === 'DRAFT').length;
  return `<div class="grid db-metrics">
    ${metric('students', 'Học sinh', d.members.length, 'trong lớp đang chọn')}
    ${metric('grade', 'Chờ chấm', waiting, 'bài nộp và lượt làm bài')}
    ${metric('gaps', 'Lỗ hổng đang mở', openGaps, 'trên mọi học sinh của lớp')}
    ${metric('mastery', 'Mức nắm vững trung bình', dbPct(avg), d.mastery.length ? 'trên ' + d.objectives.length + ' mục tiêu' : 'chưa có kết quả')}
  </div>
  <div class="cols">
    <section class="panel" aria-labelledby="db-h-todo"><h2 id="db-h-todo">Việc cần làm</h2>
      <p class="lead">${waiting ? waiting + ' bài đang chờ chấm' : 'Không có bài nào đang chờ chấm.'}${drafts ? ' · ' + drafts + ' nội dung còn là bản nháp' : ''}</p>
      ${toGrade.map((x) => dbTodo(h(x.a.title), `Bài tập · ${x.n} bài nộp chờ chấm`, 'assignments', { id: x.a.id }, 'Chấm bài')).join('')}
      ${toMark.map((x) => dbTodo(h(x.e.title), `Bài kiểm tra · ${x.n} lượt chờ chấm câu tự luận`, 'assessments', { id: x.e.id, tab: 'attempts' }, 'Chấm bài')).join('')}
      ${!d.topics.length ? dbTodo('Lớp chưa có nội dung', 'Thêm chủ đề, bài học và mục tiêu để bắt đầu.', 'content', {}, 'Soạn bài học') : ''}
      ${!d.members.length ? dbTodo('Lớp chưa có học sinh', 'Gửi mã lớp cho học sinh hoặc thêm bằng email.', 'classes', {}, 'Mở lớp học') : ''}
    </section>
    <section class="panel" aria-labelledby="db-h-up"><h2 id="db-h-up">Đang diễn ra</h2>
      <p class="lead">Hạn nộp trong 7 ngày tới và bài kiểm tra đang mở.</p>
      ${upcoming.map((a) => dbTodo(h(a.title), 'Hạn nộp ' + dbDateTime(a.due_at) + ' · ' + (subsBy[a.id] || []).length + '/' + d.members.length + ' đã nộp', 'assignments', { id: a.id }, 'Mở')).join('')}
      ${openExams.map((e) => dbTodo(h(e.title), 'Đóng lúc ' + dbDateTime(e.close_at) + ' · ' + (attBy[e.id] || []).length + ' lượt làm', 'assessments', { id: e.id, tab: 'attempts' }, 'Mở')).join('')}
      ${!upcoming.length && !openExams.length ? dbEmpty('Không có bài tập sắp đến hạn hay bài kiểm tra đang mở.') : ''}
    </section>
  </div>`;
}
function dbHomeStudent(d) {
  const mine = Object.fromEntries(d.submissions.map((s) => [s.assignment_id, s])), attBy = dbGroup(d.attempts, 'assessment_id');
  const todoAsg = d.assignments.filter((a) => !mine[a.id] && dbAssignmentWindow(a) !== 'CLOSED');
  const todoEx = d.assessments.filter((e) => { const att = attBy[e.id] || []; return att.some((t) => t.status === 'IN_PROGRESS') || (dbAssessmentWindow(e) === 'OPEN' && !att.length); });
  const avg = dbMean(d.mastery.map((m) => Number(m.mastery_score))), newRecs = d.recs.filter((r) => r.status === 'ACTIVE').length, openGaps = d.gaps.filter((g) => g.status === 'OPEN').length;
  const graded = d.submissions.filter((s) => s.score != null).map((s) => ({ at: s.graded_at, html: dbTodo(h((d.assignments.find((a) => a.id === s.assignment_id) || {}).title || 'Bài tập'), 'Bài tập · ' + dbNum(s.score) + ' điểm · chấm lúc ' + dbDateTime(s.graded_at), 'assignments', { id: s.assignment_id }, 'Xem') }))
    .concat(d.attempts.filter((t) => t.status === 'GRADED').map((t) => ({ at: t.graded_at, html: dbTodo(h((d.assessments.find((e) => e.id === t.assessment_id) || {}).title || 'Bài kiểm tra'), 'Bài kiểm tra · lượt ' + t.attempt_number + ' · ' + dbNum(t.total_score) + ' điểm', 'assessments', { id: t.assessment_id, attempt: t.id }, 'Xem') })))
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
  return `<div class="grid db-metrics">
    ${metric('assignments', 'Bài tập cần nộp', todoAsg.length, 'còn trong hạn nhận bài')}
    ${metric('assessments', 'Bài kiểm tra cần làm', todoEx.length, 'đang mở hoặc đang làm dở')}
    ${metric('mastery', 'Mức nắm vững trung bình', dbPct(avg), d.mastery.length ? 'trên ' + d.mastery.length + ' mục tiêu đã có kết quả' : 'chưa có kết quả')}
    ${metric('recommend', 'Gợi ý mới', newRecs, openGaps ? openGaps + ' lỗ hổng đang mở' : 'không có lỗ hổng đang mở')}
  </div>
  <div class="cols">
    <section class="panel" aria-labelledby="db-h-stodo"><h2 id="db-h-stodo">Việc cần làm</h2>
      <p class="lead">${todoAsg.length + todoEx.length ? (todoAsg.length + todoEx.length) + ' việc' : 'Em đã hoàn thành mọi việc được giao.'}</p>
      ${todoEx.map((e) => dbTodo(h(e.title), 'Bài kiểm tra · ' + e.duration_minutes + ' phút · đóng lúc ' + dbDateTime(e.close_at), 'assessments', { id: e.id }, 'Mở')).join('')}
      ${todoAsg.map((a) => dbTodo(h(a.title), 'Bài tập · ' + dbDueText(a), 'assignments', { id: a.id }, 'Làm bài')).join('')}
    </section>
    <section class="panel" aria-labelledby="db-h-sres"><h2 id="db-h-sres">Kết quả mới</h2>
      <p class="lead">Các bài vừa được chấm.</p>
      ${graded.map((x) => x.html).join('') || dbEmpty('Chưa có bài nào được chấm.')}
    </section>
  </div>`;
}

/* ===== Lịch sử chỉnh sửa (giáo viên) ===== */
const DB_REV_ENTITY = {
  course_topics: 'Chủ đề', lessons: 'Bài học', learning_objectives: 'Mục tiêu', resources: 'Tài liệu', assignments: 'Bài tập', rubric_criteria: 'Tiêu chí chấm',
  assignment_objectives: 'Mục tiêu của bài tập', questions: 'Câu hỏi', question_objectives: 'Mục tiêu của câu hỏi', assessments: 'Bài kiểm tra',
  assessment_questions: 'Câu hỏi trong đề', assignment_submissions: 'Điểm bài tập', rubric_scores: 'Điểm theo tiêu chí', submission_answers: 'Điểm câu trả lời',
};
const DB_REV_ACTION = { CREATE: ['Tạo', 'good'], UPDATE: ['Sửa', 'prog'], DELETE: ['Xóa', 'need'], SOFT_DELETE: ['Xóa', 'need'], RESTORE: ['Khôi phục', 'good'], PUBLISH: ['Xuất bản', 'good'], UNPUBLISH: ['Gỡ xuất bản', 'plain'], GRADE: ['Chấm điểm', 'prog'] };
DB_PAGES.history = {
  title: 'Lịch sử chỉnh sửa',
  sub: 'Máy chủ tự ghi mỗi lần giáo viên thay đổi nội dung hoặc điểm của lớp. Lịch sử không sửa và không xóa được từ giao diện.',
  async load() {
    const [revisions, content] = await Promise.all([dbCall(EducMindDB.listRevisions(DB.classId, 200)), dbLoadContent()]);
    return { revisions, ...content };
  },
  view(d) {
    const objById = dbById(d.objectives);
    const what = (r) => {
      const s = r.after_state || r.before_state || {};
      if (r.action === 'GRADE') { const b = r.before_state || {}, a = r.after_state || {}; return 'Điểm ' + (b.score == null ? 'chưa chấm' : dbNum(b.score)) + ' → ' + (a.score == null ? 'chưa chấm' : dbNum(a.score)); }
      if (s.objective_id && objById[s.objective_id]) return dbObjLabel(objById[s.objective_id]);
      return h(String(s.title || s.content || s.description || s.file_name || s.code || '').slice(0, 140));
    };
    const rows = d.revisions.map((r) => `<tr><td>${dbDateTime(r.created_at)}</td><td>${dbPill((DB_REV_ACTION[r.action] || [r.action, 'plain'])[0], (DB_REV_ACTION[r.action] || [r.action, 'plain'])[1])}</td><td>${h(DB_REV_ENTITY[r.entity_type] || r.entity_type)}</td><td>${what(r)}</td></tr>`);
    return `<section class="panel" aria-labelledby="db-h-h"><h2 id="db-h-h">Thay đổi gần đây</h2><p class="lead">${d.revisions.length ? d.revisions.length + ' thay đổi gần nhất của lớp.' : ''}</p>
      ${rows.length ? dbTable(['Thời điểm', 'Thao tác', 'Đối tượng', 'Nội dung'], rows, 'Lịch sử chỉnh sửa') : dbEmpty('Chưa có thay đổi nào được ghi.')}</section>`;
  },
};
