/* EducMind · js/db/07-assessments.js
   Bài kiểm tra: giáo viên soạn đề từ ngân hàng câu hỏi, xuất bản, xem lượt làm và chấm câu tự luận;
   học sinh xem danh sách, bắt đầu làm bài (js/db/08-exam.js) và xem lại kết quả.
   Lưu ý: Máy chủ đếm lượt, tính giờ và chấm phần trắc nghiệm. Giao diện chỉ gọi RPC và hiển thị kết quả. */

const DB_ATTEMPT = { IN_PROGRESS: ['Đang làm', 'prog'], SUBMITTED: ['Chờ chấm', 'prog'], GRADED: ['Đã chấm', 'good'] };
const dbAttemptPill = (t) => dbPill(DB_ATTEMPT[t.status][0], DB_ATTEMPT[t.status][1]);
/* Bài kiểm tra theo thời điểm hiện tại: SOON (chưa mở), OPEN, CLOSED. */
function dbAssessmentWindow(e) {
  const now = dbNow();
  return now < new Date(e.open_at).getTime() ? 'SOON' : now > new Date(e.close_at).getTime() ? 'CLOSED' : 'OPEN';
}
const dbWindowText = (e) => `Mở ${dbDateTime(e.open_at)} · đóng ${dbDateTime(e.close_at)}`;

DB_PAGES.assessments = {
  title: 'Bài kiểm tra',
  sub: () => (dbIsTeacher() ? 'Soạn đề từ ngân hàng câu hỏi; phần trắc nghiệm được chấm tự động khi học sinh nộp bài.' : 'Bài kiểm tra có giới hạn thời gian. Đồng hồ chạy liên tục từ lúc em bắt đầu.'),
  async load() {
    const content = await dbLoadContent();
    const assessments = DB.course ? await dbCall(EducMindDB.listAssessments(DB.course.id)) : [];
    const ids = assessments.map((e) => e.id);
    /* Lượt đã hết giờ mà chưa nộp được máy chủ tự nộp trước khi đọc danh sách lượt làm. */
    await EducMindDB.finalizeExpiredAttempts(dbIsTeacher() ? DB.arg.id || null : null).then(({ error }) => error && console.warn('finalize_expired_attempts:', error.message));
    const attempts = await dbCallIn(EducMindDB.listAttempts, ids);
    const out = { ...content, assessments, attempts, review: null, answers: [] };
    /* Lượt làm bù: giáo viên xem cả lớp, học sinh xem của mình (để biết số lượt còn lại). */
    out.extra = await dbCallIn(EducMindDB.listExtraAttempts, ids);
    if (DB.arg.attempt && attempts.some((t) => t.id === DB.arg.attempt && t.status !== 'IN_PROGRESS')) out.review = await dbCall(EducMindDB.reviewAttempt(DB.arg.attempt));
    if (dbIsTeacher()) {
      const [aq, questions, roster] = await Promise.all([dbCallIn(EducMindDB.listAssessmentQuestions, ids), DB.course ? dbCall(EducMindDB.listQuestions(DB.course.id)) : [], dbLoadRoster()]);
      Object.assign(out, { aq, questions, ...roster });
      if (out.review) out.answers = await dbCallIn(EducMindDB.listAnswers, [DB.arg.attempt]);
    }
    return out;
  },
  view(d) {
    const T = dbIsTeacher();
    if (T && DB.arg.edit) return dbAssessmentForm(d, DB.arg.edit === 'new' ? null : d.assessments.find((e) => e.id === DB.arg.edit));
    if (DB.arg.id) {
      const e = d.assessments.find((x) => x.id === DB.arg.id);
      if (!e) return `<section class="panel">${dbEmpty('Không tìm thấy bài kiểm tra này (có thể đã bị xóa hoặc chưa xuất bản).')}${dbBtn('Về danh sách bài kiểm tra', 'go', { page: 'assessments' }, 'light')}</section>`;
      if (DB.arg.attempt) return dbAttemptReview(d, e);
      return T ? dbAssessmentTeacherDetail(d, e) : dbAssessmentStudentDetail(d, e);
    }
    return T ? dbAssessmentTeacherList(d) : dbAssessmentStudentList(d);
  },
};

/* ===== Giáo viên: danh sách và biểu mẫu ===== */
function dbAssessmentTeacherList(d) {
  const aqBy = dbGroup(d.aq, 'assessment_id'), attBy = dbGroup(d.attempts, 'assessment_id');
  const card = (e) => {
    const qs = aqBy[e.id] || [], att = attBy[e.id] || [], waiting = att.filter((t) => t.status === 'SUBMITTED').length, pub = e.status === 'PUBLISHED';
    return `<details class="work-card">
      <summary><span class="work-detail"><b>${h(e.title)}</b> ${dbStatusPill(e.status)} <span class="pill prog">${qs.length} câu · ${dbNum(qs.reduce((s, x) => s + Number(x.weight), 0))} điểm</span>
        <div class="muted" style="margin-top:4px">${dbWindowText(e)} · ${h(e.duration_minutes)} phút · tối đa ${h(e.max_attempts)} lượt · ${att.length} lượt làm${waiting ? ` · <b>${waiting}</b> chờ chấm` : ''}${dbLessonTitle(d, e.lesson_id) ? ' · ' + dbLessonTitle(d, e.lesson_id) : ''}</div></span>
        <span class="pill plain">Mở chi tiết</span></summary>
      <div class="work-actions">${dbBtn('Soạn đề & chấm', 'go', { page: 'assessments', id: e.id }, 'light mini')}${dbBtn('Lượt làm', 'go', { page: 'assessments', id: e.id, tab: 'attempts' }, 'light mini')}${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleAssessment', { id: e.id }, pub ? 'light mini' : 'mini')}${dbBtn('Sửa', 'go', { page: 'assessments', edit: e.id }, 'light mini')}${dbBtn('Xóa', 'deleteAssessment', { id: e.id }, 'light mini danger-soft')}</div>
    </details>`;
  };
  const groups = dbScopeGroups(d, d.assessments, card);
  return dbWorkSeg('quiz')
    + `<div class="row asg-plusbar">${dbBtn(ic('plus', 16) + 'Tạo bài kiểm tra', 'go', { page: 'assessments', edit: 'new' })}</div>`
    + (groups || dbEmpty('Chưa có bài kiểm tra nào. Bấm “Tạo bài kiểm tra” để soạn đề từ Ngân hàng câu hỏi.'));
}
function dbAssessmentForm(d, e) {
  if (DB.arg.edit !== 'new' && !e) return `<section class="panel">${dbEmpty('Không tìm thấy bài kiểm tra cần sửa.')}</section>`;
  const open = e ? e.open_at : new Date(dbNow()).toISOString(), close = e ? e.close_at : new Date(dbNow() + 7 * 86400000).toISOString();
  return `<section class="panel" aria-labelledby="db-h-ef">
    <h2 id="db-h-ef">${e ? 'Sửa bài kiểm tra' : 'Tạo bài kiểm tra'}</h2>
    <p class="lead">${e ? 'Thông tin chung của bài kiểm tra. Câu hỏi được chọn ở trang chi tiết của bài.' : 'Sau khi tạo, chọn câu hỏi từ ngân hàng rồi xuất bản.'}</p>
    <form data-act="saveAssessment" data-id="${h(e ? e.id : '')}" novalidate>
      ${dbField('Tên bài kiểm tra', 'db-ef-title', `<input id="db-ef-title" name="title" maxlength="200" value="${h(e ? e.title : '')}" required>`)}
      <div class="db-form-grid">
        ${dbField('Bài học', 'db-ef-lesson', `<select id="db-ef-lesson" name="lesson_id"><option value="">Không gắn bài học</option>${d.lessons.map((l) => `<option value="${h(l.id)}" ${e && e.lesson_id === l.id ? 'selected' : ''}>${h(l.title)}</option>`).join('')}</select>`)}
        ${dbField('Thời lượng (phút)', 'db-ef-dur', `<input id="db-ef-dur" name="duration" type="number" min="1" max="600" step="1" value="${h(e ? e.duration_minutes : 15)}" required>`)}
        ${dbField('Số lượt làm tối đa', 'db-ef-att', `<input id="db-ef-att" name="attempts" type="number" min="1" max="20" step="1" value="${h(e ? e.max_attempts : 1)}" required>`)}
      </div>
      <div class="db-form-grid">
        ${dbField('Mở lúc', 'db-ef-open', `<input id="db-ef-open" name="open" type="datetime-local" value="${dbToLocalInput(open)}" required>`)}
        ${dbField('Đóng lúc', 'db-ef-close', `<input id="db-ef-close" name="close" type="datetime-local" value="${dbToLocalInput(close)}" required>`)}
      </div>
      ${dbFormError()}
      <div class="row db-form-actions">${dbBtn('Hủy', 'go', e ? { page: 'assessments', id: e.id } : { page: 'assessments' }, 'light')}<button type="submit" class="btn">${e ? 'Lưu thay đổi' : 'Tạo bài kiểm tra'}</button></div>
    </form>
  </section>`;
}
DB_ACT.saveAssessment = (form) => dbRun(form, async (v) => {
  const id = form.dataset.id;
  if (!v.title) throw new Error('Nhập tên bài kiểm tra.');
  const duration = Number(v.duration), attempts = Number(v.attempts);
  if (!Number.isInteger(duration) || duration < 1) throw new Error('Thời lượng là số phút nguyên, tối thiểu 1.');
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error('Số lượt làm là số nguyên, tối thiểu 1.');
  const open = dbFromLocalInput(v.open), close = dbFromLocalInput(v.close);
  if (!open || !close) throw new Error('Chọn thời điểm mở và đóng bài kiểm tra.');
  if (new Date(close) <= new Date(open)) throw new Error('Thời điểm đóng phải sau thời điểm mở.');
  const course = await dbEnsureCourse();
  const row = { title: v.title, lesson_id: v.lesson_id || null, duration_minutes: duration, max_attempts: attempts, open_at: open, close_at: close };
  const e = id ? await dbCall(EducMindDB.updateAssessment(id, { ...row, topic_id: null })) : await dbCall(EducMindDB.createAssessment({ ...row, course_id: course.id }));
  toast(id ? 'Đã lưu bài kiểm tra.' : 'Đã tạo bài kiểm tra (bản nháp). Hãy chọn câu hỏi.');
  await dbGo('assessments', { id: e.id });
  return false;
});
DB_ACT.toggleAssessment = (el) => dbRun(el, async () => {
  const e = DB.data.assessments.find((x) => x.id === el.dataset.id), pub = e.status === 'PUBLISHED';
  if (!pub && !DB.data.aq.some((x) => x.assessment_id === e.id)) throw new Error('Bài kiểm tra chưa có câu hỏi nên chưa xuất bản được.');
  await dbCall(EducMindDB.updateAssessment(e.id, { status: pub ? 'DRAFT' : 'PUBLISHED' }));
  toast(pub ? 'Đã gỡ xuất bản bài kiểm tra.' : 'Đã xuất bản bài kiểm tra. Học sinh trong lớp nhận được thông báo.');
});
DB_ACT.deleteAssessment = (el) => {
  const e = DB.data.assessments.find((x) => x.id === el.dataset.id);
  dbConfirm('Xóa bài kiểm tra?', `Bài kiểm tra “${h(e.title)}” sẽ bị ẩn khỏi lớp. Các lượt làm và điểm đã có vẫn được giữ trong cơ sở dữ liệu.`, 'Xóa bài kiểm tra', async () => {
    await dbCall(EducMindDB.updateAssessment(e.id, { deleted_at: new Date().toISOString() }));
    toast('Đã xóa bài kiểm tra.');
    if (DB.arg.id) { await dbGo('assessments', {}); return false; }
  }, true);
};

/* ===== Giáo viên: chi tiết (soạn đề, lượt làm) ===== */
function dbAssessmentTeacherDetail(d, e) {
  const tab = DB.arg.tab === 'attempts' ? 'attempts' : 'questions';
  const aq = d.aq.filter((x) => x.assessment_id === e.id), att = d.attempts.filter((t) => t.assessment_id === e.id), pub = e.status === 'PUBLISHED';
  const total = aq.reduce((s, x) => s + Number(x.weight), 0);
  return `<section class="panel" aria-labelledby="db-h-ed">
    <div class="row between"><div><h2 id="db-h-ed">${h(e.title)}</h2><p class="lead">${dbStatusPill(e.status)} · ${dbWindowText(e)}</p></div>
      <div class="row">${dbBtn('Về danh sách', 'go', { page: 'assessments' }, 'light')}${dbBtn('Sửa thông tin', 'go', { page: 'assessments', edit: e.id }, 'light')}${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleAssessment', { id: e.id }, pub ? 'light' : '')}</div></div>
    <div class="facts">
      <div><span>Thời lượng</span><b>${h(e.duration_minutes)} phút</b></div><div><span>Số lượt tối đa</span><b>${h(e.max_attempts)}</b></div>
      <div><span>Đề</span><b>${aq.length} câu · ${dbNum(total)} điểm</b></div><div><span>Bài học</span><b>${dbLessonTitle(d, e.lesson_id) || '—'}</b></div>
    </div>
  </section>
  <div class="seg" role="tablist" aria-label="Phần của bài kiểm tra">
    <button type="button" role="tab" aria-selected="${tab === 'questions'}" data-act="go" data-page="assessments" data-id="${h(e.id)}">Câu hỏi (${aq.length})</button>
    <button type="button" role="tab" aria-selected="${tab === 'attempts'}" data-act="go" data-page="assessments" data-id="${h(e.id)}" data-tab="attempts">Lượt làm (${att.length})</button>
  </div>
  ${tab === 'questions' ? dbAssessmentQuestionsTab(d, e, aq, att.length > 0) : dbAssessmentAttemptsTab(d, e, att, total)}`;
}
function dbAssessmentQuestionsTab(d, e, aq, locked) {
  const qById = dbById(d.questions), used = new Set(aq.map((x) => x.question_id));
  const rows = aq.map((x, i) => {
    const q = qById[x.question_id];
    return `<tr>
      <td>${i + 1}</td>
      <th scope="row"><div class="db-qtext">${q ? h(q.content) : '<span class="muted">(Câu hỏi đã bị xóa khỏi ngân hàng)</span>'}</div>${q ? `<div class="muted">${h(DB_QKIND[q.kind])} · Đáp án: ${h(dbAnswerKeyText(q))}</div>` : ''}</th>
      <td><label class="sr" for="db-w-${h(x.question_id)}">Điểm của câu ${i + 1}</label><input id="db-w-${h(x.question_id)}" class="db-input-score" type="number" min="0.25" step="0.25" value="${h(x.weight)}" data-change="setQuestionWeight" data-q="${h(x.question_id)}" ${locked ? 'disabled' : ''}></td>
      <td class="db-cell-actions">${dbBtn('Lên', 'moveQuestion', { q: x.question_id, dir: -1 }, 'light mini' + (i === 0 ? ' db-off' : ''))}${dbBtn('Xuống', 'moveQuestion', { q: x.question_id, dir: 1 }, 'light mini' + (i === aq.length - 1 ? ' db-off' : ''))}${locked ? '' : dbBtn('Gỡ', 'removeQuestion', { q: x.question_id }, 'light mini danger-soft')}</td>
    </tr>`;
  });
  const bank = d.questions.filter((q) => !used.has(q.id));
  const picker = locked
    ? `<div class="notice">${ic('lock', 16)}<div>Đã có học sinh làm bài nên danh sách câu hỏi và điểm từng câu bị khóa để các lượt làm so sánh được với nhau. Vẫn đổi được thứ tự câu hỏi.</div></div>`
    : bank.length
      ? `<form data-act="addQuestions" novalidate>
          <div class="db-objpick">${bank.map((q) => `<label class="objrow"><input type="checkbox" name="pick" data-multi value="${h(q.id)}"><span><span class="db-qtext">${h(q.content)}</span><span class="muted"> · ${h(DB_QKIND[q.kind])} · ${h(DB_QDIFF[q.difficulty] || q.difficulty)}</span></span></label>`).join('')}</div>
          <div class="db-form-row">${dbField('Điểm mỗi câu', 'db-add-weight', `<input id="db-add-weight" name="weight" type="number" min="0.25" step="0.25" value="1" class="db-input-score">`)}<button type="submit" class="btn">Thêm câu đã chọn vào đề</button></div>${dbFormError()}
        </form>`
      : dbEmpty(d.questions.length ? 'Mọi câu hỏi trong ngân hàng đã có trong đề.' : 'Ngân hàng câu hỏi còn trống.') + `<div class="row db-form-actions">${dbBtn('Mở ngân hàng câu hỏi', 'go', { page: 'questions' }, 'light')}</div>`;
  return `<section class="panel" aria-labelledby="db-h-eq"><h2 id="db-h-eq">Câu hỏi trong đề</h2>
    ${rows.length ? dbTable(['#', 'Câu hỏi', 'Điểm', '<span class="sr">Thao tác</span>'], rows, 'Câu hỏi trong đề') : dbEmpty('Đề chưa có câu hỏi.')}
  </section>
  <section class="panel" aria-labelledby="db-h-eb"><h2 id="db-h-eb">Thêm câu hỏi từ ngân hàng</h2>${picker}</section>`;
}
DB_ACT.addQuestions = (form) => dbRun(form, async (v) => {
  const picks = v.pick || [], weight = Number(v.weight);
  if (!picks.length) throw new Error('Chọn ít nhất một câu hỏi.');
  if (!(weight > 0)) throw new Error('Điểm mỗi câu phải lớn hơn 0.');
  const start = dbNextOrder(DB.data.aq.filter((x) => x.assessment_id === DB.arg.id));
  await dbCall(EducMindDB.addAssessmentQuestions(picks.map((q, i) => ({ assessment_id: DB.arg.id, question_id: q, weight, display_order: start + i }))));
}, 'Đã thêm câu hỏi vào đề.');
DB_ACT.setQuestionWeight = (el) => dbRun(el, async () => {
  const w = Number(String(el.value).replace(',', '.'));
  if (!(w > 0)) throw new Error('Điểm của câu phải lớn hơn 0.');
  const r = await dbCall(EducMindDB.updateAssessmentQuestion(DB.arg.id, el.dataset.q, { weight: w }));
  if (!r.length) throw new Error('Không đổi được điểm của câu này.');
}, 'Đã đổi điểm của câu.');
DB_ACT.removeQuestion = (el) => dbRun(el, async () => {
  const r = await dbCall(EducMindDB.removeAssessmentQuestion(DB.arg.id, el.dataset.q));
  if (!r.length) throw new Error('Không gỡ được câu hỏi này.');
}, 'Đã gỡ câu hỏi khỏi đề.');
DB_ACT.moveQuestion = (el) => dbRun(el, async () => {
  const list = DB.data.aq.filter((x) => x.assessment_id === DB.arg.id), i = list.findIndex((x) => x.question_id === el.dataset.q), j = i + Number(el.dataset.dir);
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  /* Ghi lại thứ tự 1..n cho những câu có số thứ tự thay đổi. */
  for (let k = 0; k < list.length; k++) if (list[k].display_order !== k + 1) await dbCall(EducMindDB.updateAssessmentQuestion(DB.arg.id, list[k].question_id, { display_order: k + 1 }));
});
function dbAssessmentAttemptsTab(d, e, att, total) {
  const rows = att.map((t) => `<tr>
      <th scope="row">${h(dbName(d.profiles[t.student_id]))}</th>
      <td>Lượt ${h(t.attempt_number)}</td>
      <td>${dbAttemptPill(t)}</td>
      <td>${t.total_score == null ? '<span class="muted">—</span>' : `<b>${dbNum(t.total_score)}</b> / ${dbNum(total)}`}</td>
      <td>${t.submitted_at ? dbDateTime(t.submitted_at) : '<span class="muted">Bắt đầu ' + dbDateTime(t.started_at) + '</span>'}</td>
      <td class="db-cell-actions">${t.status === 'IN_PROGRESS' ? '' : dbBtn(t.status === 'SUBMITTED' ? 'Chấm bài' : 'Xem bài làm', 'go', { page: 'assessments', id: e.id, attempt: t.id }, t.status === 'SUBMITTED' ? 'mini' : 'light mini')}</td>
    </tr>`);
  /* Lượt làm bù: mỗi học sinh có thể được cấp thêm số lượt ngoài max_attempts của bài. */
  const extraBy = {};
  (d.extra || []).filter((x) => x.assessment_id === e.id).forEach((x) => { extraBy[x.student_id] = x; });
  const usedBy = dbGroup(att, 'student_id');
  const extraRows = (d.members || []).map((m) => {
    const ex = extraBy[m.student_id] || {}, used = (usedBy[m.student_id] || []).length;
    return `<tr><th scope="row">${h(dbName(d.profiles[m.student_id]))}</th>
      <td>${used}/${h(e.max_attempts)}${ex.extra ? ' + ' + ex.extra + ' bù' : ''}</td>
      <td>${ex.extra ? h(ex.reason || '') : '<span class="muted">—</span>'}</td>
      <td class="db-cell-actions">${dbBtn(ex.extra ? 'Cấp thêm' : 'Thêm lượt', 'grantExtra', { id: e.id, stu: m.student_id, name: dbName(d.profiles[m.student_id]) }, 'light mini')}</td></tr>`;
  });
  return `<section class="panel" aria-labelledby="db-h-ea">
    <div class="row between"><div><h2 id="db-h-ea">Lượt làm của học sinh</h2><p class="lead">Điểm chính thức của mỗi học sinh là lượt đã chấm có điểm cao nhất.</p></div>${att.length ? dbBtn('Chấm lại phần trắc nghiệm', 'regradeAssessment', { id: e.id }, 'light') : ''}</div>
    ${rows.length ? dbTable(['Học sinh', 'Lượt', 'Trạng thái', 'Điểm', 'Nộp lúc', '<span class="sr">Thao tác</span>'], rows, 'Lượt làm của học sinh') : dbEmpty('Chưa có học sinh nào làm bài.')}
  </section>
  <section class="panel" aria-labelledby="db-h-eb2">
    <h2 id="db-h-eb2">Thêm lượt làm bù</h2>
    <p class="lead">Cấp thêm lượt làm ngoài số lượt tối đa của bài (ví dụ khi học sinh bị lỗi kỹ thuật hoặc được phép làm lại).</p>
    ${extraRows.length ? dbTable(['Học sinh', 'Đã làm / tối đa', 'Lý do lượt bù', '<span class="sr">Thao tác</span>'], extraRows, 'Lượt làm bù của học sinh') : dbEmpty('Lớp chưa có học sinh.')}
  </section>`;
}
/* Cấp thêm lượt làm bù cho một học sinh (cộng dồn nếu đã có). */
DB_ACT.grantExtra = (el) => {
  const name = el.dataset.name || 'học sinh';
  dbOpenDialog({
    title: 'Thêm lượt làm bù — ' + name,
    body: `<p class="muted">Số lượt bù được cộng vào số lượt tối đa của bài kiểm tra cho riêng học sinh này.</p>
      ${dbField('Số lượt bù thêm', 'db-gx-n', `<input id="db-gx-n" name="extra" type="number" min="1" max="20" step="1" value="1" required>`)}
      ${dbField('Lý do (không bắt buộc)', 'db-gx-r', `<input id="db-gx-r" name="reason" maxlength="200" placeholder="Ví dụ: Mạng bị lỗi khi làm bài">`)}`,
    okLabel: 'Cấp lượt',
    onOk: async (v) => {
      const extra = Number(v.extra);
      if (!Number.isInteger(extra) || extra < 1) throw new Error('Số lượt bù phải là số nguyên, tối thiểu 1.');
      await dbCall(EducMindDB.grantExtraAttempts(el.dataset.id, el.dataset.stu, extra, v.reason));
      toast('Đã cấp ' + extra + ' lượt làm bù cho ' + name + '.');
    },
  });
};
DB_ACT.regradeAssessment = (el) => dbConfirm('Chấm lại phần trắc nghiệm?', 'Dùng sau khi sửa đáp án của câu hỏi. Mọi lượt đã nộp được chấm lại phần trắc nghiệm theo đáp án hiện tại; điểm giáo viên đã chấm cho câu tự luận được giữ nguyên.', 'Chấm lại', async () => {
  const n = await dbCall(EducMindDB.regradeAssessment(el.dataset.id));
  toast('Đã chấm lại ' + n + ' lượt làm.');
});

/* ===== Xem một lượt làm (giáo viên chấm, học sinh xem lại) ===== */
function dbAttemptReview(d, e) {
  const T = dbIsTeacher(), t = d.attempts.find((x) => x.id === DB.arg.attempt);
  const back = dbBtn(T ? 'Về danh sách lượt làm' : 'Về bài kiểm tra', 'go', T ? { page: 'assessments', id: e.id, tab: 'attempts' } : { page: 'assessments', id: e.id }, 'light');
  if (!t || !d.review) return `<section class="panel">${dbEmpty(t && t.status === 'IN_PROGRESS' ? 'Lượt làm này chưa nộp.' : 'Không tìm thấy lượt làm này.')}${back}</section>`;
  const total = d.review.reduce((s, r) => s + Number(r.weight), 0), got = d.review.reduce((s, r) => s + Number(r.score || 0), 0);
  const ansBy = Object.fromEntries((d.answers || []).map((a) => [a.question_id, a])), qById = dbById(d.questions || []);
  const items = d.review.map((r, i) => {
    const mine = dbAnswerText(r, r.answer_content), key = T && qById[r.question_id] ? dbAnswerKeyText(qById[r.question_id]) : '', row = ansBy[r.question_id];
    const scoreHtml = r.score == null ? dbPill('Chờ giáo viên chấm', 'prog') : dbPill(`${dbNum(r.score)} / ${dbNum(r.weight)} điểm`, Number(r.score) >= Number(r.weight) ? 'good' : Number(r.score) > 0 ? 'prog' : 'need');
    return `<section class="panel db-question" aria-labelledby="db-rq-${i}">
      <div class="row between"><h2 id="db-rq-${i}">Câu ${i + 1}</h2><div class="row"><span class="muted">${h(DB_QKIND[r.kind] || r.kind)}</span>${scoreHtml}</div></div>
      <div class="db-prose">${h(r.content)}</div>
      ${Array.isArray(r.options) && r.options.length ? `<ol class="db-options" type="A">${r.options.map((o) => `<li>${h(o)}</li>`).join('')}</ol>` : ''}
      <div class="facts"><div><span>${T ? 'Câu trả lời của học sinh' : 'Câu trả lời của em'}</span><b class="db-answer">${mine ? h(mine) : '<span class="muted">Bỏ trống</span>'}</b></div>${T ? `<div><span>Đáp án</span><b class="db-answer">${h(key || '—')}</b></div>` : ''}</div>
      ${!T && r.feedback ? `<div class="db-prose"><b>Nhận xét của giáo viên:</b> ${h(r.feedback)}</div>` : ''}
      ${T && row ? `<form data-act="gradeAnswer" data-id="${h(row.id)}" data-weight="${h(r.weight)}" class="db-grade" novalidate>
          <label for="db-as-${i}">Điểm</label><input id="db-as-${i}" name="score" type="number" min="0" max="${h(r.weight)}" step="0.25" value="${h(r.score == null ? '' : r.score)}" class="db-input-score" required><span class="muted">/ ${dbNum(r.weight)}</span>
          <label class="sr" for="db-af-${i}">Nhận xét câu ${i + 1}</label><textarea id="db-af-${i}" name="feedback" rows="2" maxlength="2000" placeholder="Nhận xét (không bắt buộc)">${h(r.feedback || '')}</textarea>
          <button type="submit" class="btn mini">${r.score == null ? 'Lưu điểm' : 'Cập nhật điểm'}</button>${dbFormError()}
        </form>` : ''}
    </section>`;
  }).join('');
  return `<section class="panel" aria-labelledby="db-h-rv">
    <div class="row between"><div><h2 id="db-h-rv">${h(e.title)} · lượt ${h(t.attempt_number)}</h2><p class="lead">${T ? h(dbName(d.profiles[t.student_id])) + ' · ' : ''}${dbAttemptPill(t)} · nộp lúc ${dbDateTime(t.submitted_at)}</p></div>${back}</div>
    <div class="facts"><div><span>${t.status === 'GRADED' ? 'Tổng điểm' : 'Điểm đã có'}</span><b>${dbNum(t.status === 'GRADED' ? t.total_score : got)} / ${dbNum(total)}</b></div><div><span>Số câu</span><b>${d.review.length}</b></div>
      ${t.status === 'SUBMITTED' ? `<div><span>Còn chờ chấm</span><b>${d.review.filter((r) => r.score == null).length} câu</b></div>` : ''}</div>
    ${!T ? `<p class="muted">Đáp án đúng không hiển thị ở đây. Câu trắc nghiệm được chấm tự động; câu trả lời ngắn và tự luận do giáo viên chấm.</p>` : ''}
  </section>${items}`;
}
DB_ACT.gradeAnswer = (form) => dbRun(form, async (v) => {
  if (v.score === '') throw new Error('Nhập điểm.');
  const score = Number(String(v.score).replace(',', '.')), weight = Number(form.dataset.weight);
  if (!Number.isFinite(score) || score < 0) throw new Error('Điểm phải là số không âm.');
  if (score > weight) throw new Error('Điểm tối đa của câu này là ' + dbNum(weight) + '.');
  await dbCall(EducMindDB.gradeAnswer(form.dataset.id, { score, feedback: v.feedback || '' }));
}, 'Đã lưu điểm của câu.');

/* ===== Học sinh: danh sách và kết quả ===== */
/* Số lượt bù của học sinh hiện tại cho một bài kiểm tra (giáo viên đã cấp thêm). */
function dbExtraOf(d, assessmentId) {
  return (d.extra || []).filter((x) => x.assessment_id === assessmentId && x.student_id === (DB.me || {}).id).reduce((s, x) => s + Number(x.extra), 0);
}
function dbAssessmentStudentList(d) {
  const attBy = dbGroup(d.attempts, 'assessment_id');
  const cards = d.assessments.map((e) => {
    const att = attBy[e.id] || [], w = dbAssessmentWindow(e), live = att.find((t) => t.status === 'IN_PROGRESS');
    const graded = att.filter((t) => t.status === 'GRADED'), best = graded.length ? Math.max(...graded.map((t) => Number(t.total_score))) : null;
    const extra = dbExtraOf(d, e.id), left = e.max_attempts + extra - att.length;
    const state = live ? dbPill('Đang làm dở', 'need') : w === 'SOON' ? dbPill('Chưa mở', 'plain') : w === 'CLOSED' ? dbPill('Đã đóng', 'plain') : left > 0 ? dbPill('Đang mở', 'good') : dbPill('Hết lượt', 'plain');
    const action = live ? dbBtn('Làm tiếp', 'startExam', { id: e.id, resume: 1 }) : w === 'OPEN' && left > 0 ? dbBtn(att.length ? 'Làm lại' : 'Bắt đầu làm bài', 'startExam', { id: e.id }) : '';
    return `<article class="db-task">
      <div class="row between"><div><button type="button" class="db-link db-task-title" data-act="go" data-page="assessments" data-id="${h(e.id)}">${h(e.title)}</button>
        <div class="muted">${[dbLessonTitle(d, e.lesson_id), dbWindowText(e), e.duration_minutes + ' phút', 'Đã dùng ' + att.length + '/' + (e.max_attempts + extra) + ' lượt' + (extra ? ' (gồm ' + extra + ' bù)' : '')].filter(Boolean).join(' · ')}</div>
        ${best != null ? `<div class="muted">Điểm cao nhất: <b>${dbNum(best)}</b></div>` : att.some((t) => t.status === 'SUBMITTED') ? `<div class="muted">Đã nộp, đang chờ giáo viên chấm.</div>` : ''}</div>
      <div class="row">${state}${action}${att.length ? dbBtn('Xem kết quả', 'go', { page: 'assessments', id: e.id }, 'light') : ''}</div></div>
    </article>`;
  }).join('');
  return `<section class="panel" aria-labelledby="db-h-se"><h2 id="db-h-se">Bài kiểm tra của lớp</h2>
    <p class="lead">${d.assessments.length} bài kiểm tra</p>${cards || dbEmpty('Chưa có bài kiểm tra nào.')}</section>`;
}
function dbAssessmentStudentDetail(d, e) {
  const att = d.attempts.filter((t) => t.assessment_id === e.id).sort((a, b) => a.attempt_number - b.attempt_number), w = dbAssessmentWindow(e);
  const extra = dbExtraOf(d, e.id), live = att.find((t) => t.status === 'IN_PROGRESS'), left = e.max_attempts + extra - att.length;
  const rows = att.map((t) => `<tr><th scope="row">Lượt ${h(t.attempt_number)}</th><td>${dbDateTime(t.started_at)}</td><td>${t.submitted_at ? dbDateTime(t.submitted_at) : '—'}</td><td>${dbAttemptPill(t)}</td>
      <td>${t.total_score == null ? '<span class="muted">—</span>' : '<b>' + dbNum(t.total_score) + '</b>'}</td>
      <td class="db-cell-actions">${t.status === 'IN_PROGRESS' ? dbBtn('Làm tiếp', 'startExam', { id: e.id, resume: 1 }, 'mini') : dbBtn('Xem bài làm', 'go', { page: 'assessments', id: e.id, attempt: t.id }, 'light mini')}</td></tr>`);
  return `<section class="panel" aria-labelledby="db-h-sx">
    <div class="row between"><div><h2 id="db-h-sx">${h(e.title)}</h2><p class="lead">${dbWindowText(e)}</p></div>
      <div class="row">${dbBtn('Về danh sách', 'go', { page: 'assessments' }, 'light')}${!live && w === 'OPEN' && left > 0 ? dbBtn(att.length ? 'Làm lại' : 'Bắt đầu làm bài', 'startExam', { id: e.id }) : ''}</div></div>
    <div class="facts"><div><span>Thời lượng</span><b>${h(e.duration_minutes)} phút</b></div><div><span>Lượt đã dùng</span><b>${att.length} / ${h(e.max_attempts + extra)}${extra ? ' (gồm ' + extra + ' bù)' : ''}</b></div>
      <div><span>Trạng thái</span><b>${w === 'SOON' ? 'Chưa mở' : w === 'CLOSED' ? 'Đã đóng' : 'Đang mở'}</b></div></div>
  </section>
  <section class="panel" aria-labelledby="db-h-sr"><h2 id="db-h-sr">Các lượt làm của em</h2>
    <p class="lead">Điểm chính thức là lượt đã chấm có điểm cao nhất.</p>
    ${rows.length ? dbTable(['Lượt', 'Bắt đầu', 'Nộp lúc', 'Trạng thái', 'Điểm', '<span class="sr">Thao tác</span>'], rows, 'Các lượt làm') : dbEmpty('Em chưa làm bài kiểm tra này.')}
  </section>`;
}
