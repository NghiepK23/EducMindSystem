/* EducMind · js/db/07-assessments.js
   Bài kiểm tra: giáo viên soạn đề từ ngân hàng câu hỏi, xuất bản, xem lượt làm và chấm câu tự luận;
   học sinh xem danh sách, bắt đầu làm bài (js/db/08-exam.js) và xem lại kết quả.
   Lưu ý: Máy chủ đếm lượt, tính giờ và chấm phần trắc nghiệm. Giao diện chỉ gọi RPC và hiển thị kết quả. */

const DB_ATTEMPT = { IN_PROGRESS: ['Đang làm', 'prog'], SUBMITTED: ['Chờ chấm', 'prog'], GRADED: ['Đã chấm', 'good'] };
const DB_ASSESSMENT_IMPORTS = new Map();
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
    const activeAssessments = DB.course ? await dbCall(EducMindDB.listAssessments(DB.course.id)) : [];
    const deletedAssessments = DB.course && !dbIsTeacher() ? await dbCall(EducMindDB.listDeletedAssessments(DB.course.id)) : [];
    const assessments = [...activeAssessments, ...deletedAssessments];
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
  const cards = d.assessments.map((e) => {
    const qs = aqBy[e.id] || [], att = attBy[e.id] || [], waiting = att.filter((t) => t.status === 'SUBMITTED').length, pub = e.status === 'PUBLISHED';
    const total = qs.reduce((s, x) => s + Number(x.weight), 0);
    return `<details class="work-card">
      <summary><div class="work-summary-head"><span class="work-detail"><b>${h(e.title)}</b></span>
        <span class="work-summary-actions"><span class="pill prog">${qs.length} câu · ${dbNum(total)} điểm</span> ${dbStatusPill(e.status)} <span class="pill plain">Mở thao tác</span></span>
      </div><div class="db-work-meta">
        <span><small>Bài học</small><b>${h(dbLessonTitle(d, e.lesson_id) || 'Chưa gắn bài học')}</b></span>
        <span><small>Mở bài</small><b>${dbDateTime(e.open_at)}</b></span>
        <span><small>Đóng bài</small><b>${dbDateTime(e.close_at)}</b></span>
        <span><small>Thời lượng · Số lượt</small><b>${h(e.duration_minutes)} phút · ${h(e.max_attempts)} lượt</b></span>
        <span><small>Lượt làm</small><b>${att.length}${waiting ? ` · ${waiting} chờ chấm` : ''}</b></span>
      </div></summary>
      <div class="work-actions">${dbBtn('Mở bài kiểm tra', 'go', { page: 'assessments', id: e.id }, 'light mini')}${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleAssessment', { id: e.id }, pub ? 'light mini' : 'mini db-work-publish')}${dbBtn('Sửa thông tin', 'go', { page: 'assessments', edit: e.id }, 'light mini')}${dbBtn('Xóa', 'deleteAssessment', { id: e.id }, 'light mini danger-soft')}</div>
    </details>`;
  });
  return `<section class="panel" aria-labelledby="db-h-ex">
    <div class="row between"><div><h2 id="db-h-ex">Bài kiểm tra của lớp</h2><p class="lead">${d.assessments.length} bài kiểm tra · mở từng thẻ để soạn đề, xem lượt làm và chấm điểm.</p></div>${dbBtn(ic('plus', 16) + 'Tạo bài kiểm tra', 'go', { page: 'assessments', edit: 'new' })}</div>
    ${cards.length ? cards.join('') : dbEmpty('Chưa có bài kiểm tra nào.')}
  </section>`;
}
function dbAssessmentSteps(e, active) {
  const steps = [
    { n: 1, title: 'Thiết lập', arg: { page: 'assessments', edit: e.id } },
    { n: 2, title: 'Câu hỏi', arg: { page: 'assessments', id: e.id } },
    { n: 3, title: 'Xem trước', arg: { page: 'assessments', id: e.id, tab: 'preview' } },
  ];
  return `<ol class="db-workflow-steps" aria-label="Các bước tạo bài kiểm tra">${steps.map((s) => `<li class="${s.n === active ? 'is-current' : s.n < active ? 'is-complete' : ''}" ${s.n === active ? 'aria-current="step"' : ''}>
    ${s.n === active || !e ? `<span><b>${s.n}</b> ${s.title}</span>` : dbBtn(`<span><b>${s.n}</b> ${s.title}</span>`, 'go', s.arg, 'light mini')}
  </li>`).join('')}</ol>`;
}
function dbAssessmentForm(d, e) {
  if (DB.arg.edit !== 'new' && !e) return `<section class="panel">${dbEmpty('Không tìm thấy bài kiểm tra cần sửa.')}</section>`;
  const locked = !!e && d.attempts.some((t) => t.assessment_id === e.id);
  const lockAttr = locked ? 'disabled' : '';
  const open = e ? e.open_at : new Date(dbNow()).toISOString(), close = e ? e.close_at : new Date(dbNow() + 7 * 86400000).toISOString();
  const minimum = !locked ? new Date(dbNow()).toISOString() : null;
  return `<section class="panel" aria-labelledby="db-h-ef">
    ${e ? dbAssessmentSteps(e, 1) : `<ol class="db-workflow-steps" aria-label="Các bước tạo bài kiểm tra"><li class="is-current" aria-current="step"><span><b>1</b> Thiết lập</span></li><li><span><b>2</b> Câu hỏi</span></li><li><span><b>3</b> Xem trước</span></li></ol>`}
    <h2 id="db-h-ef">${e ? 'Sửa bài kiểm tra' : 'Tạo bài kiểm tra'}</h2>
    <p class="lead">${e ? locked ? 'Thông tin bài kiểm tra. Các thiết lập ảnh hưởng đến lượt làm đã được khóa.' : 'Cập nhật thông tin chung. Thay đổi thời lượng hoặc thời gian đóng có thể ảnh hưởng lượt làm mới.' : 'Thiết lập thời gian và số lượt trước; bước kế tiếp cho phép kết hợp câu hỏi từ nhiều nguồn.'}</p>
    ${locked ? `<div class="notice">${ic('lock', 16)}<div>Bài đã có học sinh làm. Bài học, thời lượng, số lượt tối đa và cửa sổ mở/đóng được khóa để không làm thay đổi điều kiện của các lượt đã bắt đầu. Có thể cấp lượt làm bù riêng ở phần Lượt làm.</div></div>` : ''}
    <form class="db-assessment-settings-form" data-act="saveAssessment" data-id="${h(e ? e.id : '')}" novalidate>
      ${dbField('Tên bài kiểm tra', 'db-ef-title', `<input id="db-ef-title" name="title" maxlength="200" value="${h(e ? e.title : '')}" required>`)}
      <div class="db-form-grid db-assessment-settings-grid">
        ${dbField('Bài học', 'db-ef-lesson', `<select id="db-ef-lesson" name="lesson_id" ${lockAttr}><option value="">Không gắn bài học</option>${d.lessons.map((l) => `<option value="${h(l.id)}" ${e && e.lesson_id === l.id ? 'selected' : ''}>${h(l.title)}</option>`).join('')}</select>`)}
        ${dbField('Thời lượng mỗi lượt (phút)', 'db-ef-dur', `<input id="db-ef-dur" name="duration" type="number" min="1" max="600" step="1" value="${h(e ? e.duration_minutes : 15)}" ${lockAttr} required>`, 'Đồng hồ bắt đầu khi học sinh bắt đầu lượt làm.')}
        ${dbField('Số lượt làm tối đa', 'db-ef-att', `<input id="db-ef-att" name="attempts" type="number" min="1" max="20" step="1" value="${h(e ? e.max_attempts : 1)}" ${lockAttr} required>`, 'Có thể cấp lượt làm bù riêng cho từng học sinh sau này.')}
      </div>
      <div class="db-form-grid db-assessment-settings-grid db-assessment-time-grid">
        ${dbField('Mở lúc', 'db-ef-open', dbDatetimeField('db-ef-open', 'open', open, lockAttr, minimum))}
        ${dbField('Đóng lúc', 'db-ef-close', dbDatetimeField('db-ef-close', 'close', close, lockAttr, minimum), 'Lượt làm kết thúc theo mốc đến trước: hết thời lượng hoặc đến giờ đóng bài.')}
      </div>
      ${dbFormError()}
      <div class="row db-form-actions">${dbBtn('Hủy', 'go', e ? { page: 'assessments', id: e.id } : { page: 'assessments' }, 'light')}<button type="submit" class="btn">${e ? 'Lưu thiết lập' : 'Tạo bản nháp và tiếp tục'}</button></div>
    </form>
  </section>`;
}
DB_ACT.saveAssessment = (form) => dbRun(form, async (v) => {
  const id = form.dataset.id;
  if (!String(v.title || '').trim()) throw new Error('Nhập tên bài kiểm tra.');
  const current = id ? DB.data.assessments.find((x) => x.id === id) : null;
  const settingsLocked = !!current && DB.data.attempts.some((t) => t.assessment_id === id);
  const duration = Number(settingsLocked ? current.duration_minutes : v.duration), attempts = Number(settingsLocked ? current.max_attempts : v.attempts);
  if (!Number.isInteger(duration) || duration < 1 || duration > 600) throw new Error('Thời lượng phải là số phút nguyên từ 1 đến 600.');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) throw new Error('Số lượt làm phải là số nguyên từ 1 đến 20.');
  const open = settingsLocked ? current.open_at : dbFromLocalInput(v.open), close = settingsLocked ? current.close_at : dbFromLocalInput(v.close);
  if (!open || !close) throw new Error('Chọn thời điểm mở và đóng bài kiểm tra.');
  if (!settingsLocked) {
    const now = new Date(dbNow());
    if (new Date(open) < now) throw new Error('Thời điểm mở bài kiểm tra không được ở quá khứ.');
    if (new Date(close) < now) throw new Error('Thời điểm đóng bài kiểm tra không được ở quá khứ.');
  }
  if (new Date(close) <= new Date(open)) throw new Error('Thời điểm đóng phải sau thời điểm mở.');
  const course = await dbEnsureCourse();
  const row = { title: String(v.title).trim(), lesson_id: settingsLocked ? current.lesson_id : (v.lesson_id || null), duration_minutes: duration, max_attempts: attempts, open_at: open, close_at: close };
  const e = id ? await dbCall(EducMindDB.updateAssessment(id, { ...row, topic_id: null })) : await dbCall(EducMindDB.createAssessment({ ...row, course_id: course.id }));
  toast(id ? 'Đã lưu thiết lập bài kiểm tra.' : 'Đã tạo bản nháp. Tiếp tục thêm câu hỏi từ các nguồn bạn muốn.');
  await dbGo('assessments', { id: e.id, tab: 'questions' });
  return false;
});
DB_ACT.toggleAssessment = (el) => dbRun(el, async () => {
  const e = DB.data.assessments.find((x) => x.id === el.dataset.id), pub = e.status === 'PUBLISHED';
  if (pub) {
    const attempts = DB.data.attempts.filter((t) => t.assessment_id === e.id);
    if (attempts.length) throw new Error('Không thể gỡ xuất bản bài kiểm tra đã có lượt làm. Dữ liệu lượt làm phải được giữ nguyên.');
    await dbCall(EducMindDB.updateAssessment(e.id, { status: 'DRAFT' }));
    toast('Đã gỡ xuất bản bài kiểm tra.');
    return;
  }
  const assessmentQuestions = DB.data.aq.filter((x) => x.assessment_id === e.id);
  const issues = dbAssessmentChecks(DB.data, e, assessmentQuestions);
  if (issues.length) throw new Error('Chưa thể xuất bản: ' + issues.join(' '));
  dbConfirm('Xuất bản bài kiểm tra?', `Học sinh trong lớp sẽ thấy bài “${h(e.title)}”. Có ${assessmentQuestions.length} câu, thời lượng ${h(e.duration_minutes)} phút mỗi lượt, tối đa ${h(e.max_attempts)} lượt. Đồng hồ mỗi lượt dừng khi hết thời lượng hoặc đến giờ đóng bài, tùy mốc nào đến trước.`, 'Xuất bản', async () => {
    await dbCall(EducMindDB.updateAssessment(e.id, { status: 'PUBLISHED' }));
    toast('Đã xuất bản bài kiểm tra. Học sinh trong lớp nhận được thông báo.');
  });
  return false;
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
  const tab = ['attempts', 'preview'].includes(DB.arg.tab) ? DB.arg.tab : 'questions';
  const aq = d.aq.filter((x) => x.assessment_id === e.id), att = d.attempts.filter((t) => t.assessment_id === e.id), pub = e.status === 'PUBLISHED';
  const total = aq.reduce((s, x) => s + Number(x.weight), 0);
  return `<section class="panel db-assessment-detail" aria-labelledby="db-h-ed">
    ${dbAssessmentSteps(e, tab === 'preview' ? 3 : 2)}
    <div class="row between"><div><h2 id="db-h-ed">${h(e.title)}</h2><p class="lead">${dbStatusPill(e.status)}</p></div>
      <div class="row">${dbBtn('Về danh sách', 'go', { page: 'assessments' }, 'light')}${dbBtn('Sửa thông tin', 'go', { page: 'assessments', edit: e.id }, 'light')}${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleAssessment', { id: e.id }, pub ? 'light' : 'db-work-publish')}</div></div>
    <div class="facts db-key-facts">
      <div class="db-fact-time"><span>Mở bài</span><b>${dbDateTime(e.open_at)}</b></div><div class="db-fact-time"><span>Đóng bài</span><b>${dbDateTime(e.close_at)}</b></div>
      <div><span>Thời lượng mỗi lượt</span><b>${h(e.duration_minutes)} phút</b></div><div><span>Số lượt tối đa</span><b>${h(e.max_attempts)}</b></div>
      <div class="db-fact-score"><span>Điểm tối đa</span><b>${dbNum(total)} điểm · ${aq.length} câu</b></div><div class="db-fact-lesson"><span>Bài học</span><b>${dbLessonTitle(d, e.lesson_id) || 'Chưa gắn bài học'}</b></div>
    </div>
  </section>
  <div class="seg" role="tablist" aria-label="Phần của bài kiểm tra">
    <button type="button" role="tab" aria-selected="${tab === 'questions'}" data-act="go" data-page="assessments" data-id="${h(e.id)}">Câu hỏi (${aq.length})</button>
    <button type="button" role="tab" aria-selected="${tab === 'preview'}" data-act="go" data-page="assessments" data-id="${h(e.id)}" data-tab="preview">Xem trước</button>
    <button type="button" role="tab" aria-selected="${tab === 'attempts'}" data-act="go" data-page="assessments" data-id="${h(e.id)}" data-tab="attempts">Lượt làm (${att.length})</button>
  </div>
  ${tab === 'questions' ? dbAssessmentQuestionsTab(d, e, aq, att.length > 0) : tab === 'preview' ? dbAssessmentTeacherPreview(d, e, aq) : dbAssessmentAttemptsTab(d, e, att, total)}`;
}
function dbAssessmentChecks(d, e, aq) {
  const issues = [], byId = dbById(d.questions || []);
  if (!aq.length) issues.push('Thêm ít nhất một câu hỏi.');
  let total = 0;
  aq.forEach((item, i) => {
    const q = byId[item.question_id];
    if (!q) { issues.push(`Câu ${i + 1} không còn trong ngân hàng.`); return; }
    const weight = Number(item.weight);
    if (!dbAssessmentWeightValid(weight)) issues.push(`Câu ${i + 1} cần có điểm từ 0,25 theo bước 0,25.`);
    else total += weight;
    if (DB_QAUTO.includes(q.kind) && q.correct_answer == null) issues.push(`Câu ${i + 1} (${DB_QKIND[q.kind]}) chưa có đáp án đúng.`);
  });
  if (aq.length && !(total > 0)) issues.push('Tổng điểm của đề phải lớn hơn 0.');
  return issues;
}
function dbAssessmentWeightValid(weight) {
  return Number.isFinite(weight) && weight >= 0.25 && Math.abs(weight * 4 - Math.round(weight * 4)) < 1e-8;
}
function dbReadAssessmentWeight(value) {
  const weight = Number(String(value).replace(',', '.'));
  if (!dbAssessmentWeightValid(weight)) throw new Error('Điểm mỗi câu phải từ 0,25 và tăng theo bước 0,25.');
  return weight;
}
function dbAssessmentTeacherPreview(d, e, aq) {
  const byId = dbById(d.questions || []), issues = dbAssessmentChecks(d, e, aq);
  const questions = aq.map((item, i) => {
    const q = byId[item.question_id];
    if (!q) return `<article class="db-assessment-preview-question"><h3>Câu ${i + 1}</h3><p class="muted">Câu hỏi không còn trong ngân hàng.</p></article>`;
    const opts = Array.isArray(q.options) ? q.options : [];
    return `<article class="db-assessment-preview-question">
      <div class="row between"><h3>Câu ${i + 1}</h3><span class="pill plain">${dbNum(item.weight)} điểm · ${h(DB_QKIND[q.kind] || q.kind)}</span></div>
      <div class="db-prose">${q.kind === 'FILL_IN_BLANK' ? dbQuestionFillMarkup(q.content, q.id, null, 'preview', true) : h(q.content)}</div>
      ${opts.length ? `<ol class="db-options" type="A">${opts.map((option) => `<li>${h(option)}</li>`).join('')}</ol>` : ''}
      ${q.kind === 'MATCHING' ? dbQuestionMatchingPreview(q.options) : ''}
      <details><summary>Đáp án / cách chấm cho giáo viên</summary><p class="muted">${h(dbAnswerKeyText(q))}</p></details>
    </article>`;
  });
  return `<section class="panel db-assessment-preview" aria-labelledby="db-h-ep">
    <div class="row between"><div><h2 id="db-h-ep">Xem trước bài kiểm tra</h2><p class="lead">Kiểm tra nội dung đề trước khi học sinh nhìn thấy.</p></div>${dbBtn('Quay lại câu hỏi', 'go', { page: 'assessments', id: e.id }, 'light')}</div>
    <div class="notice">${ic('info', 16)}<div><b>${h(e.title)}</b> · ${aq.length} câu · ${dbNum(aq.reduce((s, x) => s + Number(x.weight || 0), 0))} điểm · ${h(e.duration_minutes)} phút mỗi lượt · tối đa ${h(e.max_attempts)} lượt.<br>${dbWindowText(e)}.<br>Học sinh có thể bắt đầu trước giờ đóng; lượt làm kết thúc khi hết thời lượng hoặc đến giờ đóng bài, tùy mốc nào đến trước.</div></div>
    ${issues.length ? `<div class="notice db-assessment-issues">${ic('alert', 16)}<div><b>Cần xử lý trước khi xuất bản</b><ul>${issues.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div></div>` : `<p class="db-assessment-ready">${ic('check', 16)} Đề đã qua kiểm tra cơ bản và sẵn sàng xuất bản.</p>`}
    ${questions.length ? questions.join('') : dbEmpty('Chưa có câu hỏi để xem trước. Hãy quay lại bước Câu hỏi để thêm nội dung.')}
  </section>`;
}
function dbAssessmentQuestionsTab(d, e, aq, locked) {
  const qById = dbById(d.questions), used = new Set(aq.map((x) => x.question_id));
  const rows = aq.map((x, i) => {
    const q = qById[x.question_id];
    return `<tr>
      <td>${i + 1}</td>
      <th scope="row"><div class="db-qtext">${q ? h(q.content) : '<span class="muted">(Câu hỏi đã bị xóa khỏi ngân hàng)</span>'}</div>${q ? `<div class="muted">${h(DB_QKIND[q.kind])} · Đáp án: ${h(dbAnswerKeyText(q))}</div>` : ''}</th>
      <td><label class="sr" for="db-w-${h(x.question_id)}">Điểm của câu ${i + 1}</label><input id="db-w-${h(x.question_id)}" class="db-input-score" type="number" min="0.25" step="0.25" value="${h(x.weight)}" data-change="setQuestionWeight" data-q="${h(x.question_id)}" ${locked ? 'disabled' : ''}></td>
      <td class="db-cell-actions">${locked ? '' : `${dbBtn('Lên', 'moveQuestion', { q: x.question_id, dir: -1 }, 'light mini' + (i === 0 ? ' db-off' : ''))}${dbBtn('Xuống', 'moveQuestion', { q: x.question_id, dir: 1 }, 'light mini' + (i === aq.length - 1 ? ' db-off' : ''))}${dbBtn('Gỡ', 'removeQuestion', { q: x.question_id }, 'light mini danger-soft')}`}</td>
    </tr>`;
  });
  const bank = d.questions.filter((q) => !q.deleted_at && !used.has(q.id));
  const picker = locked
    ? `<div class="notice">${ic('lock', 16)}<div>Đã có học sinh làm bài nên danh sách câu hỏi, điểm và thứ tự câu hỏi bị khóa để các lượt làm so sánh được với nhau.</div></div>`
    : bank.length
      ? `<form data-act="addQuestions" novalidate>
          <div class="db-assessment-bank-tools">
            ${dbField('Tìm câu hỏi', 'db-assessment-search', '<input id="db-assessment-search" type="search" data-input="filterAssessmentBank" placeholder="Tìm theo nội dung">')}
            ${dbField('Dạng câu', 'db-assessment-kind', `<select id="db-assessment-kind" data-change="filterAssessmentBank"><option value="">Mọi dạng</option>${Object.entries(DB_QKIND).map(([k, v]) => `<option value="${h(k)}">${h(v)}</option>`).join('')}</select>`)}
            ${dbField('Độ khó', 'db-assessment-difficulty', `<select id="db-assessment-difficulty" data-change="filterAssessmentBank"><option value="">Mọi mức độ</option>${Object.entries(DB_QDIFF).map(([k, v]) => `<option value="${h(k)}">${h(v)}</option>`).join('')}</select>`)}
          </div>
          <p class="muted db-hint" id="db-assessment-bank-count" role="status">${bank.length} câu có thể chọn.</p>
          <div class="db-objpick db-assessment-bank" id="db-assessment-question-bank">${bank.map((q) => `<label class="objrow" data-assessment-bank-item data-kind="${h(q.kind)}" data-difficulty="${h(q.difficulty || '')}" data-text="${h((q.content || '').toLocaleLowerCase())}"><input type="checkbox" name="pick" data-multi value="${h(q.id)}"><span><span class="db-qtext">${h(q.content)}</span><span class="muted"> · ${h(DB_QKIND[q.kind] || q.kind)} · ${h(DB_QDIFF[q.difficulty] || q.difficulty)}${q.grade ? ' · Khối ' + h(q.grade) : ''}</span></span></label>`).join('')}</div>
          <div class="db-form-row">${dbField('Điểm mặc định cho câu mới', 'db-add-weight', `<input id="db-add-weight" name="weight" type="number" min="0.25" step="0.25" value="1" class="db-input-score">`)}<button type="submit" class="btn">Thêm câu đã chọn vào đề</button></div>${dbFormError()}
        </form>`
      : dbEmpty(d.questions.length ? 'Mọi câu hỏi trong ngân hàng đã có trong đề.' : 'Ngân hàng câu hỏi còn trống.');
  return `<section class="panel db-assessment-author" aria-labelledby="db-h-eq">
    <div class="row between"><div><h2 id="db-h-eq">Soạn câu hỏi</h2><p class="lead">Có thể kết hợp nhiều nguồn. Các câu đã thêm sẽ nằm trong cùng một đề.</p></div><span class="pill prog">${aq.length} câu · ${dbNum(aq.reduce((s, x) => s + Number(x.weight), 0))} điểm</span></div>
    <div class="db-assessment-source-grid" role="group" aria-label="Nguồn câu hỏi">
      <button type="button" class="db-assessment-source is-active" data-act="assessmentSource" data-source="bank" aria-pressed="true"><b>Ngân hàng câu hỏi</b><span>Chọn câu có sẵn và lọc theo dạng, độ khó hoặc nội dung.</span></button>
      ${locked ? '' : `<button type="button" class="db-assessment-source" data-act="go" data-page="questions" data-edit="new" data-return_to="assessment" data-assessment_id="${h(e.id)}" data-lesson_id="${h(e.lesson_id || '')}" data-source="manual"><b>Soạn câu hỏi mới</b><span>Tạo câu hỏi thủ công; câu mới sẽ được thêm vào đề sau khi lưu.</span></button>
      <button type="button" class="db-assessment-source" data-act="assessmentSource" data-source="file" aria-pressed="false"><b>Nhập Excel / Word</b><span>Xem trước dữ liệu, rồi nhập và thêm câu hợp lệ vào đề.</span></button>
      <button type="button" class="db-assessment-source" data-act="go" data-page="ai" data-lesson_id="${h(e.lesson_id || '')}" data-return_assessment_id="${h(e.id)}" data-source="ai"><b>Tạo bằng AI</b><span>Duyệt câu AI vào ngân hàng, quay lại đây để chọn vào đề.</span></button>`}
    </div>
    <div data-assessment-source-panel="bank">
      ${locked ? `<div class="notice">${ic('lock', 16)}<div>Đã có học sinh làm bài nên không thể thêm, gỡ hoặc đổi điểm câu hỏi. Thứ tự câu vẫn có thể điều chỉnh.</div></div>` : picker}
    </div>
    ${!locked ? `<section class="db-assessment-source-panel" data-assessment-source-panel="file" hidden>
      <h3>Nhập câu hỏi từ tệp</h3><p class="muted">Câu hỏi hợp lệ sẽ được lưu vào ngân hàng và thêm vào bài kiểm tra nháp. Câu trắc nghiệm cần đáp án đúng để chấm tự động.</p>
      <form data-act="importAssessmentQuestions" data-id="${h(e.id)}" novalidate>
        <div class="db-form-grid">${dbField('Chọn tệp (.xlsx, .xls, .csv, .docx)', 'db-assessment-import-file', `<input id="db-assessment-import-file" name="file" type="file" accept=".xlsx,.xls,.csv,.docx" required>`)}${dbField('Điểm mặc định mỗi câu', 'db-assessment-import-weight', `<input id="db-assessment-import-weight" name="weight" type="number" min="0.25" step="0.25" value="1" required>`)}</div>
        <div class="row db-source-actions"><button type="button" class="btn light" onclick="impTemplate('questions')">Tải mẫu Excel</button><button type="button" class="btn light" onclick="impTemplateWord('questions')">Tải mẫu Word</button><button type="submit" class="btn">Xem trước và nhập</button></div>
        ${dbFormError()}
      </form>
    </section>` : ''}
    <section class="db-assessment-question-list" aria-labelledby="db-h-eq-selected">
      <h3 id="db-h-eq-selected">Câu hỏi trong đề</h3>
      ${rows.length ? dbTable(['#', 'Câu hỏi', 'Điểm', '<span class="sr">Thao tác</span>'], rows, 'Câu hỏi trong đề') : dbEmpty('Chưa có câu hỏi nào. Chọn một hoặc nhiều nguồn ở trên để bắt đầu.')}
    </section>
    <div class="row db-form-actions">${dbBtn('Xem trước đề', 'go', { page: 'assessments', id: e.id, tab: 'preview' }, 'light')}</div>
  </section>`;
}
DB_ACT.assessmentSource = (el) => {
  const root = el.closest('.db-assessment-author');
  if (!root) return;
  root.querySelectorAll('[data-assessment-source-panel]').forEach((panel) => { panel.hidden = panel.dataset.assessmentSourcePanel !== el.dataset.source; });
  root.querySelectorAll('.db-assessment-source[data-source]').forEach((button) => {
    const active = button.dataset.source === el.dataset.source;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
};
DB_ACT.filterAssessmentBank = () => {
  const text = (document.getElementById('db-assessment-search')?.value || '').trim().toLocaleLowerCase();
  const kind = document.getElementById('db-assessment-kind')?.value || '';
  const difficulty = document.getElementById('db-assessment-difficulty')?.value || '';
  const rows = [...document.querySelectorAll('#db-assessment-question-bank [data-assessment-bank-item]')];
  let shown = 0;
  rows.forEach((row) => {
    const visible = (!kind || row.dataset.kind === kind) && (!difficulty || row.dataset.difficulty === difficulty) && (!text || row.dataset.text.includes(text));
    row.hidden = !visible;
    if (visible) shown++;
  });
  const count = document.getElementById('db-assessment-bank-count');
  if (count) count.textContent = `Đang hiển thị ${shown}/${rows.length} câu.`;
};
DB_ACT.addQuestions = (form) => dbRun(form, async (v) => {
  const picks = [...new Set([].concat(v.pick || []).filter(Boolean))], weight = dbReadAssessmentWeight(v.weight);
  if (!picks.length) throw new Error('Chọn ít nhất một câu hỏi.');
  const selected = new Set(DB.data.questions.filter((q) => !q.deleted_at).map((q) => q.id));
  if (picks.some((id) => !selected.has(id))) throw new Error('Có câu hỏi không còn trong ngân hàng. Hãy tải lại trang rồi thử lại.');
  const start = dbNextOrder(DB.data.aq.filter((x) => x.assessment_id === DB.arg.id));
  await dbCall(EducMindDB.addAssessmentQuestions(picks.map((q, i) => ({ assessment_id: DB.arg.id, question_id: q, weight, display_order: start + i }))));
}, 'Đã thêm câu hỏi vào đề.');
DB_ACT.importAssessmentQuestions = (form) => dbRun(form, async (v) => {
  const assessmentId = form.dataset.id, assessment = DB.data.assessments.find((x) => x.id === assessmentId);
  if (!assessment || assessment.status !== 'DRAFT') throw new Error('Chỉ có thể nhập câu hỏi vào bài kiểm tra đang ở trạng thái nháp.');
  if (DB.data.attempts.some((t) => t.assessment_id === assessmentId)) throw new Error('Bài đã có lượt làm nên không thể thêm câu hỏi.');
  const file = form.querySelector('input[type="file"]')?.files?.[0];
  const weight = dbReadAssessmentWeight(v.weight);
  const result = await dbReadQuestionImport(file, assessment.lesson_id || undefined);
  dbOpenDialog({
    title: 'Xem trước câu hỏi nhập vào',
    wide: true,
    body: `<p class="muted"><b>${result.parsed.length}</b> câu hợp lệ${result.skipped.length ? ` · ${result.skipped.length} dòng sẽ bị bỏ qua` : ''} trong tệp <b>${h(file.name)}</b>.</p>
      <ol class="db-import-question-preview">${result.parsed.slice(0, 8).map((item) => `<li><b>${h(item.row.content)}</b><span>${h(DB_QKIND[item.row.kind] || item.row.kind)} · ${h(DB_QDIFF[item.row.difficulty] || item.row.difficulty)}</span></li>`).join('')}</ol>
      ${result.parsed.length > 8 ? `<p class="muted">Còn ${result.parsed.length - 8} câu khác trong tệp.</p>` : ''}
      ${result.skipped.length ? `<p class="muted db-hint">${result.skipped.slice(0, 5).map(h).join('<br>')}${result.skipped.length > 5 ? '<br>…' : ''}</p>` : ''}
      ${result.unknownCodes.length ? `<p class="muted db-hint">Không tìm thấy mã mục tiêu: ${result.unknownCodes.map(h).join(', ')}.</p>` : ''}
      ${result.ambiguousCodes.length ? `<p class="muted db-hint">Mã mục tiêu trùng giữa nhiều bài học; hãy nhập đúng tên bài học ở cột Bài học: ${result.ambiguousCodes.map(h).join(', ')}.</p>` : ''}
      ${result.unknownLessons.length ? `<p class="muted db-hint">Không tìm thấy bài học trong lớp hiện tại: ${result.unknownLessons.map(h).join(', ')}.</p>` : ''}
      ${result.ambiguousLessons.length ? `<p class="muted db-hint">Tên bài học trùng nên chưa thể phân giải: ${result.ambiguousLessons.map(h).join(', ')}.</p>` : ''}
      <p class="muted">Câu mới sẽ vào ngân hàng và được thêm vào đề với trọng số ${dbNum(weight)} điểm mỗi câu. Bạn có thể đổi điểm từng câu sau khi nhập.</p>`,
    okLabel: `Nhập và thêm ${result.parsed.length} câu`,
    onOk: async () => {
      const currentAssessment = DB.data.assessments.find((x) => x.id === assessmentId);
      if (!currentAssessment || currentAssessment.status !== 'DRAFT' || DB.data.attempts.some((t) => t.assessment_id === assessmentId)) {
        throw new Error('Bài kiểm tra đã thay đổi trạng thái. Hãy đóng hộp thoại và tải lại trang.');
      }
      const importKey = [assessmentId, file.name, file.size, file.lastModified].join('|');
      const questionIds = DB_ASSESSMENT_IMPORTS.get(importKey) || [];
      let created = questionIds.length === result.parsed.length ? questionIds.map((id) => ({ id })) : [];
      if (!created.length) {
        created = await dbCall(EducMindDB.createQuestions(result.parsed.map((x) => x.row)));
        if (created.length !== result.parsed.length) throw new Error('Máy chủ không trả đủ mã câu hỏi. Hãy tải lại trang để kiểm tra trước khi nhập lại.');
        DB_ASSESSMENT_IMPORTS.set(importKey, created.map((q) => q.id));
      }
      const existingObjectiveLinks = await dbCallIn(EducMindDB.listQuestionObjectives, created.map((q) => q.id));
      const linkedObjectives = new Set(existingObjectiveLinks.map((x) => `${x.question_id}:${x.objective_id}`));
      const objectiveLinks = result.parsed.flatMap((item, i) => item.objectiveIds.map((objective_id) => ({ question_id: created[i].id, objective_id })))
        .filter((x) => !linkedObjectives.has(`${x.question_id}:${x.objective_id}`));
      if (objectiveLinks.length) await dbCall(EducMindDB.addQuestionObjectives(objectiveLinks));
      const current = await dbCallIn(EducMindDB.listAssessmentQuestions, [assessmentId]);
      const linkedQuestionIds = new Set(current.map((x) => x.question_id));
      const unlinked = created.filter((q) => !linkedQuestionIds.has(q.id));
      let order = current.reduce((max, x) => Math.max(max, Number(x.display_order) || 0), 0);
      if (unlinked.length) await dbCall(EducMindDB.addAssessmentQuestions(unlinked.map((q) => ({
        assessment_id: assessmentId, question_id: q.id, weight, display_order: ++order,
      }))));
      DB_ASSESSMENT_IMPORTS.delete(importKey);
      toast(`Đã nhập và thêm ${created.length} câu hỏi vào đề.`);
      await dbGo('assessments', { id: assessmentId });
      return false;
    },
  });
  return false;
});
DB_ACT.setQuestionWeight = (el) => dbRun(el, async () => {
  const w = dbReadAssessmentWeight(el.value);
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
  const liveAssessments = d.assessments.filter((e) => !e.deleted_at);
  const cards = liveAssessments.map((e) => {
    const att = attBy[e.id] || [], w = dbAssessmentWindow(e), live = att.find((t) => t.status === 'IN_PROGRESS');
    const graded = att.filter((t) => t.status === 'GRADED'), best = graded.length ? Math.max(...graded.map((t) => Number(t.total_score))) : null;
    const questions = (d.aq || []).filter((x) => x.assessment_id === e.id), total = questions.reduce((s, x) => s + Number(x.weight || 0), 0);
    const extra = dbExtraOf(d, e.id), left = e.max_attempts + extra - att.length;
    const state = live ? dbPill('Đang làm dở', 'need') : w === 'SOON' ? dbPill('Chưa mở', 'plain') : w === 'CLOSED' ? dbPill('Đã đóng', 'plain') : left > 0 ? dbPill('Đang mở', 'good') : dbPill('Hết lượt', 'plain');
    const action = live ? dbBtn('Làm tiếp', 'startExam', { id: e.id, resume: 1 }) : w === 'OPEN' && left > 0 ? dbBtn(att.length ? 'Làm lại' : 'Bắt đầu làm bài', 'startExam', { id: e.id }) : '';
    return `<article class="db-task">
      <div class="row between"><div><button type="button" class="db-link db-task-title" data-act="go" data-page="assessments" data-id="${h(e.id)}">${h(e.title)}</button>
        <div class="db-work-meta">
          <span><small>Bài học</small><b>${h(dbLessonTitle(d, e.lesson_id) || 'Chưa gắn bài học')}</b></span>
          <span><small>Thời gian</small><b>${dbWindowText(e)}</b></span>
          <span><small>Thời lượng · Số lượt</small><b>${e.duration_minutes} phút · ${att.length}/${e.max_attempts + extra}${extra ? ' lượt (có lượt bù)' : ' lượt'}</b></span>
          <span><small>${best != null ? 'Điểm cao nhất' : 'Điểm tối đa'}</small><b>${best != null ? dbNum(best) : dbNum(total)} / ${dbNum(total)} điểm</b></span>
        </div>
        ${att.some((t) => t.status === 'SUBMITTED') ? `<p class="db-assessment-pending-note">Đã nộp, đang chờ giáo viên chấm.</p>` : ''}</div>
      <div class="row">${state}${action}${att.length ? dbBtn('Xem kết quả', 'go', { page: 'assessments', id: e.id }, 'light') : ''}</div></div>
    </article>`;
  }).join('');
  return `<section class="panel" aria-labelledby="db-h-se"><h2 id="db-h-se">Bài kiểm tra của lớp</h2>
    <p class="lead">${liveAssessments.length} bài kiểm tra</p>${cards || dbEmpty('Chưa có bài kiểm tra nào.')}</section>`;
}
function dbAssessmentStudentDetail(d, e) {
  const deleted = !!e.deleted_at;
  const att = d.attempts.filter((t) => t.assessment_id === e.id).sort((a, b) => a.attempt_number - b.attempt_number), w = dbAssessmentWindow(e);
  const extra = dbExtraOf(d, e.id), live = att.find((t) => t.status === 'IN_PROGRESS'), left = e.max_attempts + extra - att.length;
  const aq = (d.aq || []).filter((x) => x.assessment_id === e.id), total = aq.reduce((s, x) => s + Number(x.weight || 0), 0);
  const rows = att.map((t) => `<tr><th scope="row">Lượt ${h(t.attempt_number)}</th><td>${dbDateTime(t.started_at)}</td><td>${t.submitted_at ? dbDateTime(t.submitted_at) : '—'}</td><td>${dbAttemptPill(t)}</td>
      <td>${t.total_score == null ? '<span class="muted">—</span>' : '<b>' + dbNum(t.total_score) + '</b>'}</td>
      <td class="db-cell-actions">${t.status === 'IN_PROGRESS' ? dbBtn('Làm tiếp', 'startExam', { id: e.id, resume: 1 }, 'mini') : dbBtn('Xem bài làm', 'go', { page: 'assessments', id: e.id, attempt: t.id }, 'light mini')}</td></tr>`);
  return `<section class="panel db-student-assessment-detail" aria-labelledby="db-h-sx">
    <div class="row between"><div><h2 id="db-h-sx">${h(e.title)}</h2><p class="lead">${deleted ? 'Đã xóa mềm · chỉ đọc' : dbWindowText(e) + ' · ' + (w === 'SOON' ? 'Chưa mở' : w === 'CLOSED' ? 'Đã đóng' : 'Đang mở')}</p></div>
      <div class="row">${dbBtn('Về danh sách', 'go', { page: 'assessments' }, 'light')}${!deleted && !live && w === 'OPEN' && left > 0 ? dbBtn(att.length ? 'Làm lại' : 'Bắt đầu làm bài', 'startExam', { id: e.id }) : ''}</div></div>
    <div class="facts db-key-facts db-student-assessment-facts">
      <div class="db-fact-time"><span>Mở bài</span><b>${dbDateTime(e.open_at)}</b></div><div class="db-fact-time"><span>Đóng bài</span><b>${dbDateTime(e.close_at)}</b></div>
      <div><span>Thời lượng mỗi lượt</span><b>${h(e.duration_minutes)} phút</b></div><div><span>Lượt đã dùng</span><b>${att.length} / ${h(e.max_attempts + extra)}${extra ? ' (gồm ' + extra + ' bù)' : ''}</b></div>
      <div class="db-fact-score"><span>Điểm tối đa</span><b>${dbNum(total)} điểm · ${aq.length} câu</b></div><div class="db-fact-lesson"><span>Bài học</span><b>${dbLessonTitle(d, e.lesson_id) || 'Chưa gắn bài học'}</b></div>
    </div>
  </section>
  <section class="panel" aria-labelledby="db-h-sr"><h2 id="db-h-sr">Các lượt làm của em</h2>
    <p class="lead">Điểm chính thức là lượt đã chấm có điểm cao nhất.</p>
    ${rows.length ? dbTable(['Lượt', 'Bắt đầu', 'Nộp lúc', 'Trạng thái', 'Điểm', '<span class="sr">Thao tác</span>'], rows, 'Các lượt làm') : dbEmpty('Em chưa làm bài kiểm tra này.')}
  </section>`;
}
