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
  title: 'Bài tập',
  sub: () => (dbIsTeacher() ? 'Giao bài, theo dõi bài nộp và chấm điểm.' : 'Bài tập giáo viên đã giao cho lớp.'),
  async load() {
    const content = await dbLoadContent();
    const assignments = DB.course ? await dbCall(EducMindDB.listAssignments(DB.course.id)) : [];
    const ids = assignments.map((a) => a.id);
    const [links, submissions] = await Promise.all([dbCallIn(EducMindDB.listAssignmentObjectives, ids), dbCallIn(EducMindDB.listSubmissions, ids)]);
    const [criteria, rubricScores] = await Promise.all([dbCallIn(EducMindDB.listRubricCriteria, ids), dbCallIn(EducMindDB.listRubricScores, submissions.map((s) => s.id))]);
    const roster = dbIsTeacher() ? await dbLoadRoster() : { members: [], profiles: {} };
    return { ...content, assignments, links, submissions, criteria, rubricScores, ...roster };
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
function dbAssignmentTeacherList(d) {
  const subsBy = dbGroup(d.submissions, 'assignment_id'), total = d.members.length;
  const rows = d.assignments.map((a) => {
    const subs = subsBy[a.id] || [], waiting = subs.filter((s) => s.score == null).length, pub = a.status === 'PUBLISHED';
    return `<tr>
      <th scope="row"><button type="button" class="db-link" data-act="go" data-page="assignments" data-id="${h(a.id)}">${h(a.title)}</button><div class="muted">${dbLessonTitle(d, a.lesson_id) || 'Chưa gắn bài học'}</div></th>
      <td>${dbDateTime(a.due_at)}</td>
      <td>${dbStatusPill(a.status)}</td>
      <td>${subs.length}/${total} đã nộp${waiting ? ` · <b>${waiting}</b> chờ chấm` : ''}</td>
      <td class="db-cell-actions">${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleAssignment', { id: a.id }, pub ? 'light mini' : 'mini')}${dbBtn('Sửa', 'go', { page: 'assignments', edit: a.id }, 'light mini')}${dbBtn('Xóa', 'deleteAssignment', { id: a.id }, 'light mini danger-soft')}</td>
    </tr>`;
  });
  return `<section class="panel" aria-labelledby="db-h-asg">
    <div class="row between"><div><h2 id="db-h-asg">Bài tập của lớp</h2><p class="lead">${d.assignments.length} bài tập · bấm vào tên bài để xem bài nộp và chấm điểm.</p></div>${dbBtn(ic('plus', 16) + 'Tạo bài tập', 'go', { page: 'assignments', edit: 'new' })}</div>
    ${rows.length ? dbTable(['Bài tập', 'Hạn nộp', 'Trạng thái', 'Bài nộp', '<span class="sr">Thao tác</span>'], rows, 'Bài tập của lớp') : dbEmpty('Chưa có bài tập nào.')}
  </section>`;
}
function dbAssignmentForm(d, a) {
  if (DB.arg.edit !== 'new' && !a) return `<section class="panel">${dbEmpty('Không tìm thấy bài tập cần sửa.')}</section>`;
  const picked = new Set(a ? d.links.filter((x) => x.assignment_id === a.id).map((x) => x.objective_id) : []);
  const defDue = new Date(dbNow() + 7 * 86400000); defDue.setHours(23, 59, 0, 0);
  return `<section class="panel" aria-labelledby="db-h-af">
    <h2 id="db-h-af">${a ? 'Sửa bài tập' : 'Tạo bài tập'}</h2>
    <p class="lead">Bài tập mới ở trạng thái bản nháp; học sinh chỉ thấy sau khi xuất bản.</p>
    <form data-act="saveAssignment" data-id="${h(a ? a.id : '')}" novalidate>
      ${dbField('Tên bài tập', 'db-af-title', `<input id="db-af-title" name="title" maxlength="200" value="${h(a ? a.title : '')}" required>`)}
      ${dbField('Yêu cầu', 'db-af-desc', `<textarea id="db-af-desc" name="description" rows="5" maxlength="5000">${h(a ? a.description : '')}</textarea>`)}
      <div class="db-form-grid">
        ${dbField('Bài học', 'db-af-lesson', `<select id="db-af-lesson" name="lesson_id"><option value="">Không gắn bài học</option>${d.lessons.map((l) => `<option value="${h(l.id)}" ${a && a.lesson_id === l.id ? 'selected' : ''}>${h(l.title)}</option>`).join('')}</select>`)}
        ${dbField('Hạn nộp', 'db-af-due', `<input id="db-af-due" name="due" type="datetime-local" value="${dbToLocalInput(a ? a.due_at : defDue.toISOString())}" required>`)}
        ${dbField('Điểm tối đa', 'db-af-max', `<input id="db-af-max" name="max_score" type="number" min="0.5" step="0.5" value="${h(a ? a.max_score : 10)}" required>`)}
      </div>
      <div class="db-form-grid">
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
  toast(id ? 'Đã lưu bài tập.' : 'Đã tạo bài tập (bản nháp).');
  await dbGo('assignments', {});
  return false;
});
DB_ACT.toggleAssignment = (el) => dbRun(el, async () => {
  const a = DB.data.assignments.find((x) => x.id === el.dataset.id), pub = a.status === 'PUBLISHED';
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
function dbAssignmentTeacherDetail(d, a) {
  const subs = Object.fromEntries(d.submissions.filter((s) => s.assignment_id === a.id).map((s) => [s.student_id, s]));
  const rows = d.members.map((m) => {
    const p = d.profiles[m.student_id], s = subs[m.student_id];
    if (!s) return `<tr><th scope="row">${h(dbName(p))}</th><td>${dbPill('Chưa nộp', 'plain')}</td><td class="muted">—</td><td class="muted">—</td></tr>`;
    return `<tr>
      <th scope="row">${h(dbName(p))}<div class="muted">${dbDateTime(s.submitted_at)}${s.is_edited ? ' · đã sửa' : ''}</div></th>
      <td>${s.score != null ? dbPill('Đã chấm', 'good') : s.status === 'LATE' ? dbPill('Nộp muộn', 'need') : dbPill('Chờ chấm', 'prog')}</td>
      <td><details class="db-work"><summary>Xem bài làm</summary><div class="db-prose">${h(s.text_content || '(không có nội dung văn bản)')}</div>${s.storage_path ? `<div class="db-file"><span class="db-file-name">${ic('overview', 14)} ${h(dbSubName(s))}</span>${dbBtn('Xem trước', 'previewSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}${dbBtn('Tải tệp bài nộp', 'downloadSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}</div>` : ''}</details></td>
      <td>${dbGradeCell(d, a, p, s)}</td>
    </tr>`;
  });
  const n = Object.keys(subs).length, graded = Object.values(subs).filter((s) => s.score != null).length;
  return `<section class="panel" aria-labelledby="db-h-ad">
    <div class="row between"><div><h2 id="db-h-ad">${h(a.title)}</h2><p class="lead">${dbStatusPill(a.status)} · ${n}/${d.members.length} đã nộp · ${graded} đã chấm</p></div>
      <div class="row">${dbBtn('Về danh sách', 'go', { page: 'assignments' }, 'light')}${dbBtn('Sửa bài tập', 'go', { page: 'assignments', edit: a.id }, 'light')}</div></div>
    ${dbAssignmentFacts(d, a)}
  </section>
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
function dbAssignmentStudentDetail(d, a) {
  const s = d.submissions.find((x) => x.assignment_id === a.id), w = dbAssignmentWindow(a), graded = s && s.score != null;
  let form;
  if (graded) form = `<div class="notice">${ic('info', 16)}<div>Bài đã được chấm nên không sửa được nữa.</div></div>`;
  else if (w === 'CLOSED') form = `<div class="notice">${ic('info', 16)}<div>${s ? 'Đã hết hạn nên không sửa được bài nộp.' : 'Đã hết hạn nộp bài.'}</div></div>`;
  else form = `<form data-act="submitAssignment" data-id="${h(a.id)}" novalidate>
      ${dbField(s ? 'Bài làm của em (có thể sửa và nộp lại)' : 'Bài làm của em', 'db-sub-text', `<textarea id="db-sub-text" name="text" rows="10" maxlength="20000">${h(s ? s.text_content || '' : '')}</textarea>`, w === 'LATE' ? 'Đã quá hạn nộp: bài nộp hoặc sửa lúc này được ghi là nộp muộn.' : '')}
      <div class="field"><span class="db-label">Tệp đính kèm (không bắt buộc, tối đa 20 MB)</span>
        ${s && s.storage_path ? `<div class="db-file"><span class="db-file-name">${ic('overview', 14)} ${h(dbSubName(s))}</span>${dbBtn('Xem trước', 'previewSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}${dbBtn('Tải xuống', 'downloadSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}<span class="muted">Chọn tệp khác để thay tệp này.</span></div>` : ''}
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
    ${graded || w === 'CLOSED' ? (s ? `<div class="db-prose">${h(s.text_content || '')}</div>${s.storage_path ? `<div class="db-file"><span class="db-file-name">${ic('overview', 14)} ${h(dbSubName(s))}</span>${dbBtn('Xem trước', 'previewSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}${dbBtn('Tải xuống', 'downloadSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}</div>` : ''}` : '') : ''}${form}
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
  /* Tệp đính kèm (không bắt buộc): tải lên kho bài nộp rồi lưu đường dẫn vào bài nộp. */
  const input = form.querySelector('input[type="file"]');
  const file = input && input.files[0];
  let storagePath = prev ? prev.storage_path : null;
  if (file) {
    if (file.size > 20 * 1048576) throw new Error('Tệp bài làm tối đa 20 MB.');
    const safe = dbSafeFileName(file.name);
    const path = DB.classId + '/' + a.id + '/' + sess.userId + '/' + Date.now() + '-' + safe;
    await dbCall(EducMindDB.uploadSubmissionFile(path, file));
    if (storagePath && storagePath !== path) { try { await EducMindDB.removeSubmissionFile(storagePath); } catch (_) {} }
    storagePath = path;
  }
  if (!v.text && !storagePath) throw new Error('Nhập nội dung bài làm trước khi nộp.');
  const first = dbAssignmentWindow(a) === 'OPEN' ? 'SUBMITTED' : 'LATE';
  const send = (status) => EducMindDB.submitAssignment({ assignment_id: a.id, text_content: v.text || null, storage_path: storagePath, file_name: file ? String(file.name).slice(0, 200) : (prev && prev.file_name) || null, status });
  let r = await send(first);
  /* Đồng hồ của máy người dùng có thể lệch vài giây so với máy chủ quanh thời điểm hết hạn: thử lại với trạng thái còn lại. */
  if (r.error && /Submission status is not valid/i.test(r.error.message || '')) r = await send(first === 'SUBMITTED' ? 'LATE' : 'SUBMITTED');
  await dbCall(Promise.resolve(r));
}, 'Đã nộp bài.');
