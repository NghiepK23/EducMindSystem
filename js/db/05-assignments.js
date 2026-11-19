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
let DB_ASSIGNMENT_FLOW = null;
let DB_ASSIGNMENT_REVIEW = null;
let DB_ASSIGNMENT_TIMER = null;
const DB_ASSIGNMENT_GAMES = {
  RACE: { title: 'Kéo co tri thức', icon: '🪢', tag: 'Đua theo chặng', description: 'Trả lời từng câu để đưa đội em tiến gần vạch đích.' },
  SURVIVAL: { title: 'Sinh tồn tri thức', icon: '🏝️', tag: 'Khám phá bản đồ', description: 'Khám phá các trạm trên bản đồ qua từng câu hỏi.' },
  BLITZ: { title: 'Combo chớp nhoáng', icon: '⚡', tag: 'Bứt tốc với đồng hồ', description: 'Bứt tốc qua từng câu và theo dõi thời gian luyện tập.' },
};
function dbAssignmentStopTimer() {
  if (DB_ASSIGNMENT_TIMER == null) return;
  clearInterval(DB_ASSIGNMENT_TIMER);
  DB_ASSIGNMENT_TIMER = null;
}
function dbAssignmentStartTimer() {
  dbAssignmentStopTimer();
  const flow = DB_ASSIGNMENT_FLOW;
  if (!flow || !flow.started || flow.mode !== 'BLITZ') return;
  if (!Number.isFinite(flow.startedAt)) flow.startedAt = Date.now();
  const tick = () => {
    const timer = document.getElementById('db-assignment-blitz-timer');
    if (!timer || DB_ASSIGNMENT_FLOW !== flow || !flow.started) return dbAssignmentStopTimer();
    const elapsed = Math.floor((Date.now() - flow.startedAt) / 1000);
    timer.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  };
  tick();
  DB_ASSIGNMENT_TIMER = setInterval(tick, 1000);
}
function dbAssignmentModeHud(mode, total, answered, startedAt) {
  const progress = Math.round(answered / Math.max(1, total) * 100);
  const marker = Math.max(4, Math.min(96, progress));
  const track = (icon, className = '') => `<div class="db-assignment-mode-track ${className}" id="db-assignment-game-track"><span style="width:${progress}%"></span><b id="db-assignment-game-marker" style="left:${marker}%" aria-hidden="true">${icon}</b></div>`;
  if (mode === 'SURVIVAL') {
    const landmarks = ['🏝️', '🌊', '⛺', '🗺️', '🏆'].map((icon, i) => `<span class="db-assignment-survival-landmark" style="left:${i * 25}%" aria-hidden="true">${icon}</span>`).join('');
    return `<div class="db-assignment-mode-hud db-assignment-mode-hud-survival">
      <div class="db-assignment-mode-hud-copy"><b>🗺️ HÀNH TRÌNH ĐẢO</b><span id="db-assignment-game-progress-label">Đã khám phá ${answered} / ${total} trạm</span></div>
      <div class="db-assignment-survival-route"><div class="db-assignment-mode-track" id="db-assignment-game-track"><span style="width:${progress}%"></span>${landmarks}<b id="db-assignment-game-marker" style="left:${marker}%" aria-hidden="true">🛶</b></div></div>
    </div>`;
  }
  if (mode === 'BLITZ') {
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
    const time = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    return `<div class="db-assignment-mode-hud db-assignment-mode-hud-blitz">
      <div class="db-assignment-blitz-clock"><span aria-hidden="true">⏱️</span><div><time id="db-assignment-blitz-timer">${time}</time><small>THỜI GIAN LUYỆN</small></div></div>
      <div class="db-assignment-blitz-label"><b>⚡ BỨT TỐC</b><small>Không giới hạn thời gian</small></div>
      <div class="db-assignment-blitz-track" id="db-assignment-game-track"><span style="width:${progress}%"></span></div>
    </div>`;
  }
  return `<div class="db-assignment-mode-hud db-assignment-mode-hud-race">
    <div class="db-assignment-mode-hud-copy"><b>🚦 ĐƯỜNG ĐUA TRI THỨC</b><span id="db-assignment-game-progress-label">Đã hoàn thành ${answered} / ${total} chặng</span></div>
    <div class="db-assignment-race-lane"><span aria-hidden="true">🚦</span>${track('🏃', 'db-assignment-race-track')}<span aria-hidden="true">🏁</span></div>
  </div>`;
}

DB_PAGES.assignments = {
  title: 'Bài tập',
  sub: () => (dbIsTeacher() ? 'Tạo bài có câu hỏi, theo dõi bài nộp và chấm điểm.' : 'Bài tập giáo viên đã giao cho lớp.'),
  leave() { dbAssignmentStopTimer(); DB_ASSIGNMENT_FLOW = null; DB_ASSIGNMENT_REVIEW = null; },
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
    const qlinks = dbIsTeacher() ? await dbCallIn(EducMindDB.listQuestionObjectives, questions.map((q) => q.id)) : [];
    const assignmentQuestionDetails = dbIsTeacher() && DB.course ? await dbCall(EducMindDB.listAssignmentQuestionDetails(DB.course.id)) : [];
    const studentQuestions = !dbIsTeacher() && DB.arg.id ? await dbCall(EducMindDB.getAssignmentQuestions(DB.arg.id)) : [];
    return { ...content, assignments, links, submissions, criteria, rubricScores, assignmentQuestions, assignmentAnswers, questions, qlinks, assignmentQuestionDetails, studentQuestions, ...roster };  },
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
  return d.links.filter((x) => x.assignment_id === a.id).map((x) => byId[x.objective_id]).filter(Boolean)
    .sort((x, y) => String(x.code || '').localeCompare(String(y.code || ''), undefined, { numeric: true, sensitivity: 'base' }));
}

/* ===== Giáo viên ===== */
function dbAssignmentTeacherList(d) {
  const subsBy = dbGroup(d.submissions, 'assignment_id'), questionsBy = dbGroup(d.assignmentQuestions, 'assignment_id'), total = d.members.length;
  const cards = d.assignments.map((a) => {
    const subs = subsBy[a.id] || [], waiting = subs.filter((s) => s.score == null).length, pub = a.status === 'PUBLISHED';
    const questionCount = (questionsBy[a.id] || []).length;
    return `<details class="work-card">
      <summary><span class="work-detail"><b>${h(a.title)}</b> ${dbStatusPill(a.status)} <span class="pill prog">${questionCount ? questionCount + ' câu hỏi' : 'Chưa có câu hỏi'}</span>
        <div class="db-work-meta">
          <span><small>Bài học</small><b>${h(dbLessonTitle(d, a.lesson_id) || 'Chưa gắn bài học')}</b></span>
          <span><small>Hạn nộp</small><b>${dbDateTime(a.due_at)}</b></span>
          <span><small>Điểm tối đa</small><b>${dbNum(a.max_score)} điểm</b></span>
          <span><small>Bài nộp</small><b>${subs.length}/${total} đã nộp${waiting ? ` · ${waiting} chờ chấm` : ''}</b></span>
        </div>
      </span><span class="pill plain">Mở thao tác</span></summary>
      <div class="work-actions">${dbBtn('Mở bài tập', 'go', { page: 'assignments', id: a.id }, 'light mini')}${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleAssignment', { id: a.id }, pub ? 'light mini' : 'mini db-work-publish')}${dbBtn('Sửa thông tin', 'go', { page: 'assignments', edit: a.id }, 'light mini')}${dbBtn('Xóa', 'deleteAssignment', { id: a.id }, 'light mini danger-soft')}</div>
      ${a.description ? `<p class="muted">${h(a.description)}</p>` : ''}
    </details>`;
  });
  return `<section class="panel" aria-labelledby="db-h-asg">
    <div class="row between"><div><h2 id="db-h-asg">Bài tập của lớp</h2><p class="lead">${d.assignments.length} bài tập · mở từng thẻ để quản lý câu hỏi, bài nộp và điểm.</p></div>${dbBtn(ic('plus', 16) + 'Tạo bài tập', 'go', { page: 'assignments', edit: 'new' })}</div>
    ${cards.length ? cards.join('') : dbEmpty('Chưa có bài tập nào.')}
  </section>`;
}

function dbAssignmentForm(d, a) {
  if (DB.arg.edit !== 'new' && !a) return `<section class="panel">${dbEmpty('Không tìm thấy bài tập cần sửa.')}</section>`;
  const picked = new Set(a ? d.links.filter((x) => x.assignment_id === a.id).map((x) => x.objective_id) : []);
  const defDue = new Date(dbNow() + 7 * 86400000); defDue.setHours(23, 59, 0, 0);
  const linkedQuestions = new Set(a ? d.assignmentQuestions.filter((x) => x.assignment_id === a.id).map((x) => x.question_id) : []);
  const questionBank = d.questions.filter((q) => !linkedQuestions.has(q.id));
  const locked = a && d.submissions.some((s) => s.assignment_id === a.id);
  /* Bài học của từng câu hỏi = bài học chứa các mục tiêu mà câu đó gắn. Câu chưa gắn mục tiêu thì không rõ thuộc bài nào. */
  const objById = dbById(d.objectives), qlinksBy = dbGroup(d.qlinks || [], 'question_id');
  const lessonsOfQ = (qid) => [...new Set((qlinksBy[qid] || []).map((x) => objById[x.objective_id]).filter(Boolean).map((o) => o.lesson_id))];
  const initLesson = a && a.lesson_id ? a.lesson_id : '';
  const bankRows = questionBank.map((q) => { const ls = lessonsOfQ(q.id); return { q, ls, hide: !!(initLesson && ls.length && !ls.includes(initLesson)) }; });
  const shownInit = bankRows.filter((r) => !r.hide).length;
  const sourceChoices = !a ? `<fieldset class="db-create-source-fieldset">
      <legend class="db-label">Bắt đầu bằng cách nào?</legend>
      <div class="db-create-source db-create-source-compact">
        <label class="db-create-source-card"><input type="radio" name="content_source" value="BANK" checked data-change="assignmentSource"><span><b>Ngân hàng câu hỏi</b><small>Chọn câu đã có hoặc tạo thêm câu riêng.</small></span></label>
        <label class="db-create-source-card"><input type="radio" name="content_source" value="FILE" data-change="assignmentSource"><span><b>Excel hoặc Word</b><small>Tải tệp mẫu, nhập câu hỏi rồi xem lại.</small></span></label>
        <label class="db-create-source-card"><input type="radio" name="content_source" value="PLAN" data-change="assignmentSource"><span><b>Giáo án với Gemini</b><small>Tạo câu hỏi nháp để duyệt trước khi lưu.</small></span></label>
      </div>
    </fieldset>` : '';
  const fileSource = !a ? `<section class="db-assignment-source" data-assignment-source-panel="FILE" hidden>
      <h3>Nhập câu hỏi từ Excel hoặc Word</h3>
      <p class="muted">Tệp sẽ được kiểm tra trước; câu hỏi hợp lệ được lưu vào ngân hàng và thêm vào bài tập nháp.</p>
      <label class="db-label" for="db-af-file">Tệp câu hỏi (.xlsx, .xls, .csv, .docx)</label>
      <input id="db-af-file" type="file" accept=".xlsx,.xls,.csv,.docx" data-change="assignmentImportPreview" aria-label="Chọn tệp câu hỏi Excel hoặc Word">
      <div class="row db-source-actions">
        <button type="button" class="btn light" onclick="impTemplate('questions')">Tải mẫu Excel</button>
        <button type="button" class="btn light" onclick="impTemplateWord('questions')">Tải mẫu Word</button>
      </div>
      <p class="muted db-hint" id="db-af-file-preview" role="status">Chưa chọn tệp.</p>
    </section>
    <section class="db-assignment-source" data-assignment-source-panel="PLAN" hidden>
      <h3>Tạo câu hỏi nháp từ giáo án</h3>
      <p class="muted">Tạo bài tập nháp trước, sau đó Gemini đọc giáo án và đề xuất câu hỏi. Câu hỏi chỉ được thêm sau khi giáo viên duyệt.</p>
      <p class="muted">Cần lưu API key cá nhân tại Tài khoản → Quản lý API key Gemini trước khi gửi yêu cầu.</p>
      <div class="row db-source-actions">
        ${dbBtn('Tải mẫu giáo án (.txt)', 'downloadLessonPlanTemplate', {}, 'light')}
        <label class="btn light" for="db-af-plan-file">Chọn giáo án</label>
        <input id="db-af-plan-file" class="sr" type="file" accept=".docx,.txt,.md,.csv,.xlsx" data-change="assignmentPlanFilePick">
      </div>
      <p class="muted db-hint" id="db-af-plan-file-name" role="status">Chưa chọn tệp; có thể dán nội dung vào ô bên dưới.</p>
      <label class="db-label" for="db-af-plan-text">Nội dung giáo án</label>
      <textarea id="db-af-plan-text" name="source_document_text" rows="6" maxlength="10000" placeholder="I. MỤC TIÊU BÀI HỌC&#10;- Trình bày được…&#10;II. NỘI DUNG&#10;…"></textarea>
      <label class="db-check db-ai-consent"><input type="checkbox" name="source_consent"> Tôi đã kiểm tra và đồng ý gửi nội dung giáo án lên Gemini, đồng thời lưu cùng yêu cầu AI trong Supabase. Không đưa tên, thông tin cá nhân hoặc dữ liệu học sinh vào tệp.</label>
      <label class="db-label" for="db-af-plan-qty">Số câu đề xuất</label>
      <input id="db-af-plan-qty" name="source_quantity" type="number" min="1" max="20" value="5">
    </section>` : '';
  return `<section class="panel" aria-labelledby="db-h-af">
    <h2 id="db-h-af">${a ? 'Sửa bài tập' : 'Tạo bài tập'}</h2>
    <p class="lead">${a ? 'Sửa thông tin bài tập và câu hỏi. Học sinh chỉ thấy bài sau khi xuất bản.' : 'Chọn nguồn câu hỏi trước; bài tập được lưu ở trạng thái nháp để bạn kiểm tra trước khi xuất bản.'}</p>
    <form data-act="saveAssignment" data-id="${h(a ? a.id : '')}" novalidate>
      ${sourceChoices}
      ${dbField('Tên bài tập', 'db-af-title', `<input id="db-af-title" name="title" maxlength="200" value="${h(a ? a.title : '')}" required>`)}
      ${dbField('Yêu cầu / hướng dẫn (không phải câu hỏi)', 'db-af-desc', `<textarea id="db-af-desc" name="description" rows="5" maxlength="5000">${h(a ? a.description : '')}</textarea>`)}
      <div class="db-form-grid">
        ${dbField('Bài học', 'db-af-lesson', `<select id="db-af-lesson" name="lesson_id" data-change="assignmentLessonPick" data-apply><option value="">Không gắn bài học</option>${d.lessons.map((l) => `<option value="${h(l.id)}" ${a && a.lesson_id === l.id ? 'selected' : ''}>${h(l.title)}</option>`).join('')}</select>`)}
        ${dbField('Hạn nộp', 'db-af-due', `<input id="db-af-due" name="due" type="datetime-local" value="${dbToLocalInput(a ? a.due_at : defDue.toISOString())}" required>`)}
        ${dbField('Điểm tối đa', 'db-af-max', `<input id="db-af-max" name="max_score" type="number" min="0.5" step="0.5" value="${h(a ? a.max_score : 10)}" required>`)}
      </div>
      <div class="db-form-grid db-late-grid">
        <div class="field"><label class="db-check"><input type="checkbox" id="db-af-late" name="allow_late" ${a && a.allow_late ? 'checked' : ''}> Cho phép nộp muộn</label></div>
        ${dbField('Nhận bài muộn đến', 'db-af-lateclose', `<input id="db-af-lateclose" name="late_close" type="datetime-local" value="${dbToLocalInput(a ? a.late_close_at : '')}">`, 'Chỉ dùng khi cho phép nộp muộn; phải sau hạn nộp.')}
      </div>
      ${fileSource}
      <section class="panel ab-sec db-asg-bank" aria-labelledby="db-h-af-bank" ${!a ? 'data-assignment-source-panel="BANK"' : ''}>
        <div class="ab-sec-head"><div><h3 id="db-h-af-bank">Câu hỏi trong bài tập</h3><p class="lead">Chọn một hoặc nhiều câu từ ngân hàng; dạng câu hỏi và đáp án sẽ được giữ nguyên.</p></div><span class="ab-sum">${linkedQuestions.size} đã thêm · ${questionBank.length} có thể chọn</span></div>
        ${locked ? `<div class="notice">${ic('lock', 16)}<div>Bài đã có học sinh nộp nên không thể thay đổi danh sách câu hỏi.</div></div>` : questionBank.length ? `<details class="db-bankfold" open>
          <summary><span class="db-bankfold-title">Ngân hàng câu hỏi</span><span class="pill plain db-bankfold-count">0 câu được chọn</span><span class="db-bankfold-hint"><span class="when-open">Thu gọn</span><span class="when-closed">Mở rộng</span></span></summary>
          <div class="ab-tools">
            <div class="selectbox"><label for="db-af-q-lesson">Lọc theo bài học</label><select id="db-af-q-lesson" data-change="filterAssignmentBank"><option value="">Mọi bài học</option>${d.lessons.map((l) => `<option value="${h(l.id)}" ${initLesson === l.id ? 'selected' : ''}>${h(l.title)}</option>`).join('')}</select></div>
            <div class="selectbox"><label for="db-af-q-kind">Lọc theo dạng</label><select id="db-af-q-kind" data-change="filterAssignmentBank"><option value="">Mọi dạng</option>${Object.entries(DB_QKIND).map(([k, v]) => `<option value="${h(k)}">${h(v)}</option>`).join('')}</select></div>
            <div class="selectbox"><label for="db-af-q-search">Tìm trong ngân hàng</label><input id="db-af-q-search" type="search" data-input="filterAssignmentBank" placeholder="Nội dung câu hỏi"></div>
          </div>
          <p class="muted db-hint" id="db-af-q-shown" role="status">Đang hiển thị ${shownInit}/${questionBank.length} câu. Câu chưa gắn mục tiêu luôn được hiển thị.</p>
          <div class="ab-bank" id="db-af-question-bank">${bankRows.map(({ q, ls, hide }) => `<label class="item qrow" data-assignment-bank-item data-qkind="${h(q.kind)}" data-qlessons="${h(ls.join(' '))}" data-qtext="${h((q.content || '').toLocaleLowerCase())}" ${hide ? 'hidden' : ''}>
            <input type="checkbox" name="pick" data-multi value="${h(q.id)}" data-change="assignmentPickCount" data-apply>
            <span><b>${h(q.content)}</b><span class="muted" style="display:block">${h(DB_QKIND[q.kind] || q.kind)} · ${h(DB_QDIFF[q.difficulty] || q.difficulty)}${q.grade ? ' · Khối ' + h(q.grade) : ''}</span></span>
          </label>`).join('')}</div>
        </details>` : dbEmpty(d.questions.length ? 'Các câu trong ngân hàng đã được thêm vào bài tập.' : 'Ngân hàng chưa có câu hỏi. Lưu bài tập trước, sau đó tạo câu mới hoặc nhập Excel/CSV ngay trong chi tiết bài tập.')}
      </section>
      <div class="field"><span class="db-label">Mục tiêu được đánh giá qua bài tập này</span>${dbObjectivePicker(d, 'objectives', picked, null, { fold: true, open: a ? a.lesson_id : null })}</div>
      ${dbFormError()}
      <div class="row db-form-actions">${dbBtn('Hủy', 'go', { page: 'assignments' }, 'light')}<button type="submit" class="btn">${a ? 'Lưu thay đổi' : 'Tạo bài tập nháp'}</button></div>
    </form>
  </section>`;
}
DB_ACT.filterAssignmentBank = () => {
  const kind = document.getElementById('db-af-q-kind')?.value || '';
  const lesson = document.getElementById('db-af-q-lesson')?.value || '';
  const query = (document.getElementById('db-af-q-search')?.value || '').trim().toLocaleLowerCase();
  const rows = [...document.querySelectorAll('#db-af-question-bank [data-assignment-bank-item]')];
  let shown = 0;
  rows.forEach((row) => {
    const ls = (row.dataset.qlessons || '').split(' ').filter(Boolean);
    const miss = (kind && row.dataset.qkind !== kind) || (query && !row.dataset.qtext.includes(query)) || (lesson && ls.length && !ls.includes(lesson));
    row.hidden = !!miss;
    if (!miss) shown++;
  });
  const note = document.getElementById('db-af-q-shown');
  if (note) note.textContent = `Đang hiển thị ${shown}/${rows.length} câu. Câu chưa gắn mục tiêu luôn được hiển thị.`;
};
/* Đổi ô "Bài học": đồng bộ bộ lọc ngân hàng, mở nhóm mục tiêu của bài đó và thu gọn các nhóm còn lại. */
DB_ACT.assignmentLessonPick = async (el, ev) => {
  const form = el.closest('form');
  if (!form) return;
  if (ev) { const bank = form.querySelector('#db-af-q-lesson'); if (bank) bank.value = el.value; }
  if (el.value) form.querySelectorAll('.db-objgrp').forEach((g) => { g.open = g.dataset.lesson === el.value; });
  DB_ACT.filterAssignmentBank();
  const fileInput = form.querySelector('#db-af-file');
  if (fileInput && fileInput.files && fileInput.files[0]) await DB_ACT.assignmentImportPreview(fileInput);
};
DB_ACT.assignmentSource = (el) => {
  const form = el.closest('form');
  if (!form) return;
  form.querySelectorAll('[data-assignment-source-panel]').forEach((panel) => { panel.hidden = panel.dataset.assignmentSourcePanel !== el.value; });
};
DB_ACT.assignmentImportPreview = async (el) => {
  const form = el.form, preview = form && form.querySelector('#db-af-file-preview');
  const file = el.files && el.files[0];
  if (!preview) return;
  const revision = String((Number(form.dataset.importPreviewRevision) || 0) + 1);
  form.dataset.importPreviewRevision = revision;
  if (!file) { preview.textContent = 'Chưa chọn tệp.'; return; }
  const lessonId = form.querySelector('#db-af-lesson')?.value;
  preview.textContent = 'Đang đọc tệp…';
  const result = await dbReadQuestionImport(file, lessonId);
  if (form.dataset.importPreviewRevision !== revision || form.querySelector('#db-af-file')?.files?.[0] !== file) return;
  const sample = result.parsed.slice(0, 3).map((x, i) => `${i + 1}. ${x.row.content}`).join(' · ');
  const objectiveWarnings = [
    result.unknownCodes.length ? `Không nhận diện mã mục tiêu: ${result.unknownCodes.join(', ')}.` : '',
    result.ambiguousCodes.length ? `Mã mục tiêu trùng giữa nhiều bài học, hãy chọn đúng bài học để phân giải: ${result.ambiguousCodes.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
  preview.textContent = `Đọc được ${result.parsed.length} câu${result.skipped.length ? `; bỏ qua ${result.skipped.length} dòng lỗi` : ''}.${sample ? ` Ví dụ: ${sample}` : ''}${objectiveWarnings ? ' ' + objectiveWarnings : ''}`;
  form.dataset.importFileName = file.name;
  form.dataset.importFileSize = String(file.size);
  form.dataset.importFileModified = String(file.lastModified);
};
DB_ACT.assignmentPlanFilePick = async (el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) throw new Error('Tệp giáo án vượt giới hạn 20 MB.');
  const text = await objPlanFileText(file);
  if (!text.trim()) throw new Error('Không trích xuất được nội dung từ tệp giáo án.');
  if (text.length > 10000) throw new Error('Giáo án vượt giới hạn 10.000 ký tự. Hãy rút gọn phần mục tiêu và nội dung liên quan.');
  const form = el.form, textarea = form.querySelector('#db-af-plan-text');
  if (textarea) textarea.value = text;
  const name = form.querySelector('#db-af-plan-file-name');
  if (name) name.textContent = `Đã đọc ${file.name} · ${text.length} ký tự.`;
};
/* Cập nhật số mục tiêu đã chọn trên tiêu đề nhóm. */
DB_ACT.objGroupCount = (el) => {
  const g = el.closest('.db-objgrp');
  if (!g) return;
  const n = g.querySelectorAll('input[type="checkbox"]:checked').length, pill = g.querySelector('.db-objgrp-count');
  pill.textContent = n + '/' + pill.dataset.total + ' đã chọn';
  pill.classList.toggle('prog', n > 0);
  pill.classList.toggle('plain', n === 0);
  g.classList.toggle('has-picked', n > 0);
};
/* Đếm số câu đã tick trên tiêu đề khối ngân hàng. */
DB_ACT.assignmentPickCount = (el) => {
  const box = el.closest('.db-bankfold');
  if (!box) return;
  const n = box.querySelectorAll('input[name="pick"]:checked').length, pill = box.querySelector('.db-bankfold-count');
  pill.textContent = n + ' câu được chọn';
  pill.classList.toggle('prog', n > 0);
  pill.classList.toggle('plain', n === 0);
};
DB_ACT.saveAssignment = (form) => dbRun(form, async (v) => {
  const id = form.dataset.id;
  const isNewAssignment = !id || form.dataset.newFlow === '1';
  const source = isNewAssignment ? (form.dataset.contentSource || v.content_source || 'BANK') : 'BANK';
  if (!v.title) throw new Error('Nhập tên bài tập.');
  const due = dbFromLocalInput(v.due);
  if (!due) throw new Error('Chọn hạn nộp.');
  const max = Number(v.max_score);
  if (!(max > 0)) throw new Error('Điểm tối đa phải lớn hơn 0.');
  let importDraft = null, planText = '';
  if (isNewAssignment && source === 'FILE') {
    const file = form.querySelector('#db-af-file')?.files?.[0];
    if (!file) throw new Error('Chọn tệp câu hỏi Excel hoặc Word trước khi lưu.');
    importDraft = await dbReadQuestionImport(file, v.lesson_id);
  }
  if (isNewAssignment && source === 'PLAN') {
    if (!v.lesson_id) throw new Error('Chọn bài học để gắn mục tiêu cho câu hỏi do Gemini tạo.');
    if (!DB.data.objectives.some((o) => o.lesson_id === v.lesson_id)) throw new Error('Bài học này chưa có mục tiêu học tập để tạo câu hỏi.');
    planText = String(v.source_document_text || '').trim();
    const file = form.querySelector('#db-af-plan-file')?.files?.[0];
    if (file && !planText) {
      if (file.size > 20 * 1024 * 1024) throw new Error('Tệp giáo án vượt giới hạn 20 MB.');
      planText = await objPlanFileText(file);
      if (!planText.trim()) throw new Error('Không trích xuất được nội dung từ tệp giáo án.');
    }
    if (!planText) throw new Error('Tải tệp giáo án lên hoặc dán nội dung vào ô giáo án.');
    if (planText.length > 10000) throw new Error('Giáo án vượt giới hạn 10.000 ký tự. Hãy rút gọn nội dung.');
    if (!v.source_consent) throw new Error('Xác nhận đã kiểm tra và đồng ý gửi giáo án lên Gemini.');
    const quantity = Number(v.source_quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Số câu đề xuất phải từ 1 đến 20.');
  }
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
  form.dataset.id = a.id;
  if (isNewAssignment) {
    form.dataset.newFlow = '1';
    form.dataset.contentSource = source;
  }
  const questionIds = source === 'BANK' ? [...new Set([].concat(v.pick || []).filter(Boolean))] : [];
  let addedQuestions = 0;
  let imported = [];
  if (importDraft) {
    const file = form.querySelector('#db-af-file')?.files?.[0];
    const importKey = file ? [file.name, file.size, file.lastModified].join('|') : '';
    let importedIds = [];
    if (form.dataset.importKey === importKey) {
      try { importedIds = JSON.parse(form.dataset.importedQuestionIds || '[]'); } catch (_) { importedIds = []; }
    }
    if (importedIds.length === importDraft.parsed.length) imported = importedIds.map((questionId) => ({ id: questionId }));
    else {
      imported = await dbCall(EducMindDB.createQuestions(importDraft.parsed.map((x) => x.row)));
      if (imported.length !== importDraft.parsed.length) throw new Error('Máy chủ không trả đủ mã câu hỏi đã nhập; hãy tải lại trang để kiểm tra trước khi nhập lại.');
      form.dataset.importKey = importKey;
      form.dataset.importedQuestionIds = JSON.stringify(imported.map((q) => q.id));
    }
    const existingObjectiveLinks = await dbCallIn(EducMindDB.listQuestionObjectives, imported.map((q) => q.id));
    const linkedObjectives = new Set(existingObjectiveLinks.map((x) => `${x.question_id}:${x.objective_id}`));
    const objectiveLinks = importDraft.parsed.flatMap((item, i) => item.objectiveIds.map((objective_id) => ({ question_id: imported[i].id, objective_id })));
    const missingObjectiveLinks = objectiveLinks.filter((x) => !linkedObjectives.has(`${x.question_id}:${x.objective_id}`));
    if (missingObjectiveLinks.length) await dbCall(EducMindDB.addQuestionObjectives(missingObjectiveLinks));
    const links = await dbCall(EducMindDB.listAssignmentQuestions([a.id]));
    const linkedQuestions = new Set(links.map((x) => x.question_id));
    const unlinkedQuestions = imported.filter((q) => !linkedQuestions.has(q.id));
    let order = links.reduce((maxOrder, x) => Math.max(maxOrder, Number(x.display_order) || 0), 0);
    if (unlinkedQuestions.length) await dbCall(EducMindDB.addAssignmentQuestions(unlinkedQuestions.map((q) => ({ assignment_id: a.id, question_id: q.id, display_order: ++order }))));
    addedQuestions = unlinkedQuestions.length;
  }
  if (questionIds.length) {
    const available = new Set(DB.data.questions.map((q) => q.id));
    if (questionIds.some((questionId) => !available.has(questionId))) throw new Error('Một câu được chọn không còn trong ngân hàng của lớp. Hãy tải lại trang rồi thử lại.');
    const currentQuestions = await dbCall(EducMindDB.listAssignmentQuestions([a.id]));
    const used = new Set(currentQuestions.map((x) => x.question_id));
    const newQuestions = questionIds.filter((questionId) => !used.has(questionId));
    let order = currentQuestions.reduce((max, x) => Math.max(max, Number(x.display_order) || 0), 0);
    if (newQuestions.length) {
      await dbCall(EducMindDB.addAssignmentQuestions(newQuestions.map((question_id) => ({
        assignment_id: a.id,
        question_id,
        display_order: ++order,
      }))));
      addedQuestions = newQuestions.length;
    }
  }
  const current = id
    ? isNewAssignment
      ? (await dbCall(EducMindDB.listAssignmentObjectives([a.id]))).map((x) => x.objective_id)
      : DB.data.links.filter((x) => x.assignment_id === id).map((x) => x.objective_id)
    : [];
  const assignmentObjectives = new Set([].concat(v.objectives || []));
  if (importDraft) importDraft.parsed.forEach((item) => item.objectiveIds.forEach((objectiveId) => assignmentObjectives.add(objectiveId)));
  if (source === 'PLAN') {
    const lessonObjectives = DB.data.objectives.filter((o) => o.lesson_id === v.lesson_id).map((o) => o.id);
    if (!lessonObjectives.some((objectiveId) => assignmentObjectives.has(objectiveId))) {
      lessonObjectives.forEach((objectiveId) => assignmentObjectives.add(objectiveId));
    }
  }
  await dbSyncLinks(current, [...assignmentObjectives],
    (add) => dbCall(EducMindDB.addAssignmentObjectives(add.map((o) => ({ assignment_id: a.id, objective_id: o })))),
    (rem) => dbCall(EducMindDB.removeAssignmentObjectives(a.id, rem)));
  if (isNewAssignment && source === 'PLAN') {
    const params = {
      objectives: DB.data.objectives.filter((o) => o.lesson_id === v.lesson_id && assignmentObjectives.has(o.id)).map((o) => o.id),
      kind: 'AUTO', difficulty: 'AUTO', bloom: 'AUTO',
      assignment_id: a.id,
      source_document_text: planText,
    };
    if (form.dataset.aiRequestId) await dbInvokeAiRequest(form.dataset.aiRequestId);
    else await dbEnqueueAiRequest(a.lesson_id, Number(v.source_quantity), params, (requestId) => { form.dataset.aiRequestId = requestId; });
    await dbGo('ai', { source: 'plan', lesson_id: a.lesson_id, assignment_id: a.id });
    return false;
  }
  toast(id ? `Đã lưu bài tập${addedQuestions ? ' và thêm ' + addedQuestions + ' câu hỏi' : ''}.` : `Đã tạo bài tập (bản nháp)${addedQuestions ? ' và thêm ' + addedQuestions + ' câu hỏi' : ''}. Hãy hoàn thiện nội dung trước khi xuất bản.`);
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
  return `<div class="facts db-key-facts">
      <div class="db-fact-time"><span>Hạn nộp</span><b>${dbDateTime(a.due_at)}</b></div>
      <div><span>Nộp muộn</span><b>${a.allow_late ? 'Đến ' + dbDateTime(a.late_close_at) : 'Không nhận'}</b></div>
      <div class="db-fact-score"><span>Điểm tối đa</span><b>${dbNum(a.max_score)}</b></div>
      <div class="db-fact-lesson"><span>Bài học</span><b>${dbLessonTitle(d, a.lesson_id) || 'Chưa gắn bài học'}</b></div>
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
    ${rows.length ? `<details class="db-assignment-question-fold" open><summary>Danh sách câu hỏi · ${links.length} câu</summary>${dbTable(['#', 'Câu hỏi', '<span class="sr">Thao tác</span>'], rows, 'Câu hỏi trong bài tập')}</details>` : dbEmpty('Chưa có câu hỏi nào.')}
    ${picker}
    ${locked ? '' : `<form data-act="importQuestionFile" data-assignment-id="${h(a.id)}" class="db-form-row db-add-row" novalidate>
      <div class="field"><label class="db-label" for="db-asg-import-${h(a.id)}">Nhập câu hỏi từ Excel hoặc CSV</label>
        <input type="file" id="db-asg-import-${h(a.id)}" name="file" accept=".xlsx,.xls,.csv" class="db-input-file" aria-label="Chọn tệp câu hỏi Excel hoặc CSV">
        <div class="muted db-hint">Cần có cột Nội dung và Dạng; câu trắc nghiệm cần thêm Lựa chọn và Đáp án.</div>
      </div>
      <button type="submit" class="btn light">Nhập và thêm vào bài tập</button>
      ${dbFormError()}
    </form>`}
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
function dbToggleSubmission(button) {
  const row = button.closest('.db-submission-row');
  if (!row) return;
  const expand = !row.classList.contains('is-expanded');
  row.parentElement.querySelectorAll('.db-submission-row.is-expanded').forEach((openRow) => {
    openRow.classList.remove('is-expanded');
    openRow.querySelector('.db-submission-toggle').setAttribute('aria-expanded', 'false');
  });
  if (expand) {
    row.classList.add('is-expanded');
    button.setAttribute('aria-expanded', 'true');
  }
}
function dbAssignmentTeacherDetail(d, a) {
  const subs = Object.fromEntries(d.submissions.filter((s) => s.assignment_id === a.id).map((s) => [s.student_id, s]));
  const answersBySubmission = dbGroup(d.assignmentAnswers, 'submission_id');
  const rows = d.members.map((m) => {
    const p = d.profiles[m.student_id], s = subs[m.student_id];
    if (!s) return `<tr><th scope="row">${h(dbName(p))}</th><td>${dbPill('Chưa nộp', 'plain')}</td><td class="muted">—</td><td class="muted">—</td></tr>`;
    return `<tr class="db-submission-row">
      <th scope="row"><button type="button" class="db-submission-toggle" aria-expanded="false" onclick="dbToggleSubmission(this)">${h(dbName(p))}<span class="muted">${dbDateTime(s.submitted_at)}${s.is_edited ? ' · đã sửa' : ''}</span></button></th>
      <td>${s.score != null ? dbPill('Đã chấm', 'good') : s.status === 'LATE' ? dbPill('Nộp muộn', 'need') : dbPill('Chờ chấm', 'prog')}</td>
      <td><span class="db-submission-collapsed muted">Bấm tên để xem bài làm</span><div class="db-submission-expanded">${s.text_content ? `<div class="db-prose">${h(s.text_content)}</div>` : ''}${dbAssignmentAnswerReview(d, a, answersBySubmission[s.id] || [])}${s.storage_path ? `<div class="db-file"><span class="db-file-name">${ic('overview', 14)}<span class="db-file-title">${h(dbSubName(s))}</span></span><span class="row db-file-actions">${dbBtn('Xem trước', 'previewSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}${dbBtn('Tải tệp bài nộp', 'downloadSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}</span></div>` : ''}${!s.text_content && !s.storage_path && !d.assignmentQuestions.some((x) => x.assignment_id === a.id) ? '<div class="muted">(không có nội dung văn bản)</div>' : ''}</div></td>
      <td><span class="db-submission-collapsed muted">Bấm tên để chấm</span><div class="db-submission-expanded">${dbGradeCell(d, a, p, s)}</div></td>
    </tr>`;
  });
  const n = Object.keys(subs).length, graded = Object.values(subs).filter((s) => s.score != null).length;
  return `<section class="panel db-assignment-detail" aria-labelledby="db-h-ad">
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
      <div class="row between"><div><button type="button" class="db-link db-task-title" data-act="go" data-page="assignments" data-id="${h(a.id)}">${h(a.title)}</button>
        <div class="db-work-meta">
          <span><small>Bài học</small><b>${h(dbLessonTitle(d, a.lesson_id) || 'Chưa gắn bài học')}</b></span>
          <span><small>Thời hạn</small><b>${dbDueText(a)}</b></span>
          <span><small>Điểm tối đa</small><b>${dbNum(a.max_score)} điểm</b></span>
        </div></div>
      <div class="row">${dbSubmissionPill(a, mine[a.id])}${dbBtn(mine[a.id] ? 'Xem bài' : 'Làm bài', 'go', { page: 'assignments', id: a.id }, mine[a.id] ? 'light' : '')}</div></div>
    </article>`;
  return `<section class="panel" aria-labelledby="db-h-sa">
    <h2 id="db-h-sa">Bài tập được giao</h2>
    <p class="lead">${d.assignments.length} bài tập · ${todo.length} bài cần nộp</p>
    ${d.assignments.length ? d.assignments.map(card).join('') : dbEmpty('Chưa có bài tập nào được giao.')}
  </section>`;
}
function dbAssignmentStudentQuestions(d, submission, editable, presentation) {
  const questions = d.studentQuestions || [];
  if (!questions.length) return '';
  const mode = presentation && presentation.mode || 'RACE';
  const submitLabel = submission ? 'Nộp lại' : 'Nộp bài';
  const step = presentation && Number.isInteger(presentation.index) ? presentation.index : 0;
  const current = Math.max(0, Math.min(questions.length - 1, step));
  const answers = dbById((d.assignmentAnswers || []).filter((x) => submission && x.submission_id === submission.id).map((x) => ({ ...x, id: x.question_id })));
  const answered = questions.filter((q) => !dbAssignmentAnswerBlank(answers[q.question_id] && answers[q.question_id].answer_content)).length;
  const game = DB_ASSIGNMENT_GAMES[mode] || DB_ASSIGNMENT_GAMES.RACE;
  const items = questions.map((q, i) => {
    const saved = answers[q.question_id], answer = saved ? saved.answer_content : null, options = Array.isArray(q.options) ? q.options : [], name = 'db-asg-' + q.question_id;
    const hasAnswer = !dbAssignmentAnswerBlank(answer);
    let response;
    if (!editable) {
      if (q.kind === 'SINGLE_CHOICE' || q.kind === 'MULTIPLE_CHOICE') {
        const selected = new Set(answer == null || answer === '' ? [] : [].concat(answer).map(Number));
        response = options.length
          ? `<div class="db-assignment-review-options">${options.map((option, k) => `<div class="db-assignment-review-option${selected.has(k) ? ' selected' : ''}"><span class="db-assignment-review-letter">${dbLetter(k)}</span><span>${h(option)}</span>${selected.has(k) ? '<span class="db-assignment-review-selected">Đã chọn</span>' : ''}</div>`).join('')}</div>${hasAnswer ? '' : '<p class="muted db-assignment-review-unanswered">Chưa trả lời</p>'}`
          : `<p><b>Câu trả lời:</b> ${hasAnswer ? h(dbAnswerText(q, answer)) : '<span class="muted">Chưa trả lời</span>'}</p>`;
      } else if (q.kind === 'TRUE_FALSE') {
        response = `<div class="db-assignment-review-options">${[['true', 'Đúng'], ['false', 'Sai']].map(([value, label]) => {
          const selected = answer != null && String(answer) === value;
          return `<div class="db-assignment-review-option${selected ? ' selected' : ''}"><span class="db-assignment-review-letter">${selected ? '✓' : '·'}</span><span>${label}</span>${selected ? '<span class="db-assignment-review-selected">Đã chọn</span>' : ''}</div>`;
        }).join('')}</div>${hasAnswer ? '' : '<p class="muted db-assignment-review-unanswered">Chưa trả lời</p>'}`;
      } else {
        const text = saved ? dbAnswerText(q, answer) : '';
        response = `<div class="db-assignment-review-answer"><b>Câu trả lời</b><div>${text ? h(text) : '<span class="muted">Chưa trả lời</span>'}</div></div>`;
      }
    } else if (q.kind === 'SINGLE_CHOICE') {
      response = options.map((option, k) => `<label class="objrow" data-choice="${k}"><input type="radio" name="${h(name)}" value="${k}" data-change="assignmentAnswerChanged" data-assignment-answer="${h(q.question_id)}" ${answer != null && answer !== '' && Number(answer) === k ? 'checked' : ''}><span class="db-assignment-choice-letter" aria-hidden="true">${dbLetter(k)}</span><span class="db-assignment-choice-text">${h(option)}</span></label>`).join('');
    } else if (q.kind === 'MULTIPLE_CHOICE') {
      const selected = new Set(answer == null || answer === '' ? [] : [].concat(answer).map(Number));
      response = `<div class="muted db-hint">Chọn mọi đáp án đúng.</div>` + options.map((option, k) => `<label class="objrow" data-choice="${k}"><input type="checkbox" name="${h(name)}" value="${k}" data-change="assignmentAnswerChanged" data-assignment-answer="${h(q.question_id)}" ${selected.has(k) ? 'checked' : ''}><span class="db-assignment-choice-letter" aria-hidden="true">${dbLetter(k)}</span><span class="db-assignment-choice-text">${h(option)}</span></label>`).join('');
    } else if (q.kind === 'TRUE_FALSE') {
      response = [['true', 'Đúng', '✓'], ['false', 'Sai', '×']].map(([value, label, icon]) => `<label class="objrow"><input type="radio" name="${h(name)}" value="${value}" data-change="assignmentAnswerChanged" data-assignment-answer="${h(q.question_id)}" ${answer != null && String(answer) === value ? 'checked' : ''}><span class="db-assignment-choice-letter" aria-hidden="true">${icon}</span><span class="db-assignment-choice-text">${label}</span></label>`).join('');
    } else if (q.kind === 'SHORT_ANSWER') {
      response = `<label class="sr" for="${h(name)}">Câu trả lời câu ${i + 1}</label><input id="${h(name)}" type="text" maxlength="1000" value="${h(answer == null ? '' : answer)}" data-input="assignmentAnswerChanged" data-assignment-answer="${h(q.question_id)}" placeholder="Câu trả lời của em">`;
    } else {
      response = `<label class="sr" for="${h(name)}">Bài làm câu ${i + 1}</label><textarea id="${h(name)}" rows="5" maxlength="20000" data-input="assignmentAnswerChanged" data-assignment-answer="${h(q.question_id)}" placeholder="Bài làm của em">${h(answer == null ? '' : answer)}</textarea>`;
    }
    return `<fieldset class="field db-question db-assignment-game-question${hasAnswer ? ' answered' : ''}" data-game-question="${i}" tabindex="-1" ${i !== current ? 'hidden' : ''}><legend><span class="db-assignment-q-number">${String(i + 1).padStart(2, '0')}</span><span><b>Câu ${i + 1}</b><small>${h(DB_QKIND[q.kind] || q.kind)}</small></span></legend><div class="db-prose">${h(q.content)}</div><div class="db-answers">${response}</div></fieldset>`;
  }).join('');
  const progress = Math.round(answered / questions.length * 100);
  const progressHeader = `<div class="db-assignment-game-progress">
    <div class="db-assignment-game-progress-head">
      <div class="db-assignment-game-progress-mode"><span aria-hidden="true">${editable ? game.icon : '📖'}</span><div><b>${editable ? h(game.title) : 'Xem lại bài làm'}</b><small>${editable ? h(game.description) : 'Chọn câu hỏi để xem câu trả lời đã nộp.'}</small></div></div>
      <div class="db-assignment-game-progress-stats"><span class="db-assignment-game-position" id="db-assignment-game-position" aria-live="polite">Câu ${current + 1} / ${questions.length}</span><span id="db-assignment-game-answered">Đã trả lời ${answered} / ${questions.length}</span></div>
    </div>
    ${editable ? dbAssignmentModeHud(mode, questions.length, answered, presentation && presentation.startedAt) : `<div class="db-assignment-game-track"><span style="width:${progress}%"></span></div>`}
  </div>`;
  const jumpAction = editable ? 'assignmentGameJump' : 'assignmentReviewJump';
  const questionNav = questions.length > 1 ? `<div class="db-assignment-question-nav" role="group" aria-label="Đi đến câu hỏi">${questions.map((q, i) => {
    const hasAnswer = !dbAssignmentAnswerBlank(answers[q.question_id] && answers[q.question_id].answer_content);
    return `<button type="button" class="db-assignment-question-jump${i === current ? ' current' : ''}${hasAnswer ? ' answered' : ''}" data-act="${jumpAction}" data-index="${i}" data-question-index="${i}" aria-label="Câu ${i + 1}, ${hasAnswer ? 'đã trả lời' : 'chưa trả lời'}"${i === current ? ' aria-current="step"' : ''}>${i + 1}</button>`;
  }).join('')}</div>` : '';
  const stepAction = editable ? 'assignmentGameStep' : 'assignmentReviewStep';
  const nextLabel = !editable ? 'Câu tiếp theo →' : mode === 'RACE' ? 'Kéo dây →' : mode === 'SURVIVAL' ? 'Sang trạm →' : 'Bứt tốc →';
  const isLastQuestion = current === questions.length - 1;
  const nav = questions.length > 1 || editable
    ? `<div class="db-assignment-game-nav"><button type="button" class="btn light" data-act="${stepAction}" data-dir="-1" ${current === 0 ? 'disabled' : ''}>← Trước</button><span class="muted">${editable ? '<kbd>←</kbd> <kbd>→</kbd> chuyển câu · Nộp bài ở câu cuối' : '<kbd>←</kbd> <kbd>→</kbd> chuyển câu · Chọn số câu để xem nhanh.'}</span>${editable
      ? `<button type="button" class="btn" data-act="${stepAction}" data-dir="1" ${isLastQuestion ? 'hidden disabled' : ''}>${nextLabel}</button><button type="submit" class="btn db-assignment-submit-inline" ${isLastQuestion ? '' : 'hidden'}>${submitLabel}</button>`
      : `<button type="button" class="btn" data-act="${stepAction}" data-dir="1" ${isLastQuestion ? 'disabled' : ''}>${nextLabel}</button>`}</div>`
    : '';
  return `<div class="db-assignment-questions db-assignment-game" data-mode="${h(mode)}" data-editable="${editable}">
    ${progressHeader}${questionNav}
    <div class="db-assignment-game-questions">${items}</div>${nav}
  </div>`;
}
function dbAssignmentStudentGamePicker(d, a, questions, flow) {
  const selected = flow && flow.mode || 'RACE';
  const cards = Object.entries(DB_ASSIGNMENT_GAMES).map(([id, game]) => `
    <button type="button" class="db-assignment-game-choice db-assignment-game-choice-${id}${selected === id ? ' chosen' : ''}" aria-pressed="${selected === id}" data-act="assignmentPickMode" data-id="${h(a.id)}" data-mode="${id}">
      <span class="db-assignment-game-icon db-assignment-game-icon-${id}" aria-hidden="true">${game.icon}</span>
      <span class="db-assignment-game-copy"><b>${game.title}</b><small>${game.description}</small><em>${game.tag}</em></span>
      <span class="db-assignment-game-radio" aria-hidden="true">${selected === id ? '✓' : ''}</span>
    </button>`).join('');
  return `<div class="db-assignment-game-picker">
    <section class="panel db-assignment-game-picker-main" aria-labelledby="db-h-game-picker">
      <header class="db-assignment-game-hero">
        <span class="db-assignment-game-kicker">NHIỆM VỤ HỌC TẬP · ${questions.length} CÂU · ${dbNum(a.max_score)} ĐIỂM</span>
        <h2 id="db-h-game-picker">Chọn cách luyện tập</h2>
        <p>Chọn thử thách phù hợp với em. Mỗi câu trả lời đều được ghi nhận trong bài tập.</p>
      </header>
      <div class="db-assignment-game-picker-body">
        <div class="db-assignment-game-picker-heading"><div><h3>Chọn trò chơi</h3><p>Mỗi lựa chọn thay đổi cách hiển thị câu hỏi, không đổi nội dung bài tập.</p></div><span>BƯỚC 1 / 2</span></div>
        <div class="db-assignment-game-choice-list" role="group" aria-label="Chọn cách luyện tập">${cards}</div>
        <div class="db-assignment-game-picker-actions">
          ${dbBtn('Quay lại danh sách', 'go', { page: 'assignments' }, 'light')}
          <button type="button" class="btn db-assignment-game-start" data-act="assignmentGameStart" ${questions.length ? '' : 'disabled'}>Bắt đầu ${DB_ASSIGNMENT_GAMES[selected].title} ${ic('arrow', 17)}</button>
        </div>
      </div>
    </section>
  </div>`;
}
DB_ACT.assignmentPickMode = (el) => {
  const mode = el.dataset.mode;
  if (!DB_ASSIGNMENT_GAMES[mode]) return;
  dbAssignmentStopTimer();
  DB_ASSIGNMENT_FLOW = { assignmentId: el.dataset.id, mode, started: false, index: 0 };
  render();
};
DB_ACT.assignmentGameStart = () => {
  if (!DB_ASSIGNMENT_FLOW) return;
  DB_ASSIGNMENT_FLOW.started = true;
  DB_ASSIGNMENT_FLOW.index = 0;
  DB_ASSIGNMENT_FLOW.startedAt = Date.now();
  render();
  dbAssignmentStartTimer();
  document.querySelector('.db-assignment-game[data-editable="true"] [data-game-question="0"]')?.focus({ preventScroll: true });
};
function dbAssignmentShowQuestion(root, next, state, editable) {
  const questions = [...root.querySelectorAll('[data-game-question]')];
  if (!state || !Number.isInteger(next) || next < 0 || next >= questions.length) return;
  state.index = next;
  questions.forEach((question, i) => { question.hidden = i !== next; });
  root.querySelectorAll('[data-question-index]').forEach((button) => {
    const active = Number(button.dataset.questionIndex) === next;
    button.classList.toggle('current', active);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  const nav = root.querySelector('.db-assignment-question-nav');
  const jump = nav && nav.querySelector(`[data-question-index="${next}"]`);
  if (nav && jump) {
    const navRect = nav.getBoundingClientRect(), jumpRect = jump.getBoundingClientRect();
    if (jumpRect.left < navRect.left) nav.scrollLeft -= navRect.left - jumpRect.left;
    else if (jumpRect.right > navRect.right) nav.scrollLeft += jumpRect.right - navRect.right;
  }
  root.querySelectorAll('.db-assignment-game-nav [data-dir]').forEach((button) => {
    button.disabled = Number(button.dataset.dir) < 0 ? next === 0 : next === questions.length - 1;
  });
  if (editable) {
    const isLastQuestion = next === questions.length - 1;
    const nextButton = root.querySelector('.db-assignment-game-nav [data-dir="1"]');
    const submitButton = root.querySelector('.db-assignment-submit-inline');
    if (nextButton) nextButton.hidden = isLastQuestion;
    if (submitButton) submitButton.hidden = !isLastQuestion;
  }
  const position = root.querySelector('#db-assignment-game-position');
  if (position) position.textContent = `Câu ${next + 1} / ${questions.length}`;
  const question = questions[next], scroller = root.querySelector('.db-assignment-game-questions');
  if (scroller) scroller.scrollTop = 0;
  question.focus({ preventScroll: true });
}
DB_ACT.assignmentGameStep = (el) => {
  const root = el.closest('.db-assignment-game');
  if (DB_ASSIGNMENT_FLOW && root) dbAssignmentShowQuestion(root, DB_ASSIGNMENT_FLOW.index + Number(el.dataset.dir), DB_ASSIGNMENT_FLOW, true);
};
DB_ACT.assignmentGameJump = (el) => {
  const root = el.closest('.db-assignment-game');
  if (DB_ASSIGNMENT_FLOW && root) dbAssignmentShowQuestion(root, Number(el.dataset.index), DB_ASSIGNMENT_FLOW, true);
};
DB_ACT.assignmentReviewStep = (el) => {
  const root = el.closest('.db-assignment-game');
  if (DB_ASSIGNMENT_REVIEW && root) dbAssignmentShowQuestion(root, DB_ASSIGNMENT_REVIEW.index + Number(el.dataset.dir), DB_ASSIGNMENT_REVIEW, false);
};
DB_ACT.assignmentReviewJump = (el) => {
  const root = el.closest('.db-assignment-game');
  if (DB_ASSIGNMENT_REVIEW && root) dbAssignmentShowQuestion(root, Number(el.dataset.index), DB_ASSIGNMENT_REVIEW, false);
};
DB_ACT.assignmentEditSubmitted = (el) => {
  if (!DB_ASSIGNMENT_FLOW || DB_ASSIGNMENT_FLOW.assignmentId !== el.dataset.id || !DB_ASSIGNMENT_FLOW.submitted) return;
  DB_ASSIGNMENT_FLOW.submitted = false;
  DB_ASSIGNMENT_FLOW.started = true;
  DB_ASSIGNMENT_FLOW.index = 0;
  DB_ASSIGNMENT_FLOW.startedAt = Date.now();
  DB_ASSIGNMENT_REVIEW = null;
  render();
  dbAssignmentStartTimer();
  document.querySelector('.db-assignment-game[data-editable="true"] [data-game-question="0"]')?.focus({ preventScroll: true });
};
document.addEventListener('keydown', (ev) => {
  if (!dbActive() || DB.page !== 'assignments' || DB.dialog
      || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') || ev.defaultPrevented || ev.repeat || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const editable = !!(DB_ASSIGNMENT_FLOW && DB_ASSIGNMENT_FLOW.started);
  const state = editable ? DB_ASSIGNMENT_FLOW : DB_ASSIGNMENT_REVIEW;
  const root = document.querySelector(`.db-assignment-game[data-editable="${editable}"]`);
  if (!root || !state) return;
  const target = ev.target;
  if (target && target.closest && target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (target && target.closest && target.closest('a,button') && !root.contains(target)) return;
  const direction = ev.key === 'ArrowLeft' ? -1 : 1;
  const next = state.index + direction;
  const questions = root.querySelectorAll('[data-game-question]');
  if (next < 0 || next >= questions.length) return;
  ev.preventDefault();
  dbAssignmentShowQuestion(root, next, state, editable);
});
DB_ACT.assignmentAnswerChanged = (el) => {
  const form = el.closest('form'), root = form && form.querySelector('.db-assignment-game');
  if (!form || !root) return;
  const answers = dbReadAssignmentAnswers(form, DB.data.studentQuestions || []);
  const questions = DB.data.studentQuestions || [];
  const answered = Object.values(answers).filter((value) => !dbAssignmentAnswerBlank(value)).length;
  const count = root.querySelector('#db-assignment-game-answered'), track = root.querySelector('#db-assignment-game-track > span');
  if (count) count.textContent = `Đã trả lời ${answered} / ${questions.length}`;
  const progress = Math.round(answered / Math.max(1, questions.length) * 100);
  if (track) track.style.width = progress + '%';
  const marker = root.querySelector('#db-assignment-game-marker');
  if (marker) marker.style.left = Math.max(4, Math.min(96, progress)) + '%';
  const label = root.querySelector('#db-assignment-game-progress-label');
  if (label) label.textContent = root.dataset.mode === 'SURVIVAL'
    ? `Đã khám phá ${answered} / ${questions.length} trạm`
    : `Đã hoàn thành ${answered} / ${questions.length} chặng`;
  root.querySelectorAll('[data-game-question]').forEach((question, i) => {
    const q = questions[i];
    if (!q) return;
    const hasAnswer = !dbAssignmentAnswerBlank(answers[q.question_id]);
    question.classList.toggle('answered', hasAnswer);
    const jump = root.querySelector(`[data-question-index="${i}"]`);
    if (jump) {
      jump.classList.toggle('answered', hasAnswer);
      jump.setAttribute('aria-label', `Câu ${i + 1}, ${hasAnswer ? 'đã trả lời' : 'chưa trả lời'}`);
    }
  });
};
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
  const questions = d.studentQuestions || [];
  if (DB_ASSIGNMENT_FLOW && DB_ASSIGNMENT_FLOW.assignmentId !== a.id) DB_ASSIGNMENT_FLOW = null;
  if (DB_ASSIGNMENT_REVIEW && DB_ASSIGNMENT_REVIEW.assignmentId !== a.id) DB_ASSIGNMENT_REVIEW = null;
  if ((graded || w === 'CLOSED') && !DB_ASSIGNMENT_REVIEW) DB_ASSIGNMENT_REVIEW = { assignmentId: a.id, index: 0 };
  if (DB_ASSIGNMENT_REVIEW && questions.length) DB_ASSIGNMENT_REVIEW.index = Math.max(0, Math.min(questions.length - 1, Number.isInteger(DB_ASSIGNMENT_REVIEW.index) ? DB_ASSIGNMENT_REVIEW.index : 0));
  const canChooseGame = !dbIsTeacher() && !graded && w !== 'CLOSED' && questions.length > 0;
  if (canChooseGame && !DB_ASSIGNMENT_FLOW) {
    DB_ASSIGNMENT_FLOW = { assignmentId: a.id, mode: 'RACE', started: false, index: 0 };
  }
  const flow = canChooseGame ? DB_ASSIGNMENT_FLOW : null;
  const justSubmitted = !!(s && flow && flow.submitted);
  if (justSubmitted && !DB_ASSIGNMENT_REVIEW) DB_ASSIGNMENT_REVIEW = { assignmentId: a.id, index: 0 };
  if (flow && !flow.started && !flow.submitted) {
    return `<section class="panel db-assignment-detail-head" aria-labelledby="db-h-sd">
        <div class="row between"><div><h2 id="db-h-sd">${h(a.title)}</h2><p class="lead">${dbSubmissionPill(a, s)}${s ? ' · nộp lúc ' + dbDateTime(s.submitted_at) + (s.is_edited ? ' (đã sửa)' : '') : ''}</p></div>${dbBtn('Về danh sách', 'go', { page: 'assignments' }, 'light')}</div>
        ${dbAssignmentFacts(d, a)}
      </section>
      ${dbAssignmentStudentGamePicker(d, a, questions, flow)}`;
  }
  const detailHeader = flow && flow.started
    ? `<section class="db-assignment-playing-head"><div><span class="db-assignment-game-kicker">ĐANG LÀM BÀI · ${h(DB_ASSIGNMENT_GAMES[flow.mode]?.title || DB_ASSIGNMENT_GAMES.RACE.title)}</span><h2>${h(a.title)}</h2></div>${dbBtn('Về danh sách', 'go', { page: 'assignments' }, 'light')}</section>`
    : `<section class="panel" aria-labelledby="db-h-sd">
        <div class="row between"><div><h2 id="db-h-sd">${h(a.title)}</h2><p class="lead">${dbSubmissionPill(a, s)}${s ? ' · nộp lúc ' + dbDateTime(s.submitted_at) + (s.is_edited ? ' (đã sửa)' : '') : ''}</p></div>${dbBtn('Về danh sách', 'go', { page: 'assignments' }, 'light')}</div>
        ${dbAssignmentFacts(d, a)}
      </section>`;
  let form;
  if (graded) form = `<div class="notice">${ic('info', 16)}<div>Bài đã được chấm nên không sửa được nữa.</div></div>`;
  else if (w === 'CLOSED') form = `<div class="notice">${ic('info', 16)}<div>${s ? 'Đã hết hạn nên không sửa được bài nộp.' : 'Đã hết hạn nộp bài.'}</div></div>`;
  else if (!questions.length) form = `<div class="notice">${ic('info', 16)}<div>Bài tập chưa có câu hỏi để làm. Vui lòng liên hệ giáo viên.</div></div>`;
  else if (justSubmitted) form = dbAssignmentStudentQuestions(d, s, false, DB_ASSIGNMENT_REVIEW);
  else form = `<form class="${flow && flow.started ? 'db-assignment-game-form' : ''}" data-game-mode="${h(flow && flow.mode || 'RACE')}" data-act="submitAssignment" data-id="${h(a.id)}" novalidate>
      ${dbAssignmentStudentQuestions(d, s, true, flow)}
      ${w === 'LATE' ? `<div class="notice">${ic('info', 16)}<div>Đã quá hạn nộp: bài nộp hoặc sửa lúc này được ghi là nộp muộn.</div></div>` : ''}
      ${dbFormError()}
    </form>`;
  const submittedNotice = justSubmitted ? `<section class="db-assignment-submit-success" role="status"><span aria-hidden="true">✓</span><div><b>Nộp bài thành công!</b><p>Bài làm của em đã được gửi. Điểm sẽ hiển thị sau khi giáo viên chấm bài.</p></div><button type="button" class="btn light" data-act="assignmentEditSubmitted" data-id="${h(a.id)}">Chỉnh sửa / nộp lại</button></section>` : '';
  return `${detailHeader}
  ${graded ? `<section class="panel" aria-labelledby="db-h-res"><h2 id="db-h-res">Kết quả</h2>
      <div class="facts db-key-facts"><div class="db-fact-score"><span>Điểm</span><b>${dbNum(s.score)} / ${dbNum(a.max_score)}</b></div><div class="db-fact-time"><span>Chấm lúc</span><b>${dbDateTime(s.graded_at)}</b></div>${dbRubricResult(d, s)}</div>
      ${s.feedback ? `<div class="db-prose"><b>Nhận xét của giáo viên:</b> ${h(s.feedback)}</div>` : ''}</section>` : ''}
  ${submittedNotice}
  ${flow && flow.started ? form : `<section class="panel" aria-labelledby="db-h-sw"><h2 id="db-h-sw">Bài làm</h2>
    ${graded || w === 'CLOSED' ? (s ? `${dbAssignmentStudentQuestions(d, s, false, DB_ASSIGNMENT_REVIEW)}${s.text_content ? `<div class="db-prose">${h(s.text_content)}</div>` : ''}${s.storage_path ? `<div class="db-file"><span class="db-file-name">${ic('overview', 14)}<span class="db-file-title">${h(dbSubName(s))}</span></span><span class="row db-file-actions">${dbBtn('Xem trước', 'previewSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}${dbBtn('Tải xuống', 'downloadSubmission', { path: s.storage_path, name: dbSubName(s) }, 'light mini')}</span></div>` : ''}` : dbAssignmentStudentQuestions(d, null, false, DB_ASSIGNMENT_REVIEW)) : form}
  </section>`}`;
}
/* Điểm từng tiêu chí rubric trong trang kết quả của học sinh. */
function dbRubricResult(d, s) {
  const rows = (d.rubricScores || []).filter((x) => x.submission_id === s.id);
  if (!rows.length) return '';
  const crit = dbById(d.criteria || []);
  return rows.map((r) => { const c = crit[r.criterion_id]; return c ? `<div><span>${h(c.title)}</span><b>${dbNum(r.score)} / ${dbNum(c.max_score)}</b></div>` : ''; }).join('');
}
DB_ACT.submitAssignment = (form) => dbRun(form, async () => {
  const a = DB.data.assignments.find((x) => x.id === form.dataset.id);
  const prev = (DB.data.submissions || []).find((x) => x.assignment_id === a.id);
  const questions = DB.data.studentQuestions || [], answers = dbReadAssignmentAnswers(form, questions);
  if (!questions.length) throw new Error('Bài tập chưa có câu hỏi để làm.');
  const hasAnswer = Object.values(answers).some((answer) => !dbAssignmentAnswerBlank(answer));
  if (!hasAnswer) throw new Error('Hãy trả lời ít nhất một câu trước khi nộp bài.');
  const first = dbAssignmentWindow(a) === 'OPEN' ? 'SUBMITTED' : 'LATE';
  const send = (status) => EducMindDB.submitAssignment({
    assignment_id: a.id,
    text_content: prev ? prev.text_content || '' : '',
    storage_path: prev ? prev.storage_path : null,
    file_name: prev ? prev.file_name : null,
    status,
  });
  let r = await send(first);
  /* Đồng hồ của máy người dùng có thể lệch vài giây so với máy chủ quanh thời điểm hết hạn: thử lại với trạng thái còn lại. */
  if (r.error && /Submission status is not valid/i.test(r.error.message || '')) r = await send(first === 'SUBMITTED' ? 'LATE' : 'SUBMITTED');
  const saved = await dbCall(Promise.resolve(r));
  await dbCall(EducMindDB.saveAssignmentAnswers(questions.map((q) => ({
    submission_id: saved.id,
    question_id: q.question_id,
    answer_content: answers[q.question_id],
  }))));
  dbAssignmentStopTimer();
  DB_ASSIGNMENT_FLOW = { ...(DB_ASSIGNMENT_FLOW || {}), assignmentId: a.id, started: false, submitted: true, index: 0 };
  DB_ASSIGNMENT_REVIEW = { assignmentId: a.id, index: 0 };
  DB.dialog = {
    title: 'Nộp bài thành công!',
    body: '<p>Bài làm của em đã được gửi. Em có thể xem lại câu trả lời bên dưới; điểm sẽ hiển thị sau khi giáo viên chấm bài.</p>',
  };
}, 'Đã nộp bài thành công.');
