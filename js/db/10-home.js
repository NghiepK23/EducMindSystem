/* EducMind · js/db/10-home.js
   Trang Tổng quan của giáo viên và học sinh, và trang Lịch sử chỉnh sửa (chỉ giáo viên). */

DB_PAGES.home = {
  title: 'Tổng quan',
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

function dbHomeActivities(d) {
  const assignments = dbById(d.assignments || []), assessments = dbById(d.assessments || []), profiles = d.profiles || {};
  const events = [];
  (d.submissions || []).forEach((s) => {
    const a = assignments[s.assignment_id], title = a ? a.title : 'Bài tập';
    const who = dbIsTeacher() ? `${dbName(profiles[s.student_id])} · ` : '';
    if (s.submitted_at) events.push({ at: s.submitted_at, title: `${who}${title}`, detail: 'Đã nộp bài tập', page: 'assignments', id: s.assignment_id });
    if (s.score != null && s.graded_at) events.push({ at: s.graded_at, title: `${who}${title}`, detail: `Đã chấm · ${dbNum(s.score)} điểm`, page: 'assignments', id: s.assignment_id });
  });
  (d.attempts || []).forEach((t) => {
    const e = assessments[t.assessment_id], title = e ? e.title : 'Bài kiểm tra';
    const who = dbIsTeacher() ? `${dbName(profiles[t.student_id])} · ` : '';
    if (t.submitted_at) events.push({ at: t.submitted_at, title: `${who}${title}`, detail: t.status === 'GRADED' ? `Đã hoàn thành lượt ${t.attempt_number}` : 'Đã nộp bài kiểm tra', page: 'assessments', id: t.assessment_id });
    if (t.status === 'GRADED' && t.graded_at) events.push({ at: t.graded_at, title: `${who}${title}`, detail: `Đã chấm · ${dbNum(t.total_score)} điểm`, page: 'assessments', id: t.assessment_id });
  });
  return events.map((e) => ({ ...e, time: new Date(e.at).getTime() })).filter((e) => Number.isFinite(e.time)).sort((a, b) => b.time - a.time).slice(0, 5);
}

function dbHomeEventRows(d) {
  const rows = dbHomeActivities(d);
  return rows.length ? rows.map((e) => {
    const graded = e.detail.startsWith('Đã chấm');
    const tone = e.page === 'assessments' ? 'is-violet' : graded ? 'is-good' : '';
    const icon = e.page === 'assessments' ? 'assessments' : graded ? 'check' : 'assignments';
    return `<div class="td-activity-row"><span class="td-activity-icon ${tone}">${ic(icon, 16)}</span><span><b>${h(e.title)}</b><small>${h(e.detail)} · ${dbDateTime(e.at)}</small></span>${dbBtn('Mở', 'go', { page: e.page, id: e.id }, 'light mini')}</div>`;
  }).join('') : `<div class="td-empty">Chưa có hoạt động gần đây để hiển thị.</div>`;
}

function dbStudentGradeTrend(d) {
  const today = new Date(dbNow());
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - 6 + i);
    return date;
  });
  const keyOf = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const grades = new Map(days.map((date) => [keyOf(date), []]));
  const assignments = dbById(d.assignments || []);
  (d.submissions || []).forEach((submission) => {
    const assignment = assignments[submission.assignment_id], max = Number(assignment?.max_score), score = Number(submission.score);
    if (!assignment || submission.score == null || !submission.graded_at || !Number.isFinite(max) || max <= 0 || !Number.isFinite(score)) return;
    const date = new Date(submission.graded_at);
    const key = Number.isFinite(date.getTime()) ? keyOf(date) : '';
    if (grades.has(key)) grades.get(key).push(Math.max(0, Math.min(100, score / max * 100)));
  });
  return days.map((date) => ({
    label: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()],
    value: grades.get(keyOf(date)).length ? dbMean(grades.get(keyOf(date))) : null,
  }));
}

function dbHomeTrend(d) {
  const today = new Date(dbNow());
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - 6 + i);
    return date;
  });
  const keyOf = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const counts = (rows) => {
    const byDay = new Map(days.map((date) => [keyOf(date), 0]));
    rows.forEach((row) => {
      if (!row.submitted_at) return;
      const date = new Date(row.submitted_at);
      if (!Number.isFinite(date.getTime())) return;
      const key = keyOf(date);
      if (byDay.has(key)) byDay.set(key, byDay.get(key) + 1);
    });
    return days.map((date) => byDay.get(keyOf(date)));
  };
  return {
    labels: days.map((date) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]),
    assignments: counts(d.submissions || []),
    assessments: counts(d.attempts || []),
  };
}

function dbHomeTrendChart(d) {
  const trend = dbHomeTrend(d), allValues = [...trend.assignments, ...trend.assessments];
  if (!allValues.some((value) => value > 0)) {
    return `<div class="td-chart-empty"><span>${ic('trend', 20)}</span><b>Chưa có hoạt động trong 7 ngày qua</b><small>Số lượt nộp bài tập và bài kiểm tra sẽ xuất hiện tại đây.</small></div>`;
  }
  const left = 42, right = 660, top = 18, bottom = 178, height = bottom - top;
  const maxValue = Math.max(...allValues);
  const max = maxValue <= 4 ? Math.max(1, maxValue) : Math.ceil(maxValue / 4) * 4;
  const x = (index) => left + index * (right - left) / 6;
  const y = (value) => bottom - value * height / max;
  const path = (values) => values.map((value, i) => {
    const px = x(i).toFixed(1), py = y(value).toFixed(1);
    if (!i) return `M${px} ${py}`;
    const previousX = x(i - 1), previousY = y(values[i - 1]), midX = ((previousX + x(i)) / 2).toFixed(1);
    return `C${midX} ${previousY.toFixed(1)} ${midX} ${py} ${px} ${py}`;
  }).join(' ');
  const area = (values) => `${path(values)} L${right} ${bottom} L${left} ${bottom} Z`;
  const grid = (max === 1 ? [0, max] : [0, Math.ceil(max / 2), max]).map((value) => {
    const yy = y(value);
    return `<line class="td-chart-grid-line" x1="${left}" y1="${yy}" x2="${right}" y2="${yy}"></line><text class="td-chart-axis-label" x="${left - 10}" y="${yy + 4}" text-anchor="end">${value}</text>`;
  }).join('');
  const points = (values, tone, name) => values.map((value, i) => `<circle class="td-chart-point ${tone}" cx="${x(i)}" cy="${y(value)}" r="3.5"><title>${name} · ${trend.labels[i]}: ${value} lượt</title></circle>`).join('');
  const dayLabels = trend.labels.map((label, i) => `<text class="td-chart-axis-label" x="${x(i)}" y="207" text-anchor="middle">${label}</text>`).join('');
  return `<svg class="td-activity-chart" viewBox="0 0 680 220" role="img" aria-label="Lượt nộp bài theo ngày trong 7 ngày qua. Bài tập: ${trend.assignments.join(', ')}. Bài kiểm tra: ${trend.assessments.join(', ')}.">
    <defs>
      <linearGradient id="td-assignment-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#35b8f2" stop-opacity=".28"></stop><stop offset="1" stop-color="#35b8f2" stop-opacity="0"></stop></linearGradient>
      <linearGradient id="td-assessment-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b46bff" stop-opacity=".24"></stop><stop offset="1" stop-color="#b46bff" stop-opacity="0"></stop></linearGradient>
    </defs>
    ${grid}
    <path class="td-chart-area td-chart-area-assignment" d="${area(trend.assignments)}"></path>
    <path class="td-chart-area td-chart-area-assessment" d="${area(trend.assessments)}"></path>
    <path class="td-chart-line td-chart-line-assignment" d="${path(trend.assignments)}"></path>
    <path class="td-chart-line td-chart-line-assessment" d="${path(trend.assessments)}"></path>
    ${points(trend.assignments, 'is-assignment', 'Bài tập')}${points(trend.assessments, 'is-assessment', 'Bài kiểm tra')}
    ${dayLabels}
  </svg>`;
}

function dbHomeTeacher(d) {
  d = { assignments: [], assessments: [], submissions: [], attempts: [], mastery: [], gaps: [], members: [], profiles: {}, objectives: [], topics: [], lessons: [], ...d };
  const subsBy = dbGroup(d.submissions, 'assignment_id'), attBy = dbGroup(d.attempts, 'assessment_id');
  const toGrade = d.assignments.map((a) => ({ a, n: (subsBy[a.id] || []).filter((s) => s.score == null).length })).filter((x) => x.n);
  const toMark = d.assessments.map((e) => ({ e, n: (attBy[e.id] || []).filter((t) => t.status === 'SUBMITTED').length })).filter((x) => x.n);
  const waiting = toGrade.reduce((s, x) => s + x.n, 0) + toMark.reduce((s, x) => s + x.n, 0);
  const openGapRows = d.gaps.filter((g) => g.status === 'OPEN');
  const studentsToSupport = new Set(openGapRows.map((g) => g.student_id)).size;
  const avg = dbMean(d.mastery.map((m) => Number(m.mastery_score)));
  const activeAssignments = d.assignments.filter((a) => a.status === 'PUBLISHED');
  const activeIds = new Set(activeAssignments.map((a) => a.id));
  const activeSubs = d.submissions.filter((s) => activeIds.has(s.assignment_id));
  const completedPairs = new Set(activeSubs.map((s) => `${s.assignment_id}|${s.student_id}`));
  const completionTotal = activeAssignments.length * d.members.length;
  const completion = completionTotal ? Math.min(100, Math.round(completedPairs.size / completionTotal * 100)) : null;
  const gradedTests = d.attempts.filter((t) => t.status === 'GRADED' && t.total_score != null).map((t) => Number(t.total_score)).filter(Number.isFinite);
  const now = dbNow(), soon = now + 7 * 86400000;
  const upcoming = activeAssignments.filter((a) => new Date(a.due_at).getTime() >= now && new Date(a.due_at).getTime() <= soon);
  const openExams = d.assessments.filter((e) => e.status === 'PUBLISHED' && dbAssessmentWindow(e) === 'OPEN');
  const drafts = d.assignments.filter((a) => a.status === 'DRAFT').length + d.assessments.filter((e) => e.status === 'DRAFT').length + d.lessons.filter((l) => l.status === 'DRAFT').length;
  const taskRows = toGrade.map((x) => `<div class="td-task"><span class="td-task-icon">${ic('assignments', 18)}</span><span class="td-task-copy"><b>${h(x.a.title)}</b><small>Bài tập · ${x.n} bài nộp chờ chấm</small></span>${dbBtn('Chấm bài', 'go', { page: 'assignments', id: x.a.id }, 'light mini')}</div>`).join('')
    + toMark.map((x) => `<div class="td-task"><span class="td-task-icon is-violet">${ic('assessments', 18)}</span><span class="td-task-copy"><b>${h(x.e.title)}</b><small>Bài kiểm tra · ${x.n} lượt chờ đánh giá</small></span>${dbBtn('Chấm bài', 'go', { page: 'assessments', id: x.e.id, tab: 'attempts' }, 'light mini')}</div>`).join('');
  const completionRows = activeAssignments.slice(0, 5).map((a) => {
    const submitted = (subsBy[a.id] || []).length, total = d.members.length, rate = total ? Math.min(100, Math.round(submitted / total * 100)) : null;
    return `<div class="td-chart-row"><span class="td-chart-label" title="${h(a.title)}">${h(a.title)}</span><span class="td-chart-track" role="img" aria-label="${rate == null ? 'Chưa có học sinh trong lớp' : submitted + ' trên ' + total + ' học sinh đã nộp'}"><i style="width:${rate || 0}%"></i></span><b>${rate == null ? '—' : rate + '%'}</b><small>${submitted}/${total} đã nộp</small></div>`;
  }).join('');
  const gapsByStudent = dbGroup(openGapRows, 'student_id');
  const supportRows = Object.entries(gapsByStudent).slice(0, 4).map(([id, gaps]) => `<div class="td-insight"><span class="td-insight-mark is-warn">${ic('alert', 16)}</span><span><b>${h(dbName(d.profiles[id]))}</b><small>${gaps.length} mục tiêu cần hỗ trợ</small></span>${dbBtn('Theo dõi', 'go', { page: 'gaps' }, 'light mini')}</div>`).join('');
  const objectiveMeans = dbGroup(d.mastery, 'objective_id');
  const strongest = Object.entries(objectiveMeans).map(([id, rows]) => ({ id, score: dbMean(rows.map((x) => Number(x.mastery_score))) })).filter((x) => Number.isFinite(x.score)).sort((a, b) => b.score - a.score)[0];
  const strongestObjective = strongest && d.objectives.find((o) => o.id === strongest.id);
  const topAssignment = activeAssignments.map((a) => ({ a, submitted: (subsBy[a.id] || []).length }))
    .filter((x) => x.submitted > 0).sort((a, b) => b.submitted - a.submitted)[0];
  const highlightRows = [
    strongestObjective ? `<div class="td-highlight-row"><span class="td-highlight-icon is-amber">${ic('spark', 18)}</span><span><b>Mục tiêu nắm vững nhất</b><small>${h(strongestObjective.code)} · ${h(strongestObjective.description)}</small></span><strong>${dbPct(strongest.score)}</strong></div>` : '',
    topAssignment ? `<div class="td-highlight-row"><span class="td-highlight-icon is-violet">${ic('assignments', 18)}</span><span><b>Bài tập có nhiều lượt nộp</b><small>${h(topAssignment.a.title)} · ${topAssignment.submitted}/${d.members.length} học sinh</small></span><strong>${d.members.length ? Math.round(topAssignment.submitted / d.members.length * 100) + '%' : '—'}</strong></div>` : '',
    `<div class="td-highlight-row"><span class="td-highlight-icon is-good">${ic('students', 18)}</span><span><b>Học sinh cần đồng hành</b><small>Theo các mục tiêu đang mở</small></span><strong>${studentsToSupport}</strong></div>`,
  ].filter(Boolean).join('');
  const dueRows = upcoming.slice(0, 3).map((a) => `<div class="td-deadline-row"><span class="td-deadline-icon">${ic('calendar', 16)}</span><span><b>${h(a.title)}</b><small>Hạn ${dbDateTime(a.due_at)} · ${(subsBy[a.id] || []).length}/${d.members.length} đã nộp</small></span>${dbBtn('Mở', 'go', { page: 'assignments', id: a.id }, 'light mini')}</div>`).join('')
    + openExams.slice(0, 2).map((e) => `<div class="td-deadline-row"><span class="td-deadline-icon is-violet">${ic('assessments', 16)}</span><span><b>${h(e.title)}</b><small>Đang mở · đóng ${dbDateTime(e.close_at)}</small></span>${dbBtn('Mở', 'go', { page: 'assessments', id: e.id, tab: 'attempts' }, 'light mini')}</div>`).join('');
  return `<div class="teacher-dashboard">
    <section class="td-welcome"><div class="td-welcome-copy"><span class="td-eyebrow">TRUNG TÂM QUẢN LÝ GIẢNG DẠY · ${h(dbClass()?.name || 'LỚP ĐANG CHỌN')}</span><h2>${dashboardGreeting()}, ${h(dbName(DB.me))}</h2><p>Toàn cảnh hoạt động dạy học và những việc cần ưu tiên trong lớp của thầy/cô.</p>
      <div class="td-welcome-actions">${dbBtn(ic('assignments', 17) + 'Tạo bài tập', 'go', { page: 'assignments', edit: 'new' })}${dbBtn(ic('lessons', 17) + 'Soạn bài', 'go', { page: 'content' }, 'light')}</div></div><span class="td-welcome-art" aria-hidden="true"><img src="assets/student-characters.png" alt=""></span></section>
    <section class="td-metrics" aria-label="Tổng quan giảng dạy">
      <article class="td-metric"><span class="td-metric-icon">${ic('classes', 19)}</span><span class="td-metric-label">Lớp phụ trách</span><b>${DB.classes.length}</b><small>${h(dbClass()?.name || 'Chưa chọn lớp')}</small></article>
      <article class="td-metric"><span class="td-metric-icon is-violet">${ic('assignments', 19)}</span><span class="td-metric-label">Bài tập đang hoạt động</span><b>${activeAssignments.length}</b><small>Trong lớp đang chọn</small></article>
      <article class="td-metric"><span class="td-metric-icon is-good">${ic('trend', 19)}</span><span class="td-metric-label">Tỷ lệ hoàn thành</span><b>${completion == null ? '—' : completion + '%'}</b><small>${completion == null ? 'Chưa có bài tập hoặc học sinh' : completedPairs.size + ' / ' + completionTotal + ' lượt nộp'}</small></article>
      <article class="td-metric"><span class="td-metric-icon is-warn">${ic('students', 19)}</span><span class="td-metric-label">Học sinh cần hỗ trợ</span><b>${studentsToSupport}</b><small>Theo các mục tiêu đang mở</small></article>
    </section>
    <div class="td-dashboard-grid">
      <section class="panel td-panel td-analytics"><header class="td-section-head"><div><span class="td-eyebrow">PHÂN TÍCH HỌC TẬP</span><h3>Tiến độ và kết quả lớp học</h3></div>${dbBtn('Báo cáo chi tiết', 'go', { page: 'report' }, 'light mini')}</header>
        <div class="td-analytics-summary"><div><span>Bài tập đã giao</span><b>${activeAssignments.length}</b></div><div><span>Tổng lượt đã nộp</span><b>${completedPairs.size}</b></div><div><span>Mức nắm vững TB</span><b>${d.mastery.length ? dbPct(avg) : '—'}</b></div><div><span>Lượt kiểm tra đã chấm</span><b>${gradedTests.length}</b></div></div>
        <div class="td-trend-head"><h4>Hoạt động học tập</h4><span class="td-period">${ic('calendar', 14)}7 ngày qua</span></div>
        <div class="td-chart-legend"><span><i class="is-assignment"></i>Bài tập nộp</span><span><i class="is-assessment"></i>Bài kiểm tra nộp</span></div>
        ${dbHomeTrendChart(d)}
        <div class="td-assignment-breakdown"><h4>Tỷ lệ nộp theo bài tập</h4>${completionRows || `<div class="td-empty">Chưa có bài tập đã xuất bản để phân tích.</div>`}</div>
      </section>
      <section class="panel td-panel td-insights"><header class="td-section-head"><div><span class="td-eyebrow">PHÂN TÍCH GIẢNG DẠY</span><h3>Điểm nổi bật</h3></div>${dbBtn('Phân tích', 'go', { page: 'gaps' }, 'light mini')}</header>
        ${highlightRows || `<div class="td-empty">Chưa có dữ liệu nổi bật để phân tích.</div>`}
        ${supportRows ? `<div class="td-support-list"><h4>Học sinh cần theo dõi</h4>${supportRows}</div>` : ''}
        ${!strongestObjective ? `<p class="td-panel-note">Phân tích mức nắm vững sẽ xuất hiện khi có thêm kết quả học tập.</p>` : ''}
      </section>
      <section class="panel td-panel td-priorities"><header class="td-section-head"><div><span class="td-eyebrow">CẦN XỬ LÝ</span><h3>Việc cần ưu tiên</h3></div><span class="td-count">${waiting}</span></header>
        <p class="td-panel-note">${waiting ? waiting + ' bài nộp và lượt kiểm tra cần phản hồi.' : 'Không có bài nào đang chờ chấm.'}${drafts ? ' · ' + drafts + ' nội dung còn là bản nháp.' : ''}</p>
        ${taskRows || `<div class="td-empty">Không có lượt nào đang chờ chấm.</div>`}
        ${!d.topics.length ? dbTodo('Lớp chưa có nội dung', 'Thêm chủ đề, bài học và mục tiêu để bắt đầu.', 'content', {}, 'Soạn bài học') : ''}
        ${!d.members.length ? dbTodo('Lớp chưa có học sinh', 'Mời học sinh tham gia lớp để bắt đầu theo dõi tiến độ.', 'classes', {}, 'Mở lớp học') : ''}
      </section>
      <section class="panel td-panel td-deadlines"><header class="td-section-head"><div><span class="td-eyebrow">SẮP TỚI HẠN</span><h3>Hoạt động đang diễn ra</h3></div>${dbBtn('Lịch', 'go', { page: 'schedule' }, 'light mini')}</header>
        ${dueRows || `<div class="td-empty">Không có hạn nộp sắp tới hoặc bài kiểm tra đang mở.</div>`}
      </section>
      <section class="panel td-panel td-recent"><header class="td-section-head"><div><h3>Hoạt động gần đây</h3></div></header>${dbHomeEventRows(d)}</section>
      <section class="td-ai-card"><span class="td-ai-icon">${ic('spark', 18)}</span><span><b>EducMind AI</b><small>Khởi tạo câu hỏi từ mục tiêu học tập; thầy/cô duyệt trước khi sử dụng.</small></span>${dbBtn('Khám phá AI', 'go', { page: 'ai' }, 'light mini')}</section>
    </div>
  </div>`;
}
function dbHomeStudent(d) {
  d = { assignments: [], assessments: [], submissions: [], attempts: [], mastery: [], gaps: [], objectives: [], recs: [], ...d };
  const mine = Object.fromEntries(d.submissions.map((s) => [s.assignment_id, s])), attBy = dbGroup(d.attempts, 'assessment_id');
  const publishedAssignments = d.assignments.filter((a) => a.status === 'PUBLISHED');
  const publishedAssessments = d.assessments.filter((e) => e.status === 'PUBLISHED');
  const todoAsg = publishedAssignments.filter((a) => !mine[a.id] && dbAssignmentWindow(a) !== 'CLOSED');
  const todoEx = publishedAssessments.filter((e) => { const att = attBy[e.id] || []; return att.some((t) => t.status === 'IN_PROGRESS') || (dbAssessmentWindow(e) === 'OPEN' && !att.length); });
  const avg = dbMean(d.mastery.map((m) => Number(m.mastery_score)));
  const openGaps = d.gaps.filter((g) => g.status === 'OPEN');
  const completedAssessments = new Set(d.attempts.filter((t) => t.status === 'SUBMITTED' || t.status === 'GRADED').map((t) => t.assessment_id));
  const assignedTotal = publishedAssignments.length + publishedAssessments.length;
  const completedTotal = publishedAssignments.filter((a) => !!mine[a.id]).length + completedAssessments.size;
  const completionPercent = assignedTotal ? Math.min(100, Math.round(completedTotal / assignedTotal * 100)) : null;
  const gradedScores = d.submissions.filter((s) => s.score != null).map((s) => {
    const a = d.assignments.find((x) => x.id === s.assignment_id);
    return a && Number(a.max_score) > 0 ? Number(s.score) / Number(a.max_score) : null;
  }).filter(Number.isFinite);
  const averageScore = gradedScores.length ? Math.round(dbMean(gradedScores) * 100) : null;
  const recs = d.recs.filter((r) => r.status === 'ACTIVE').slice(0, 3);
  const goalsById = dbById(d.objectives);
  const masteryByObjective = Object.fromEntries(d.mastery.map((m) => [m.objective_id, m]));
  const masteryBuckets = { good: 0, progress: 0, need: 0, unknown: 0 };
  d.objectives.forEach((o) => {
    const row = masteryByObjective[o.id], score = row && row.mastery_score != null ? Number(row.mastery_score) : null;
    if (!Number.isFinite(score)) masteryBuckets.unknown++;
    else if (score >= .7) masteryBuckets.good++;
    else if (score >= .4) masteryBuckets.progress++;
    else masteryBuckets.need++;
  });
  const masteryChart = studentMasteryDonut(masteryBuckets, d.objectives.length);
  const progressChart = studentLearningChart(dbStudentGradeTrend(d), 'Điểm bài tập đã chấm', 'Chưa có bài tập được chấm trong 7 ngày qua');
  const masteryRows = d.objectives.map((o) => ({ m: masteryByObjective[o.id] || null, o })).slice(0, 5);
  const masteryView = masteryRows.length ? masteryRows.map(({ m, o }) => {
    const score = m && m.mastery_score != null ? Number(m.mastery_score) : null, percent = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score * 100))) : 0;
    const masteryPill = Number.isFinite(score) ? tierPill(score) : dbPill('Chưa có dữ liệu', 'plain');
    return `<div class="sd-db-goal"><span class="sd-db-goal-head"><b>${h(o.code)} · ${h(o.description)}</b><span class="sd-db-goal-status">${masteryPill}<b class="sd-db-goal-percent">${Number.isFinite(score) ? percent + '%' : '—'}</b></span></span><i role="progressbar" aria-label="${h(o.code)}: ${Number.isFinite(score) ? percent + '%' : 'chưa có dữ liệu'}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number.isFinite(score) ? percent : 0}"><u style="width:${Number.isFinite(score) ? percent : 0}%"></u></i></div>`;
  }).join('') : `<div class="td-empty">Chưa có dữ liệu tiến độ mục tiêu. Kết quả sẽ xuất hiện sau khi em bắt đầu học.</div>`;
  const gapRows = openGaps.slice(0, 4).map((g) => {
    const o = goalsById[g.objective_id];
    return `<div class="td-insight"><span class="td-insight-mark is-warn">${ic('alert', 16)}</span><span><b>${h(o ? `${o.code} · ${o.description}` : 'Mục tiêu cần củng cố')}</b><small>${h(g.reason || 'Ôn tập thêm nội dung này')}</small></span>${dbBtn('Ôn tập', 'go', { page: 'gaps' }, 'light mini')}</div>`;
  }).join('');
  const tasks = todoEx.map((e) => `<div class="td-task"><span class="td-task-icon is-violet">${ic('assessments', 18)}</span><span class="td-task-copy"><b>${h(e.title)}</b><small>Bài kiểm tra · ${e.duration_minutes} phút · đóng lúc ${dbDateTime(e.close_at)}</small></span>${dbBtn('Bắt đầu', 'go', { page: 'assessments', id: e.id }, 'light mini')}</div>`).join('')
    + todoAsg.map((a) => `<div class="td-task"><span class="td-task-icon">${ic('assignments', 18)}</span><span class="td-task-copy"><b>${h(a.title)}</b><small>Bài tập · ${dbDueText(a)}</small></span>${dbBtn('Làm bài', 'go', { page: 'assignments', id: a.id }, 'light mini')}</div>`).join('');
  return `<div class="student-dashboard sd-db-dashboard">
    <section class="sd-metrics" aria-label="Tóm tắt tiến độ học tập">
      <article class="sd-metric"><span class="sd-metric-icon">${ic('check', 18)}</span><b>${completedTotal}<small> / ${assignedTotal}</small></b><span>Bài đã hoàn thành</span>${completionPercent == null ? '' : `<span class="sd-metric-progress" role="progressbar" aria-label="Tỷ lệ hoàn thành" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${completionPercent}"><i style="width:${completionPercent}%"></i></span>`}</article>
      <article class="sd-metric"><span class="sd-metric-icon is-good">${ic('trend', 18)}</span><b>${averageScore == null ? '—' : averageScore + '%'}</b><span>${averageScore == null ? 'Chưa có điểm đã chấm' : 'Điểm trung bình bài tập'}</span></article>
      <article class="sd-metric"><span class="sd-metric-icon is-violet">${ic('classes', 18)}</span><b>—</b><span>Thứ hạng chưa có dữ liệu</span></article>
      <article class="sd-metric"><span class="sd-metric-icon is-cyan">${ic('clock', 18)}</span><b>—</b><span>Chưa có dữ liệu thời gian học</span></article>
    </section>
    <section class="sd-dashboard-grid db-student-grid">
      <section class="panel sd-db-panel sd-db-overview"><header class="td-section-head"><div><span class="td-eyebrow">TIẾN ĐỘ CÁ NHÂN</span><h3>Tiến độ học tập</h3></div><span class="sd-chart-period">7 ngày</span></header>
        <div class="sd-chart-legend"><span><i></i>Điểm bài tập đã chấm</span></div>${progressChart}
        <div class="sd-goal-breakdown"><header class="td-section-head"><div><span class="td-eyebrow">MỤC TIÊU HỌC TẬP</span><h3>Mức nắm vững</h3></div>${dbBtn('Xem tất cả', 'go', { page: 'progress' }, 'light mini')}</header>${masteryView}</div>
      </section>
      <section class="panel sd-db-panel sd-db-gaps"><header class="td-section-head"><div><span class="td-eyebrow">MỤC TIÊU CẦN CỦNG CỐ</span><h3>Điểm cần củng cố</h3></div><span class="td-count">${openGaps.length}</span></header>
        <div class="sd-subsection-title">Phân bố mục tiêu học tập</div>${masteryChart}
        ${gapRows || `<div class="td-empty">Chưa ghi nhận mục tiêu nào cần ôn tập.</div>`}
        ${recs.length ? `<div class="sd-db-recs"><b>Gợi ý dành cho em</b>${recs.map((r) => `<div class="sd-db-rec"><span><b>${h(DB_REC_KIND[r.kind] || r.kind)}</b><small>${h(r.reason || 'Gợi ý từ tiến độ học tập của em')}</small></span>${dbBtn('Xem gợi ý', 'go', { page: 'recommend' }, 'light mini')}</div>`).join('')}</div>` : ''}
      </section>
      <section class="panel sd-db-panel sd-db-recent"><header class="td-section-head"><div><h3>Hoạt động gần đây</h3></div></header>${dbHomeEventRows(d)}</section>
      <section class="panel sd-db-panel sd-db-tasks"><header class="td-section-head"><div><span class="td-eyebrow">ƯU TIÊN TIẾP THEO</span><h3>Việc em cần làm</h3></div><span class="td-count">${todoAsg.length + todoEx.length}</span></header>
        ${tasks || `<div class="td-empty">Em đã hoàn thành mọi việc đang mở.</div>`}
      </section>
      <section class="sd-db-motivation"><span class="td-metric-icon is-good">${ic('target', 19)}</span><div><span class="td-eyebrow">MỤC TIÊU CỦA EM</span><b>${assignedTotal ? `Đã hoàn thành ${completedTotal} / ${assignedTotal} hoạt động` : 'Bắt đầu hành trình học tập của em'}</b><small>${d.mastery.length ? `${dbPct(avg)} mức nắm vững trung bình · ${d.objectives.length} mục tiêu học tập` : 'Mỗi bài học và bài tập sẽ giúp EducMind cập nhật tiến độ của em.'}</small></div>${dbBtn('Tiếp tục học', 'go', { page: 'lessons' })}</section>
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
      if (s.objective_id && objById[s.objective_id]) {
        const o = objById[s.objective_id];
        return `${o.code} · ${o.description}`;
      }
      return String(s.title || s.content || s.description || s.file_name || s.code || '').slice(0, 140);
    };
    const rows = d.revisions.map((r) => {
      const actionLabel = (DB_REV_ACTION[r.action] || [r.action, 'plain'])[0], entityLabel = DB_REV_ENTITY[r.entity_type] || r.entity_type;
      const summary = what(r), date = dbDateTime(r.created_at);
      return `<tr data-history-row data-history-action="${h(r.action)}" data-history-entity="${h(r.entity_type)}" data-history-search="${h(`${date} ${actionLabel} ${entityLabel} ${summary}`.toLowerCase())}">
        <td>${date}</td><td>${dbPill(actionLabel, (DB_REV_ACTION[r.action] || [r.action, 'plain'])[1])}</td><td>${h(entityLabel)}</td><td>${h(summary)}</td></tr>`;
    });
    const filters = rows.length ? `<div class="row db-filter">
      <label class="sr" for="db-history-search">Tìm lịch sử chỉnh sửa</label><input id="db-history-search" type="search" placeholder="Tìm theo nội dung hoặc thời điểm" data-input="filterHistory">
      <label class="sr" for="db-history-entity">Lọc theo đối tượng</label><select id="db-history-entity" data-change="filterHistory"><option value="">Mọi đối tượng</option>${Object.entries(DB_REV_ENTITY).map(([k, label]) => `<option value="${h(k)}">${h(label)}</option>`).join('')}</select>
      <label class="sr" for="db-history-action">Lọc theo thao tác</label><select id="db-history-action" data-change="filterHistory"><option value="">Mọi thao tác</option>${Object.entries(DB_REV_ACTION).map(([k, value]) => `<option value="${h(k)}">${h(value[0])}</option>`).join('')}</select>
      ${dbBtn('Xóa bộ lọc', 'clearHistoryFilters', {}, 'light mini')}
    </div>` : '';
    return `<section class="panel" aria-labelledby="db-h-h"><h2 id="db-h-h">Thay đổi gần đây</h2><p class="lead">${d.revisions.length ? d.revisions.length + ' thay đổi gần nhất của lớp.' : ''}</p>
      ${filters}
      ${rows.length ? dbTable(['Thời điểm', 'Thao tác', 'Đối tượng', 'Nội dung'], [...rows, '<tr class="db-history-no-results" hidden><td colspan="4">Không tìm thấy thay đổi phù hợp.</td></tr>'], 'Lịch sử chỉnh sửa') : dbEmpty('Chưa có thay đổi nào được ghi.')}
      ${rows.length ? `<p class="muted" id="db-history-count" aria-live="polite">${rows.length} thay đổi</p>` : ''}
    </section>`;
  },
};
DB_ACT.filterHistory = () => {
  const input = document.getElementById('db-history-search'), entity = document.getElementById('db-history-entity'), action = document.getElementById('db-history-action');
  if (!input || !entity || !action) return;
  const text = input.value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll('#main tbody tr[data-history-row]').forEach((row) => {
    const show = (!entity.value || row.dataset.historyEntity === entity.value) && (!action.value || row.dataset.historyAction === action.value) && (!text || row.dataset.historySearch.includes(text));
    row.hidden = !show;
    if (show) visible++;
  });
  const count = document.getElementById('db-history-count'), empty = document.querySelector('.db-history-no-results');
  if (count) count.textContent = `${visible} / ${(DB.data.revisions || []).length} thay đổi`;
  if (empty) empty.hidden = visible !== 0;
};
DB_ACT.clearHistoryFilters = () => {
  const input = document.getElementById('db-history-search'), entity = document.getElementById('db-history-entity'), action = document.getElementById('db-history-action');
  if (!input || !entity || !action) return;
  input.value = '';
  entity.value = '';
  action.value = '';
  DB_ACT.filterHistory();
  input.focus();
};
