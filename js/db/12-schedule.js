/* EducMind · js/db/12-schedule.js
   Trang “Lịch & việc cần làm”: danh sách việc TỰ ĐỘNG lấy từ dữ liệu của lớp đang chọn
   (hạn nộp bài tập, lịch kiểm tra, bài chưa nộp/chưa chấm, lỗ hổng kiến thức) —
   không có bảng “việc cần làm” riêng, không nhập tay. Kèm lịch tháng với các mốc sự kiện. */

const DB_SCHED_PRIO = ['Quá hạn', 'Hôm nay', 'Sắp tới', 'Nhắc lịch'];
const dbSchedDay = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let DB_SCHED_SEL = '';   // ngày đang chọn trên lịch ('' = mọi ngày)
let DB_SCHED_MONTH = ''; // tháng đang xem (YYYY-MM; '' = tháng hiện tại)

DB_PAGES.schedule = {
  title: 'Lịch & việc cần làm',
  sub: () => 'Việc cần làm tự động cập nhật từ bài tập, bài kiểm tra và tiến độ học tập của lớp.',
  async load() {
    if (!DB.classId) return {};
    const content = await dbLoadContent();
    const [assignments, assessments] = DB.course ? await Promise.all([dbCall(EducMindDB.listAssignments(DB.course.id)), dbCall(EducMindDB.listAssessments(DB.course.id))]) : [[], []];
    const [submissions, attempts, mastery, gaps, roster] = await Promise.all([
      dbCallIn(EducMindDB.listSubmissions, assignments.map((a) => a.id)), dbCallIn(EducMindDB.listAttempts, assessments.map((e) => e.id)),
      dbCallIn(EducMindDB.listMastery, content.objectives.map((o) => o.id)), dbCallIn(EducMindDB.listGaps, content.objectives.map((o) => o.id)),
      dbIsTeacher() ? dbLoadRoster() : { members: [], profiles: {} },
    ]);
    return { ...content, assignments, assessments, submissions, attempts, mastery, gaps, ...roster };
  },
  view(d) {
    if (!DB.classId) return `<section class="panel">${dbEmpty('Hãy chọn một lớp để xem lịch.')}</section>`;
    const items = (dbIsTeacher() ? dbSchedTeacher(d) : dbSchedStudent(d)).sort((x, y) => x.prio - y.prio || x.at - y.at);
    const visibleItems = DB_SCHED_SEL
      ? items.filter((x) => Number.isFinite(x.at) && dbSchedDay(x.at) === DB_SCHED_SEL)
      : items;
    const summary = DB_SCHED_SEL
      ? visibleItems.length + ' việc trong ngày ' + dbDate(DB_SCHED_SEL)
      : (items.length ? items.length + ' việc' : 'Không có việc nào — bạn đã cập nhật hết!');
    return `${dbSchedCalendar(items)}
    <section class="panel" aria-labelledby="db-h-sch">
      <h2 id="db-h-sch">Việc cần làm</h2>
      <p class="lead">${summary}</p>
      <div class="db-sched-list">${visibleItems.map(dbSchedItem).join('') || dbEmpty(DB_SCHED_SEL ? 'Không có việc nào trong ngày đang chọn.' : 'Chưa có việc cần làm.')}</div>
    </section>`;
  },
};

/* --- suy ra việc cần làm từ dữ liệu sẵn có --- */
function dbSchedPrio(at) {
  const now = dbNow(), day = 86400000;
  if (at < now) return 0;
  if (dbSchedDay(at) === dbSchedDay(now)) return 1;
  if (at <= now + 3 * day) return 2;
  return 3;
}
function dbSchedStudent(d) {
  const mine = Object.fromEntries(d.submissions.map((s) => [s.assignment_id, s])), attBy = dbGroup(d.attempts, 'assessment_id');
  const items = [];
  for (const a of d.assignments) {
    if (a.status !== 'PUBLISHED' || mine[a.id]) continue;
    const w = dbAssignmentWindow(a), at = new Date(a.due_at).getTime();
    if (w === 'CLOSED') items.push({ prio: 0, at, title: 'Bài tập quá hạn: ' + a.title, meta: 'Hạn ' + dbDateTime(a.due_at) + ' — cần nộp bổ sung nếu giáo viên cho phép', page: 'assignments', arg: { id: a.id }, label: 'Nộp bù' });
    else items.push({ prio: dbSchedPrio(at), at, title: 'Nộp bài tập: ' + a.title, meta: 'Hạn ' + dbDateTime(a.due_at), page: 'assignments', arg: { id: a.id }, label: 'Làm bài' });
  }
  for (const e of d.assessments) {
    const att = attBy[e.id] || [], doing = att.find((t) => t.status === 'IN_PROGRESS');
    if (e.status !== 'PUBLISHED') continue;
    if (doing) { items.push({ prio: 1, at: dbNow(), title: 'Bài kiểm tra đang làm dở: ' + e.title, meta: 'Tiếp tục làm bài trước khi hết giờ', page: 'exam', arg: { id: e.id }, label: 'Tiếp tục' }); continue; }
    const w = dbAssessmentWindow(e);
    if (w === 'OPEN' && !att.length) items.push({ prio: 2, at: new Date(e.close_at).getTime(), title: 'Làm bài kiểm tra: ' + e.title, meta: 'Đóng lúc ' + dbDateTime(e.close_at) + ' · tối đa ' + e.max_attempts + ' lượt', page: 'exam', arg: { id: e.id }, label: 'Làm bài' });
    else if (w === 'UPCOMING') items.push({ prio: 3, at: new Date(e.open_at).getTime(), title: 'Kiểm tra sắp mở: ' + e.title, meta: 'Mở lúc ' + dbDateTime(e.open_at), page: 'assessments', arg: { id: e.id }, label: 'Xem' });
  }
  const byObj = dbById(d.objectives);
  for (const g of d.gaps.filter((x) => x.status === 'OPEN')) {
    const o = byObj[g.objective_id]; if (!o) continue;
    items.push({ prio: 3, at: new Date(g.opened_at).getTime(), title: 'Ôn tập lỗ hổng: ' + o.code, meta: h(o.description) + ' — mức nắm vững đang dưới 0,8', page: 'progress', arg: {}, label: 'Xem tiến độ' });
  }
  return items;
}
function dbSchedTeacher(d) {
  const subsBy = dbGroup(d.submissions, 'assignment_id'), attBy = dbGroup(d.attempts, 'assessment_id'), items = [];
  for (const a of d.assignments) {
    const subs = subsBy[a.id] || [], un = subs.filter((s) => s.score == null);
    const at = new Date(a.due_at).getTime();
    if (un.length) items.push({ prio: 1, at, title: 'Chấm bài tập: ' + a.title, meta: un.length + ' bài nộp chờ chấm', page: 'assignments', arg: { id: a.id }, label: 'Chấm bài' });
    if (a.status === 'PUBLISHED' && at > dbNow() && at < dbNow() + 7 * 86400000) items.push({ prio: dbSchedPrio(at), at, title: 'Bài tập sắp đến hạn: ' + a.title, meta: 'Hạn ' + dbDateTime(a.due_at) + ' · ' + subs.length + '/' + d.members.length + ' đã nộp', page: 'assignments', arg: { id: a.id }, label: 'Xem' });
  }
  for (const e of d.assessments) {
    const att = attBy[e.id] || [], un = att.filter((t) => t.status === 'SUBMITTED');
    if (un.length) items.push({ prio: 1, at: dbNow(), title: 'Chấm bài kiểm tra: ' + e.title, meta: un.length + ' lượt làm chờ chấm câu tự luận', page: 'assessments', arg: { id: e.id, tab: 'attempts' }, label: 'Chấm bài' });
    const o = new Date(e.open_at).getTime(), c = new Date(e.close_at).getTime(), now = dbNow();
    if (e.status === 'PUBLISHED' && o > now && o < now + 7 * 86400000) items.push({ prio: dbSchedPrio(o), at: o, title: 'Kiểm tra sắp mở: ' + e.title, meta: 'Mở lúc ' + dbDateTime(e.open_at), page: 'assessments', arg: { id: e.id }, label: 'Xem' });
    if (e.status === 'PUBLISHED' && dbAssessmentWindow(e) === 'OPEN') items.push({ prio: 2, at: c, title: 'Kiểm tra đang mở: ' + e.title, meta: 'Đóng lúc ' + dbDateTime(e.close_at) + ' · ' + att.length + ' lượt làm', page: 'assessments', arg: { id: e.id, tab: 'attempts' }, label: 'Xem' });
  }
  const drafts = d.assignments.filter((a) => a.status === 'DRAFT').length + d.assessments.filter((e) => e.status === 'DRAFT').length + d.lessons.filter((l) => l.status === 'DRAFT').length;
  if (drafts) items.push({ prio: 3, at: dbNow(), title: 'Hoàn thiện nội dung còn nháp', meta: drafts + ' bài tập / bài kiểm tra / bài học đang là bản nháp', page: 'content', arg: {}, label: 'Mở' });
  return items;
}
function dbSchedItem(x) {
  return `<div class="db-sched-item prio-${x.prio}" data-day="${x.at ? dbSchedDay(x.at) : ''}">
    <span class="db-sched-badge">${DB_SCHED_PRIO[x.prio]}</span>
    <div class="db-sched-body"><b>${h(x.title)}</b><div class="muted">${x.meta}</div></div>
    ${dbBtn(x.label, 'go', { page: x.page, ...x.arg }, 'light mini')}</div>`;
}
/* Lịch tháng: ô ngày có mốc sự kiện thì tô màu; bấm ngày để lọc danh sách việc. */
function dbSchedVisibleMonth() {
  if (!DB_SCHED_MONTH) { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); }
  const [year, month] = DB_SCHED_MONTH.split('-').map(Number);
  return new Date(year, month - 1, 1);
}
function dbSchedMoveMonth(delta) {
  const month = dbSchedVisibleMonth();
  const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
  DB_SCHED_MONTH = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0');
  DB_SCHED_SEL = '';
  render();
}
function dbSchedCalendar(items) {
  const now = new Date(), month = dbSchedVisibleMonth(), y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  const byDay = {};
  items.forEach((x) => {
    if (Number.isFinite(x.at)) {
      const key = dbSchedDay(x.at);
      (byDay[key] = byDay[key] || []).push(x);
    }
  });
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<div class="db-cal-cell empty"></div>');
  for (let day = 1; day <= days; day++) {
    const key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'), ev = byDay[key] || [];
    cells.push(`<button type="button" class="db-cal-cell${ev.length ? ' has-ev' : ''}${DB_SCHED_SEL === key ? ' sel' : ''}${key === dbSchedDay(now) ? ' today' : ''}" data-act="schedDay" data-day="${key}" aria-label="Ngày ${day}/${m + 1}/${y}, ${ev.length} việc" aria-pressed="${DB_SCHED_SEL === key}" title="${ev.length} sự kiện"><span class="db-cal-num">${day}</span>${ev.length ? `<span class="db-cal-dot">${ev.length}</span>` : ''}</button>`);
  }
  return `<section class="panel" aria-labelledby="db-h-cal">
    <div class="db-sched-month-bar">
      <h2 id="db-h-cal">Lịch tháng ${m + 1}/${y}</h2>
      <div class="db-sched-month-actions">
        <button type="button" class="btn light mini" data-act="schedMonthPrev" aria-label="Tháng trước" title="Tháng trước">‹</button>
        <button type="button" class="btn light mini" data-act="schedMonthNext" aria-label="Tháng sau" title="Tháng sau">›</button>
        ${dbBtn('Tháng hiện tại', 'schedMonthToday', {}, 'light mini')}
        ${DB_SCHED_SEL ? dbBtn('Bỏ lọc ngày', 'schedAll', {}, 'light mini') : ''}
      </div>
    </div>
    <div class="db-cal">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((x) => `<div class="db-cal-head">${x}</div>`).join('')}${cells.join('')}</div>
    <p class="muted db-hint">Chọn một ngày để xem việc cần làm. Dấu tròn cho biết số sự kiện trong ngày.</p></section>`;
}
DB_ACT.schedDay = (el) => {
  DB_SCHED_SEL = DB_SCHED_SEL === el.dataset.day ? '' : el.dataset.day;
  render();
};
DB_ACT.schedAll = () => { DB_SCHED_SEL = ''; render(); };
DB_ACT.schedMonthPrev = () => dbSchedMoveMonth(-1);
DB_ACT.schedMonthNext = () => dbSchedMoveMonth(1);
DB_ACT.schedMonthToday = () => { DB_SCHED_MONTH = ''; DB_SCHED_SEL = ''; render(); };
