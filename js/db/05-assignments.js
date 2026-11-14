/* EducMind · js/db/05-assignments.js
   Bài tập: giáo viên tạo, gắn mục tiêu, xuất bản, xem bài nộp và chấm điểm; học sinh xem, nộp bài và xem điểm.
   Lưu ý: Điểm bài tập chia cho điểm tối đa trở thành bằng chứng học tập của từng mục tiêu gắn với bài (máy chủ tự tính). */

/* Danh sách học sinh của lớp đang chọn kèm hồ sơ (chỉ giáo viên đọc được). */
async function dbLoadRoster() {
  if (!DB.classId) return { members: [], profiles: {} };
  const members = await dbCallIn(EducMindDB.listMembers, [DB.classId]);
  const profiles = await dbCallIn(EducMindDB.listProfiles, members.map((m) => m.student_id));
  return { members, profiles: dbById(profiles) };
}
/* Trạng thái nhận bài theo thời điểm hiện tại: OPEN (còn hạn), LATE (quá hạn nhưng còn nhận bài muộn), CLOSED. */
function dbAssignmentWindow(a) {
  const now = dbNow();
  if (now <= new Date(a.due_at).getTime()) return 'OPEN';
  if (a.allow_late && a.late_close_at && now <= new Date(a.late_close_at).getTime()) return 'LATE';
  return 'CLOSED';
}
const dbDueText = (a) => 'Hạn nộp ' + dbDateTime(a.due_at) + (a.allow_late && a.late_close_at ? ' · nhận bài muộn đến ' + dbDateTime(a.late_close_at) : '');

DB_PAGES.assignments = {
  title: () => (dbIsTeacher() ? 'Bài tập & kiểm tra' : 'Bài tập'),
  sub: () => (dbIsTeacher() ? 'Bài tập xếp theo Chủ đề và Bài học; chuyển tab “Bài kiểm tra” để soạn đề và theo dõi lượt làm.' : 'Bài tập giáo viên đã giao cho lớp.'),
  async load() {
    const content = await dbLoadContent();
    const assignments = DB.course ? await dbCall(EducMindDB.listAssignments(DB.course.id)) : [];
    const ids = assignments.map((a) => a.id);
    const [links, submissions] = await Promise.all([dbCallIn(EducMindDB.listAssignmentObjectives, ids), dbCallIn(EducMindDB.listSubmissions, ids)]);
    const [criteria, rubricScores, assignmentQuestions, assignmentAnswers] = await Promise.all([
      dbCallIn(EducMindDB.listRubricCriteria, ids),
      dbCallIn(EducMindDB.listRubricScores, submissions.map((s) => s.id)),
      dbIsTeacher() ? dbCallIn(EducMindDB.listAssignmentQuestions, ids) : [],
      dbCallIn(EducMindDB.listAssignmentAnswers, submissions.map((s) => s.id)),
    ]);
    const roster = dbIsTeacher() ? await dbLoadRoster() : { members: [], profiles: {} };
    const questions = dbIsTeacher() && DB.course ? await dbCall(EducMindDB.listQuestions(DB.course.id)) : [];
    const assignmentQuestionDetails = dbIsTeacher() && DB.course ? await dbCall(EducMindDB.listAssignmentQuestionDetails(DB.course.id)) : [];
    const studentQuestions = !dbIsTeacher() && DB.arg.id ? await dbCall(EducMindDB.getAssignmentQuestions(DB.arg.id)) : [];
    return { ...content, assignments, links, submissions, criteria, rubricScores, assignmentQuestions, assignmentAnswers, questions, assignmentQuestionDetails, studentQuestions, ...roster };
  },
  view(d) {
    const T = dbIsTeacher();
    if (T && DB.arg.edit) return dbAssignmentForm(d, DB.arg.edit === 'new' ? null : d.assignments.find((a) => a.id === DB.arg.edit));
    if (DB.arg.id) {
      const a = d.assignments.find((x) => x.id === DB.arg.id);
      if (!a) return `<section class="panel">${dbEmpty('Không tìm thấy bài tập này (có thể đã bị xóa hoặc chưa xuất bản).')}${dbBtn('Về danh sách bài tập', 'go', { page: 'assignments' }, 'light')}</section>`;
      return T ? dbAssignmentTeacherDetail(d, a) : dbAssignmentStudentDetail(d, a);
    }
    return T ? dbAssignmentTeacherList(d) : dbAssignmentStudentList(d);
  },
};
const dbLessonTitle = (d, id) => { const l = d.lessons.find((x) => x.id === id); return l ? h(l.title) : ''; };
function dbAssignmentObjectives(d, a) {
  const byId = dbById(d.objectives);
  return d.links.filter((x) => x.assignment_id === a.id).map((x) => byId[x.objective_id]).filter(Boolean);
}

/* ===== Giáo viên ===== */
/* Tab “Bài tập” / “Bài kiểm tra” — đúng giao diện seg-page mà prototype dùng ở trang này. */
function dbWorkSeg(active) {
  const tab = (k, label, icon, page) => `<button type="button" role="tab" aria-selected="${active === k}" data-act="go" data-page="${page}">${ic(icon, 16)}<span>${label}</span></button>`;
  return `<div class="seg seg-page" role="tablist" aria-label="Nội dung Bài tập và kiểm tra">${tab('asg', 'Bài tập', 'assignments', 'assignments')}${tab('quiz', 'Bài kiểm tra', 'assessments', 'assessments')}</div>`;
}
/* Gom danh sách theo Chủ đề → Bài học như prototype: mục không gắn bài học nằm ở nhóm “Cấp lớp”. */
function dbScopeGroups(d, items, cardHtml) {
  const used = new Set();
  let groups = '';
  (d.topics || []).forEach((t) => {
    const lessons = d.lessons.filter((l) => l.topic_id === t.id);
    const inner = lessons.map((l) => {
      const its = items.filter((x) => x.lesson_id === l.id);
      if (!its.length) return '';
      its.forEach((x) => used.add(x));
      return `<details class="scope-lesson"><summary><b>${h(l.title)}</b><span class="pill plain">${its.length} bài</span></summary>${its.map(cardHtml).join('')}</details>`;
    }).join('');
    const n = items.filter((x) => x.lesson_id && lessons.some((l) => l.id === x.lesson_id)).length;
    if (n || inner) groups += `<details class="scope-group" open><summary><span><b>Chủ đề: ${h(t.title)}</b><span class="muted"> · ${lessons.length} bài học</span></span><span class="pill plain">${n} bài</span></summary>${inner}</details>`;
  });
  const course = items.filter((x) => !used.has(x));
  if (course.length) groups += `<details class="scope-group" open><summary><span><b>Cấp lớp</b><span class="muted"> · nội dung tổng hợp</span></span><span class="pill plain">${course.length} bài</span></summary>${course.map(cardHtml).join('')}</details>`;
  return groups;
}
function dbAssignmentTeacherList(d) {
  const subsBy = dbGroup(d.submissions, 'assignment_id'), questionsBy = dbGroup(d.assignmentQuestions, 'assignment_id'), total = d.members.length;
  const card = (a) => {
    const subs = subsBy[a.id] || [], waiting = subs.filter((s) => s.score == null).length, pub = a.status === 'PUBLISHED', nQ = (questionsBy[a.id] || []).length;
    return `<details class="work-card">
      <summary><span class="work-detail"><b>${h(a.title)}</b> ${dbStatusPill(a.status)} <span class="pill prog">${nQ ? `Bộ câu hỏi · ${nQ} câu` : 'Nộp tệp hoặc bài tự luận'}</span>
        <div class="muted" style="margin-top:4px">${dbDueText(a)} · ${subs.length}/${total} nộp${waiting ? ` · <b>${waiting}</b> chờ chấm` : ''} · tối đa ${dbNum(a.max_score)} điểm${dbLessonTitle(d, a.lesson_id) ? ' · ' + dbLessonTitle(d, a.lesson_id) : ''}</div></span>
        <span class="pill plain">Mở chi tiết</span></summary>
      <div class="work-actions">${dbBtn('Mở & chấm điểm', 'go', { page: 'assignments', id: a.id }, 'light mini')}${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleAssignment', { id: a.id }, pub ? 'light mini' : 'mini')}${dbBtn('Sửa', 'go', { page: 'assignments', edit: a.id }, 'light mini')}${dbBtn('Xóa', 'deleteAssignment', { id: a.id }, 'light mini danger-soft')}</div>
      ${a.description ? `<div class="muted" style="margin-top:8px">${h(a.description)}</div>` : ''}
    </details>`;
  };
  const groups = dbScopeGroups(d, d.assignments, card);
  return dbWorkSeg('asg')
    + `<div class="row asg-plusbar">${dbBtn(ic('plus', 16) + 'Tạo bài tập', 'go', { page: 'assignments', edit: 'new' })}</div>`
    + (groups || dbEmpty('Chưa có bài tập nào. Bấm “Tạo bài tập” để mở trình tạo: chọn nguồn câu hỏi, gắn phạm vi bài học rồi giao bài.'));
}
function dbAssignmentForm(d, a) {
  if (DB.arg.edit !== 'new' && !a) return `<section class="panel">${dbEmpty('Không tìm thấy bài tập cần sửa.')}</section>`;
  const picked = new Set(a ? d.links.filter((x) => x.assignment_id === a.id).map((x) => x.objective_id) : []);
  const defDue = new Date(dbNow() + 7 * 86400000); defDue.setHours(23, 59, 0, 0);
  return `<section class="panel" aria-labelledby="db-h-af">
    <h2 id="db-h-af">${a ? 'Sửa bài tập' : 'Tạo bài tập'}</h2>
    <p class="lead">Bài tập mới ở trạng thái bản nháp. Sau khi lưu, hãy thêm câu hỏi hoặc yêu cầu; học sinh chỉ thấy bài sau khi xuất bản.</p>
    <form data-act="saveAssignment" data-id="${h(a ? a.id : '')}" novalidate>
      ${dbField('Tên bài tập', 'db-af-title', `<input id="db-af-title" name="title" maxlength="200" value="${h(a ? a.title : '')}" required>`)}
      ${dbField('Yêu cầu', 'db-af-desc', `<textarea id="db-af-desc" name="description" rows="5" maxlength="5000">${h(a ? a.description : '')}</textarea>`)}
      <div class="db-form-grid">
        ${dbField('Bài học', 'db-af-lesson', `<select id="db-af-lesson" name="lesson_id"><option value="">Không gắn bài học</option>${d.lessons.map((l) => `<option value="${h(l.id)}" ${a && a.lesson_id === l.id ? 'selected' : ''}>${h(l.title)}</option>`).join('')}</select>`)}
        ${dbField('Hạn nộp', 'db-af-due', `<input id="db-af-due" name="due" type="datetime-local" value="${dbToLocalInput(a ? a.due_at : defDue.toISOString())}" required>`)}
        ${dbField('Điểm tối đa', 'db-af-max', `<input id="db-af-max" name="max_score" type="number" min="0.5" step="0.5" value="${h(a ? a.max_score : 10)}" required>`)}
      </div>
      <div class="db-form-grid db-late-grid">
        <div class="field"><label class="db-check"><input type="checkbox" id="db-af-late" name="allow_late" ${a && a.allow_late ? 'checked' : ''}> Cho phép nộp muộn</label></div>
        ${dbField('Nhận bài muộn đến', 'db-af-lateclose', `<input id="db-af-lateclose" name="late_close" type="datetime-local" value="${dbToLocalInput(a ? a.late_close_at : '')}">`, 'Chỉ dùng khi cho phép nộp muộn; phải sau hạn nộp.')}
      </div>
      <div class="field"><span class="db-label">Mục tiêu được đánh giá qua bài tập này</span>${dbObjectivePicker(d, 'objectives', picked)}</div>
      ${dbFormError()}
      <div class="row db-form-actions">${dbBtn('Hủy', 'go', { page: 'assignments' }, 'light')}<button type="submit" class="btn">${a ? 'Lưu thay đổi' : 'Tạo bài tập'}</button></div>
    </form>
  </section>`;
}
DB_ACT.saveAssignment = (form) => dbRun(form, async (v) => {
  const id = form.dataset.id;
  if (!v.title) throw new Error('Nhập tên bài tập.');
  const due = dbFromLocalInput(v.due);
  if (!due) throw new Error('Chọn hạn nộp.');
  const max = Number(v.max_score);
  if (!(max > 0)) throw new Error('Điểm tối đa phải lớn hơn 0.');
  let lateClose = null;
  if (v.allow_late) {
    lateClose = dbFromLocalInput(v.late_close);
    if (!lateClose) throw new Error('Chọn thời điểm ngừng nhận bài muộn.');
    if (new Date(lateClose) <= new Date(due)) throw new Error('Thời điểm ngừng nhận bài muộn phải sau hạn nộp.');
  }
  const course = await dbEnsureCourse();
  const row = { title: v.title, description: v.description || '', lesson_id: v.lesson_id || null, due_at: due, allow_late: !!v.allow_late, late_close_at: lateClose, max_score: max };
  let a;
  if (id) { a = await dbCall(EducMindDB.updateAssignment(id, { ...row, topic_id: null })); }
  else a = await dbCall(EducMindDB.createAssignment({ ...row, course_id: course.id }));
  const current = id ? DB.data.links.filter((x) => x.assignment_id === id).map((x) => x.objective_id) : [];
  await dbSyncLinks(current, v.objectives || [],
    (add) => dbCall(EducMindDB.addAssignmentObjectives(add.map((o) => ({ assignment_id: a.id, objective_id: o })))),
    (rem) => dbCall(EducMindDB.removeAssignmentObjectives(a.id, rem)));
  toast(id ? 'Đã lưu bài tập.' : 'Đã tạo bài tập (bản nháp). Hãy thêm câu hỏi hoặc yêu cầu trước khi xuất bản.');
  await dbGo('assignments', { id: a.id });
  return false;
});
DB_ACT.toggleAssignment = (el) => dbRun(el, async () => {
  const a = DB.data.assignments.find((x) => x.id === el.dataset.id), pub = a.status === 'PUBLISHED';
  if (!pub) {
    const hasQuestions = DB.data.assignmentQuestions.some((x) => x.assignment_id === a.id);
    if (!hasQuestions && !(a.description || '').trim()) throw new Error('Hãy thêm ít nhất một câu hỏi hoặc nhập yêu cầu bài tập trước khi xuất bản.');
  }
  await dbCall(EducMindDB.updateAssignment(a.id, { status: pub ? 'DRAFT' : 'PUBLISHED' }));
  toast(pub ? 'Đã gỡ xuất bản bài tập.' : 'Đã xuất bản bài tập. Học sinh trong lớp nhận được thông báo.');
});
DB_ACT.deleteAssignment = (el) => {
  const a = DB.data.assignments.find((x) => x.id === el.dataset.id);
  dbConfirm('Xóa bài tập?', `Bài tập “${h(a.title)}” sẽ bị ẩn khỏi lớp. Bài nộp và điểm đã có vẫn được giữ trong cơ sở dữ liệu.`, 'Xóa bài tập', async () => {
    await dbCall(EducMindDB.updateAssignment(a.id, { deleted_at: new Date().toISOString() }));
    toast('Đã xóa bài tập.');
  }, true);
};
function dbAssignmentFacts(d, a) {
  const objs = dbAssignmentObjectives(d, a);
  return `<div class="facts">
      <div><span>Hạn nộp</span><b>${dbDateTime(a.due_at)}</b></div>
      <div><span>Nộp muộn</span><b>${a.allow_late ? 'Đến ' + dbDateTime(a.late_close_at) : 'Không nhận'}</b></div>
      <div><span>Điểm tối đa</span><b>${dbNum(a.max_score)}</b></div>
      <div><span>Bài học</span><b>${dbLessonTitle(d, a.lesson_id) || '—'}</b></div>
    </div>
    ${a.description ? `<div class="db-prose">${h(a.description)}</div>` : ''}
    ${objs.length ? `<div class="db-objlist"><span class="db-label">Mục tiêu được đánh giá</span><ul>${objs.map((o) => `<li>${dbObjLabel(o)}</li>`).join('')}</ul></div>` : (dbIsTeacher() ? `<p class="muted">Bài tập chưa gắn mục tiêu nên điểm sẽ không được tính vào mức nắm vững.</p>` : '')}`;
}
function dbAssignmentTeacherQuestions(d, a) {
  const links = d.assignmentQuestions.filter((x) => x.assignment_id === a.id);
  const byId = dbById(d.assignmentQuestionDetails), used = new Set(links.map((x) => x.question_id));
  const bank = d.questions.filter((q) => !used.has(q.id));
  const locked = d.submissions.some((s) => s.assignment_id === a.id);
  const rows = links.map((x, i) => {
    const q = byId[x.question_id];
    return `<tr><td>${i + 1}</td><th scope="row">${q ? `<div class="db-qtext">${h(q.content)}</div><div class="muted">${h(DB_QKIND[q.kind] || q.kind)} · Đáp án: ${h(dbAnswerKeyText(q))}${q.deleted_at ? ' · Đã xóa khỏi ngân hàng' : ''}</div>` : '<span class="muted">Câu hỏi không còn trong ngân hàng.</span>'}</th>
    <td class="db-cell-actions">${locked ? '' : dbBtn('Gỡ', 'removeAssignmentQuestion', { id: a.id, q: x.question_id }, 'light mini danger-soft')}</td></tr>`;
  });
  const picker = locked
    ? `<div class="notice">${ic('lock', 16)}<div>Đã có học sinh nộp bài nên danh sách câu hỏi bị khóa để bảo đảm công bằng.</div></div>`
    : bank.length
    ? `<form data-act="addAssignmentQuestions" data-id="${h(a.id)}" novalidate>
        <div class="db-objpick">${bank.map((q) => `<label class="objrow"><input type="checkbox" name="pick" data-multi value="${h(q.id)}"><span><span class="db-qtext">${h(q.content)}</span><span class="muted"> · ${h(DB_QKIND[q.kind] || q.kind)} · ${h(DB_QDIFF[q.difficulty] || q.difficulty)}</span></span></label>`).join('')}</div>
        <div class="row db-form-actions"><button type="submit" class="btn">Thêm câu đã chọn</button>${dbFormError()}</div>
      </form>`
    : dbEmpty(d.questions.length ? 'Đã thêm hết câu hỏi trong ngân hàng.' : 'Ngân hàng câu hỏi chưa có câu nào.');
  return `<section class="panel" aria-labelledby="db-h-asq">
    <div class="row between"><div><h2 id="db-h-asq">Câu hỏi của bài tập</h2><p class="lead">${links.length} câu · học sinh trả lời trực tiếp; giáo viên chấm điểm trong bài nộp.</p></div>
    ${locked ? '' : dbBtn(ic('plus', 16) + 'Tạo câu hỏi mới', 'go', { page: 'questions', edit: 'new', return_to: 'assignment', assignment_id: a.id }, 'light')}</div>
    ${rows.length ? dbTable(['#', 'Câu hỏi', '<span class="sr">Thao tác</span>'], rows, 'Câu hỏi trong bài tập') : dbEmpty('Chưa có câu hỏi nào.')}
    ${picker}
  </section>`;
}
DB_ACT.addAssignmentQuestions = (form) => dbRun(form, async (v) => {
  const picks = [].concat(v.pick || []).filter(Boolean);
  if (!picks.length) throw new Error('Chọn ít nhất một câu hỏi.');
  const current = DB.data.assignmentQuestions.filter((x) => x.assignment_id === form.dataset.id);
  const used = new Set(current.map((x) => x.question_id));
  const rows = [...new Set(picks)].filter((id) => !used.has(id)).map((question_id, i) => ({
    assignment_id: form.dataset.id,
    question_id,
    display_order: current.reduce((max, x) => Math.max(max, Number(x.display_order) || 0), 0) + i + 1,
  }));
  if (!rows.length) throw new Error('Các câu đã chọn đều có trong bài tập.');
  await dbCall(EducMindDB.addAssignmentQuestions(rows));
}, 'Đã thêm câu hỏi vào bài tập.');
DB_ACT.removeAssignmentQuestion = (el) => dbRun(el, async () => {
  const removed = await dbCall(EducMindDB.removeAssignmentQuestion(el.dataset.id, el.dataset.q));
  if (!removed.length) throw new Error('Không gỡ được câu hỏi này.');
}, 'Đã gỡ câu hỏi khỏi bài tập.');
function dbAssignmentAnswerReview(d, a, answers) {
  const links = d.assignmentQuestions.filter((x) => x.assignment_id === a.id);
  if (!links.length) return '';
  const questions = dbById(d.assignmentQuestionDetails), answerById = dbById(answers.map((x) => ({ ...x, id: x.question_id })));
  return `<div class="db-assignment-answers"><h3>Câu trả lời</h3>${links.map((link, i) => {
    const q = questions[link.question_id], answer = answerById[link.question_id];
    if (!q) return `<div><b>Câu ${i + 1}</b><p class="muted">Câu hỏi không còn trong ngân hàng.</p></div>`;
    const text = answer ? dbAnswerText(q, answer.answer_content) : '';
    return `<div><b>Câu ${i + 1} · ${h(DB_QKIND[q.kind] || q.kind)}</b><div class="db-prose">${h(q.content)}</div><p><b>Trả lời:</b> ${text ? h(text) : '<span class="muted">Chưa trả lời</span>'}</p></div>`;
  }).join('')}</div>`;
}
function dbAssignmentTeacherDetail(d, a) {
  const subs = Object.fromEntries(d.submissions.filter((s) => s.assignment_id === a.id).map((s) => [s.student_id, s]));
  const answersBySubmission = dbGroup(d.assignmentAnswers, 'submission_id');
  const rows = d.members.map((m) => {
    const p = d.profiles[m.student_id], s = subs[m.student_id];
    if (!s) return `<tr><th scope="row">${h(dbName(p))}</th><td>${dbPill('Chưa nộp', 'plain')}</td><td class="muted">—</td><td class="muted">—</td></tr>`;
    return `<tr>
      <th scope="row">${h(dbName(p))}<div class="muted">${dbDateTime(s.submitted_at)}${s.is_edited ? ' · đã sửa' : ''}</div></th>
      <td>${s.score != null ? dbPill('Đã chấm', 'good') : s.status === 'LATE' ? dbPill('Nộp muộn', 'need') : dbPill('Chờ chấm', 'prog')}</td>
      <td><details class="db-work"><summary>Xem bài làm</summary>${s.text_content ? `<div class="db-prose">${h(s.text_content)}</div>` : ''}${dbAssignmentAnswerReview(d, a, answersBySubmission[s.id] || [])}${s.storage_path ? `<div class="db-file"><span class="db-file-name">${ic('overview', 14)}<span class="db-file-title">${h(dbSubName(s))}</span></span><span class="row db-file-actions">${dbBtn('Xem trước', 'previewSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}${dbBtn('Tải tệp bài nộp', 'downloadSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}</span></div>` : ''}${!s.text_content && !s.storage_path && !d.assignmentQuestions.some((x) => x.assignment_id === a.id) ? '<div class="muted">(không có nội dung văn bản)</div>' : ''}</details></td>
      <td>${dbGradeCell(d, a, p, s)}</td>
    </tr>`;
  });
  const n = Object.keys(subs).length, graded = Object.values(subs).filter((s) => s.score != null).length;
  return `<section class="panel" aria-labelledby="db-h-ad">
    <div class="row between"><div><h2 id="db-h-ad">${h(a.title)}</h2><p class="lead">${dbStatusPill(a.status)} · ${n}/${d.members.length} đã nộp · ${graded} đã chấm</p></div>
      <div class="row">${dbBtn('Về danh sách', 'go', { page: 'assignments' }, 'light')}${dbBtn('Sửa bài tập', 'go', { page: 'assignments', edit: a.id }, 'light')}</div></div>
    ${dbAssignmentFacts(d, a)}
  </section>
  ${dbAssignmentTeacherQuestions(d, a)}
  <section class="panel" aria-labelledby="db-h-subs">
    <h2 id="db-h-subs">Bài nộp</h2>
    <p class="lead">Điểm từ 0 đến ${dbNum(a.max_score)}. Lưu điểm xong, học sinh nhận thông báo và mức nắm vững được tính lại.</p>
    ${rows.length ? dbTable(['Học sinh', 'Trạng thái', 'Bài làm', 'Điểm và nhận xét'], rows, 'Bài nộp của học sinh') : dbEmpty('Lớp chưa có học sinh.')}
  </section>
  ${dbRubricPanel(d, a)}`;
}

/* Tên tệp từ đường dẫn lưu trữ: bỏ phần mã số thời gian phía trước. */
const dbFileName = (p) => decodeURIComponent(String(p).split('/').pop() || '').replace(/^\d+-/, '');
/* Tên hiển thị của tệp bài nộp: ưu tiên tên gốc học sinh đã chọn khi tải lên. */
const dbSubName = (s) => s.file_name || dbFileName(s.storage_path);
/* Ô chấm điểm: có rubric thì nhập điểm từng tiêu chí (tổng là điểm bài nộp); không thì nhập điểm trực tiếp. */
function dbGradeCell(d, a, p, s) {
  const crits = (d.criteria || []).filter((c) => c.assignment_id === a.id);
  const scores = (d.rubricScores || []).filter((x) => x.submission_id === s.id);
  const scoreBox = crits.length
    ? `<div class="db-rubric">${crits.map((c) => { const rs = scores.find((x) => x.criterion_id === c.id); return `<label class="db-rubric-row"><span>${h(c.title)} <span class="muted">/ ${dbNum(c.max_score)}</span></span><input name="rc-${h(c.id)}" type="number" min="0" max="${h(c.max_score)}" step="0.25" value="${h(rs == null ? '' : rs.score)}" class="db-input-score" required></label>`; }).join('')}<p class="muted">Tổng điểm các tiêu chí là điểm bài nộp.</p></div>`
    : `<label class="sr" for="db-gs-${h(s.id)}">Điểm của ${h(dbName(p))}</label><input id="db-gs-${h(s.id)}" name="score" type="number" min="0" max="${h(a.max_score)}" step="0.25" value="${h(s.score == null ? '' : s.score)}" placeholder="Điểm" class="db-input-score" required><span class="muted">/ ${dbNum(a.max_score)}</span>`;
  return `<form data-act="gradeSubmission" data-id="${h(s.id)}" class="db-grade" novalidate>
    ${scoreBox}
    <label class="sr" for="db-gf-${h(s.id)}">Nhận xét cho ${h(dbName(p))}</label>
    <textarea id="db-gf-${h(s.id)}" name="feedback" rows="2" maxlength="2000" placeholder="Nhận xét">${h(s.feedback || '')}</textarea>
    <button type="submit" class="btn mini">${s.score != null ? 'Cập nhật điểm' : 'Lưu điểm'}</button>${dbFormError()}
  </form>`;
}
/* Thang điểm chi tiết (rubric) của bài tập: giáo viên đặt tiêu chí trước khi chấm. */
function dbRubricPanel(d, a) {
  const crits = (d.criteria || []).filter((c) => c.assignment_id === a.id);
  const rows = crits.map((c) => `<tr>
    <th scope="row">${h(c.title)}${c.description ? `<div class="muted">${h(c.description)}</div>` : ''}</th>
    <td>${dbNum(c.max_score)}</td>
    <td class="db-cell-actions">${dbBtn('Sửa', 'editCriterion', { id: c.id }, 'light mini')}${dbBtn('Xóa', 'deleteCriterion', { id: c.id }, 'light mini danger-soft')}</td>
  </tr>`);
  return `<section class="panel" aria-labelledby="db-h-rub">
    <h2 id="db-h-rub">Thang điểm chi tiết (rubric)</h2>
    <p class="lead">Đặt các tiêu chí chấm (ví dụ: Nội dung, Trình bày). Khi chấm, tổng điểm các tiêu chí là điểm bài nộp và học sinh thấy điểm từng tiêu chí.</p>
    ${rows.length ? dbTable(['Tiêu chí', 'Điểm tối đa', '<span class="sr">Thao tác</span>'], rows, 'Tiêu chí chấm') : dbEmpty('Chưa có tiêu chí nào. Thêm tiêu chí nếu muốn chấm điểm chi tiết.')}
    <form data-act="addCriterion" data-id="${h(a.id)}" class="db-form-row db-add-row" novalidate>
      ${dbField('Tiêu chí mới', 'db-rc-title', `<input id="db-rc-title" name="title" maxlength="200" placeholder="Ví dụ: Nội dung" required>`)}
      ${dbField('Mô tả', 'db-rc-desc', `<input id="db-rc-desc" name="description" maxlength="500" placeholder="Yêu cầu của tiêu chí">`)}
      ${dbField('Điểm tối đa', 'db-rc-max', `<input id="db-rc-max" name="max_score" type="number" min="0.5" step="0.5" value="5" required>`)}
      <button type="submit" class="btn light">Thêm tiêu chí</button>${dbFormError()}
    </form>
  </section>`;
}
DB_ACT.gradeSubmission = (form) => dbRun(form, async (v) => {
  const a = DB.data.assignments.find((x) => x.id === DB.arg.id);
  const crits = (DB.data.criteria || []).filter((c) => a && c.assignment_id === a.id);
  let score, rubricRows = null;
  if (crits.length) {
    /* Có rubric: điểm từng tiêu chí bắt buộc nhập; tổng điểm tiêu chí là điểm bài nộp. */
    rubricRows = crits.map((c) => {
      const raw = v['rc-' + c.id];
      if (raw === '' || raw == null) throw new Error('Nhập điểm cho tiêu chí “' + c.title + '”.');
      const n = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > Number(c.max_score)) throw new Error('Điểm tiêu chí “' + c.title + '” phải từ 0 đến ' + dbNum(c.max_score) + '.');
      return { submission_id: form.dataset.id, criterion_id: c.id, score: n, feedback: '' };
    });
    score = rubricRows.reduce((s, r) => s + Number(r.score), 0);
    if (a && score > Number(a.max_score)) throw new Error('Tổng điểm rubric (' + dbNum(score) + ') vượt điểm tối đa của bài tập (' + dbNum(a.max_score) + '). Hãy giảm điểm tối đa của các tiêu chí.');
  } else {
    if (v.score === '') throw new Error('Nhập điểm.');
    score = Number(String(v.score).replace(',', '.'));
    if (!Number.isFinite(score) || score < 0) throw new Error('Điểm phải là số không âm.');
    if (a && score > Number(a.max_score)) throw new Error('Điểm tối đa của bài này là ' + dbNum(a.max_score) + '.');
  }
  if (rubricRows) await dbCall(EducMindDB.saveRubricScores(rubricRows));
  await dbCall(EducMindDB.gradeSubmission(form.dataset.id, { score, feedback: v.feedback || '' }));
}, 'Đã lưu điểm và nhận xét.');

/* ===== Thang điểm chi tiết (rubric) ===== */
DB_ACT.addCriterion = (form) => dbRun(form, async (v) => {
  const a = DB.data.assignments.find((x) => x.id === form.dataset.id);
  if (!v.title) throw new Error('Nhập tên tiêu chí.');
  const max = Number(String(v.max_score).replace(',', '.'));
  if (!(max > 0)) throw new Error('Điểm tối đa của tiêu chí phải lớn hơn 0.');
  const crits = (DB.data.criteria || []).filter((c) => a && c.assignment_id === a.id);
  await dbCall(EducMindDB.createRubricCriterion({ assignment_id: a.id, title: v.title, description: v.description || '', max_score: max, display_order: crits.reduce((m, x) => Math.max(m, x.display_order || 0), 0) + 1 }));
}, 'Đã thêm tiêu chí chấm.');
DB_ACT.editCriterion = (el) => {
  const c = (DB.data.criteria || []).find((x) => x.id === el.dataset.id);
  if (!c) return;
  dbOpenDialog({
    title: 'Sửa tiêu chí', okLabel: 'Lưu thay đổi',
    body: dbField('Tên tiêu chí', 'db-ec-title', `<input id="db-ec-title" name="title" maxlength="200" value="${h(c.title)}" required>`)
      + dbField('Mô tả', 'db-ec-desc', `<input id="db-ec-desc" name="description" maxlength="500" value="${h(c.description)}">`)
      + dbField('Điểm tối đa', 'db-ec-max', `<input id="db-ec-max" name="max_score" type="number" min="0.5" step="0.5" value="${h(c.max_score)}" required>`, 'Điểm tối đa mới không được nhỏ hơn điểm đã chấm.'),
    onOk: async (v) => {
      if (!v.title) throw new Error('Nhập tên tiêu chí.');
      const max = Number(String(v.max_score).replace(',', '.'));
      if (!(max > 0)) throw new Error('Điểm tối đa của tiêu chí phải lớn hơn 0.');
      await dbCall(EducMindDB.updateRubricCriterion(c.id, { title: v.title, description: v.description || '', max_score: max }));
      toast('Đã lưu tiêu chí.');
    },
  });
};
DB_ACT.deleteCriterion = (el) => {
  const c = (DB.data.criteria || []).find((x) => x.id === el.dataset.id);
  if (!c) return;
  if ((DB.data.rubricScores || []).some((x) => x.criterion_id === c.id)) return toast('Tiêu chí đã có điểm chấm nên không xóa được.');
  dbConfirm('Xóa tiêu chí?', `Tiêu chí “${h(c.title)}” sẽ bị xóa khỏi thang điểm của bài tập.`, 'Xóa tiêu chí', async () => {
    await dbCall(EducMindDB.deleteRubricCriterion(c.id));
    toast('Đã xóa tiêu chí.');
  }, true);
};

/* ===== Học sinh ===== */
function dbSubmissionPill(a, s) {
  if (s && s.score != null) return dbPill(`Đã chấm ${dbNum(s.score)}/${dbNum(a.max_score)}`, 'good');
  if (s) return dbPill(s.status === 'LATE' ? 'Đã nộp muộn' : 'Đã nộp', 'prog');
  const w = dbAssignmentWindow(a);
  return w === 'OPEN' ? dbPill('Chưa nộp', 'need') : w === 'LATE' ? dbPill('Quá hạn · còn nhận bài muộn', 'need') : dbPill('Đã hết hạn', 'plain');
}
function dbAssignmentStudentList(d) {
  const mine = Object.fromEntries(d.submissions.map((s) => [s.assignment_id, s]));
  const todo = d.assignments.filter((a) => !mine[a.id] && dbAssignmentWindow(a) !== 'CLOSED');
  const card = (a) => `<article class="db-task">
      <div class="row between"><div><button type="button" class="db-link db-task-title" data-act="go" data-page="assignments" data-id="${h(a.id)}">${h(a.title)}</button><div class="muted">${[dbLessonTitle(d, a.lesson_id), dbDueText(a), 'Tối đa ' + dbNum(a.max_score) + ' điểm'].filter(Boolean).join(' · ')}</div></div>
      <div class="row">${dbSubmissionPill(a, mine[a.id])}${dbBtn(mine[a.id] ? 'Xem bài' : 'Làm bài', 'go', { page: 'assignments', id: a.id }, mine[a.id] ? 'light' : '')}</div></div>
    </article>`;
  return `<section class="panel" aria-labelledby="db-h-sa">
    <h2 id="db-h-sa">Bài tập được giao</h2>
    <p class="lead">${d.assignments.length} bài tập · ${todo.length} bài cần nộp</p>
    ${d.assignments.length ? d.assignments.map(card).join('') : dbEmpty('Chưa có bài tập nào được giao.')}
  </section>`;
}
function dbAssignmentStudentQuestions(d, submission, editable) {
  const questions = d.studentQuestions || [];
  if (!questions.length) return '';
  const answers = dbById((d.assignmentAnswers || []).filter((x) => submission && x.submission_id === submission.id).map((x) => ({ ...x, id: x.question_id })));
  const items = questions.map((q, i) => {
    const saved = answers[q.question_id], answer = saved ? saved.answer_content : null, options = Array.isArray(q.options) ? q.options : [], name = 'db-asg-' + q.question_id;
    const optionList = !editable && options.length ? `<ol class="db-options" type="A">${options.map((option) => `<li>${h(option)}</li>`).join('')}</ol>` : '';
    let response;
    if (!editable) {
      const text = saved ? dbAnswerText(q, answer) : '';
      response = `<p><b>Câu trả lời:</b> ${text ? h(text) : '<span class="muted">Chưa trả lời</span>'}</p>`;
    } else if (q.kind === 'SINGLE_CHOICE') {
      response = options.map((option, k) => `<label class="objrow"><input type="radio" name="${h(name)}" value="${k}" data-assignment-answer="${h(q.question_id)}" ${answer != null && answer !== '' && Number(answer) === k ? 'checked' : ''}><span>${dbLetter(k)}. ${h(option)}</span></label>`).join('');
    } else if (q.kind === 'MULTIPLE_CHOICE') {
      const selected = new Set(answer == null || answer === '' ? [] : [].concat(answer).map(Number));
      response = `<div class="muted db-hint">Chọn mọi đáp án đúng.</div>` + options.map((option, k) => `<label class="objrow"><input type="checkbox" name="${h(name)}" value="${k}" data-assignment-answer="${h(q.question_id)}" ${selected.has(k) ? 'checked' : ''}><span>${dbLetter(k)}. ${h(option)}</span></label>`).join('');
    } else if (q.kind === 'TRUE_FALSE') {
      response = [['true', 'Đúng'], ['false', 'Sai']].map(([value, label]) => `<label class="objrow"><input type="radio" name="${h(name)}" value="${value}" data-assignment-answer="${h(q.question_id)}" ${answer != null && String(answer) === value ? 'checked' : ''}><span>${label}</span></label>`).join('');
    } else if (q.kind === 'SHORT_ANSWER') {
      response = `<label class="sr" for="${h(name)}">Câu trả lời câu ${i + 1}</label><input id="${h(name)}" type="text" maxlength="1000" value="${h(answer == null ? '' : answer)}" data-assignment-answer="${h(q.question_id)}" placeholder="Câu trả lời của em">`;
    } else {
      response = `<label class="sr" for="${h(name)}">Bài làm câu ${i + 1}</label><textarea id="${h(name)}" rows="5" maxlength="20000" data-assignment-answer="${h(q.question_id)}" placeholder="Bài làm của em">${h(answer == null ? '' : answer)}</textarea>`;
    }
    return `<fieldset class="field db-question"><legend><b>Câu ${i + 1} · ${h(DB_QKIND[q.kind] || q.kind)}</b></legend><div class="db-prose">${h(q.content)}</div>${optionList}<div class="db-answers">${response}</div></fieldset>`;
  }).join('');
  return `<div class="db-assignment-questions"><h3>Câu hỏi (${questions.length})</h3>${items}</div>`;
}
function dbReadAssignmentAnswers(form, questions) {
  return Object.fromEntries(questions.map((q) => {
    const controls = [...form.querySelectorAll(`[data-assignment-answer="${q.question_id}"]`)];
    let answer = null;
    if (q.kind === 'SINGLE_CHOICE') {
      const checked = controls.find((x) => x.checked);
      answer = checked ? Number(checked.value) : '';
    } else if (q.kind === 'MULTIPLE_CHOICE') answer = controls.filter((x) => x.checked).map((x) => Number(x.value));
    else if (q.kind === 'TRUE_FALSE') {
      const checked = controls.find((x) => x.checked);
      answer = checked ? checked.value === 'true' : '';
    } else answer = controls[0] ? controls[0].value : '';
    return [q.question_id, answer];
  }));
}
function dbAssignmentAnswerBlank(value) {
  return value == null || value === '' || (Array.isArray(value) && !value.length) || (typeof value === 'string' && !value.trim());
}
function dbAssignmentStudentDetail(d, a) {
  const s = d.submissions.find((x) => x.assignment_id === a.id), w = dbAssignmentWindow(a), graded = s && s.score != null;
  let form;
  if (graded) form = `<div class="notice">${ic('info', 16)}<div>Bài đã được chấm nên không sửa được nữa.</div></div>`;
  else if (w === 'CLOSED') form = `<div class="notice">${ic('info', 16)}<div>${s ? 'Đã hết hạn nên không sửa được bài nộp.' : 'Đã hết hạn nộp bài.'}</div></div>`;
  else form = `<form data-act="submitAssignment" data-id="${h(a.id)}" novalidate>
      ${dbAssignmentStudentQuestions(d, s, true)}
      ${dbField(s ? 'Bài làm của em (có thể sửa và nộp lại)' : 'Bài làm của em', 'db-sub-text', `<textarea id="db-sub-text" name="text" rows="10" maxlength="20000">${h(s ? s.text_content || '' : '')}</textarea>`, w === 'LATE' ? 'Đã quá hạn nộp: bài nộp hoặc sửa lúc này được ghi là nộp muộn.' : '')}
      <div class="field"><span class="db-label">Tệp đính kèm (không bắt buộc, tối đa 20 MB)</span>
        ${s && s.storage_path ? `<div class="db-file"><span class="db-file-name">${ic('overview', 14)}<span class="db-file-title">${h(dbSubName(s))}</span></span><span class="muted db-file-meta">Chọn tệp khác để thay tệp này.</span><span class="row db-file-actions">${dbBtn('Xem trước', 'previewSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}${dbBtn('Tải xuống', 'downloadSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}</span></div>` : ''}
        <input type="file" id="db-sub-file" name="file" class="db-input-file" aria-label="Chọn tệp bài làm">
      </div>
      ${dbFormError()}
      <div class="row db-form-actions"><button type="submit" class="btn">${s ? 'Nộp lại' : 'Nộp bài'}</button></div>
    </form>`;
  return `<section class="panel" aria-labelledby="db-h-sd">
    <div class="row between"><div><h2 id="db-h-sd">${h(a.title)}</h2><p class="lead">${dbSubmissionPill(a, s)}${s ? ' · nộp lúc ' + dbDateTime(s.submitted_at) + (s.is_edited ? ' (đã sửa)' : '') : ''}</p></div>${dbBtn('Về danh sách', 'go', { page: 'assignments' }, 'light')}</div>
    ${dbAssignmentFacts(d, a)}
  </section>
  ${graded ? `<section class="panel" aria-labelledby="db-h-res"><h2 id="db-h-res">Kết quả</h2>
      <div class="facts"><div><span>Điểm</span><b>${dbNum(s.score)} / ${dbNum(a.max_score)}</b></div><div><span>Chấm lúc</span><b>${dbDateTime(s.graded_at)}</b></div>${dbRubricResult(d, s)}</div>
      ${s.feedback ? `<div class="db-prose"><b>Nhận xét của giáo viên:</b> ${h(s.feedback)}</div>` : ''}</section>` : ''}
  <section class="panel" aria-labelledby="db-h-sw"><h2 id="db-h-sw">Bài làm</h2>
    ${graded || w === 'CLOSED' ? (s ? `${dbAssignmentStudentQuestions(d, s, false)}${s.text_content ? `<div class="db-prose">${h(s.text_content)}</div>` : ''}${s.storage_path ? `<div class="db-file"><span class="db-file-name">${ic('overview', 14)}<span class="db-file-title">${h(dbSubName(s))}</span></span><span class="row db-file-actions">${dbBtn('Xem trước', 'previewSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}${dbBtn('Tải xuống', 'downloadSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}</span></div>` : ''}` : dbAssignmentStudentQuestions(d, null, false)) : form}
  </section>`;
}
/* Điểm từng tiêu chí rubric trong trang kết quả của học sinh. */
function dbRubricResult(d, s) {
  const rows = (d.rubricScores || []).filter((x) => x.submission_id === s.id);
  if (!rows.length) return '';
  const crit = dbById(d.criteria || []);
  return rows.map((r) => { const c = crit[r.criterion_id]; return c ? `<div><span>${h(c.title)}</span><b>${dbNum(r.score)} / ${dbNum(c.max_score)}</b></div>` : ''; }).join('');
}
DB_ACT.submitAssignment = (form) => dbRun(form, async (v) => {
  const a = DB.data.assignments.find((x) => x.id === form.dataset.id);
  const prev = (DB.data.submissions || []).find((x) => x.assignment_id === a.id);
  const questions = DB.data.studentQuestions || [], answers = dbReadAssignmentAnswers(form, questions);
  /* Tệp đính kèm (không bắt buộc): tải lên kho bài nộp rồi lưu đường dẫn vào bài nộp. */
  const input = form.querySelector('input[type="file"]');
  const file = input && input.files[0];
  let storagePath = prev ? prev.storage_path : null;
  try {
    if (file) {
      if (file.size > 20 * 1048576) throw new Error('Tệp bài làm tối đa 20 MB.');
      const safe = dbSafeFileName(file.name);
      const path = DB.classId + '/' + a.id + '/' + sess.userId + '/' + Date.now() + '-' + safe;
      /* Thẻ tiến trình: hết byte → chuyển sang giai đoạn máy chủ lưu, ẩn khi xong/lỗi. */
      dbUploadShow(file.name);
      await dbCall(EducMindDB.uploadSubmissionFile(path, file, dbUploadProgress));
      dbUploadSaving();
      if (storagePath && storagePath !== path) { try { await EducMindDB.removeSubmissionFile(storagePath); } catch (_) {} }
      storagePath = path;
    }
    const hasAnswer = Object.values(answers).some((answer) => !dbAssignmentAnswerBlank(answer));
    if (!v.text && !storagePath && !hasAnswer) throw new Error('Hãy trả lời ít nhất một câu, nhập nội dung bài làm hoặc đính kèm tệp.');
    const first = dbAssignmentWindow(a) === 'OPEN' ? 'SUBMITTED' : 'LATE';
    const send = (status) => EducMindDB.submitAssignment({ assignment_id: a.id, text_content: v.text || (questions.length ? '' : null), storage_path: storagePath, file_name: file ? String(file.name).slice(0, 200) : (prev && prev.file_name) || null, status });
    let r = await send(first);
    /* Đồng hồ của máy người dùng có thể lệch vài giây so với máy chủ quanh thời điểm hết hạn: thử lại với trạng thái còn lại. */
    if (r.error && /Submission status is not valid/i.test(r.error.message || '')) r = await send(first === 'SUBMITTED' ? 'LATE' : 'SUBMITTED');
    const saved = await dbCall(Promise.resolve(r));
    if (questions.length) await dbCall(EducMindDB.saveAssignmentAnswers(questions.map((q) => ({
      submission_id: saved.id,
      question_id: q.question_id,
      answer_content: answers[q.question_id],
    }))));
  } finally {
    dbUploadHide();
  }
}, 'Đã nộp bài.');
