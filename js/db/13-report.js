/* EducMind · js/db/13-report.js
   Trang “Báo cáo tiến bộ”:
     - Giáo viên: xem tổng hợp cả lớp hoặc chi tiết từng học sinh, xuất Excel / Word.
     - Học sinh: xem báo cáo của chính mình, xuất Excel / Word.
   Số liệu lấy từ bảng điểm, mức nắm vững, lỗ hổng và bằng chứng học tập (learning_evidence). */

let DB_REPORT_STU = '';   // '' = tổng hợp cả lớp, ngược lại là id học sinh (chỉ giáo viên)

DB_PAGES.report = {
  title: 'Báo cáo tiến bộ',
  sub: () => 'Tổng hợp điểm số, mức nắm vững, lỗ hổng và mức tham gia — xuất Excel hoặc Word.',
  async load() {
    if (!DB.classId) return {};
    const content = await dbLoadContent();
    const [assignments, assessments] = DB.course ? await Promise.all([dbCall(EducMindDB.listAssignments(DB.course.id)), dbCall(EducMindDB.listAssessments(DB.course.id))]) : [[], []];
    const objIds = content.objectives.map((o) => o.id);
    const [submissions, attempts, mastery, gaps, evidence, roster] = await Promise.all([
      dbCallIn(EducMindDB.listSubmissions, assignments.map((a) => a.id)), dbCallIn(EducMindDB.listAttempts, assessments.map((e) => e.id)),
      dbCallIn(EducMindDB.listMastery, objIds), dbCallIn(EducMindDB.listGaps, objIds), dbCallIn(EducMindDB.listEvidence, objIds),
      dbIsTeacher() ? dbLoadRoster() : { members: [], profiles: {} },
    ]);
    /* Điểm tối đa mỗi bài kiểm tra = tổng điểm các câu trong đề (bảng assessments không lưu max_score).
       Giáo viên đọc từ assessment_questions; học sinh tính từ lượt làm của chính mình (reviewAttempt). */
    const maxBy = {};
    if (dbIsTeacher()) {
      const aq = await dbCallIn(EducMindDB.listAssessmentQuestions, assessments.map((e) => e.id));
      for (const x of aq) maxBy[x.assessment_id] = (maxBy[x.assessment_id] || 0) + Number(x.weight);
    } else {
      for (const e of assessments) {
        const t = attempts.find((x) => x.assessment_id === e.id && x.status !== 'IN_PROGRESS');
        if (!t) continue;
        try {
          const rev = await dbCall(EducMindDB.reviewAttempt(t.id));
          if (rev && rev.length) maxBy[e.id] = rev.reduce((s, r) => s + Number(r.weight), 0);
        } catch (_) { /* lượt chưa xem được thì để trống */ }
      }
    }
    return { ...content, assignments, assessments, submissions, attempts, mastery, gaps, evidence, maxBy, ...roster };
  },
  view(d) {
    if (!DB.classId) return `<section class="panel">${dbEmpty('Hãy chọn một lớp để xem báo cáo.')}</section>`;
    const me = DB.me ? DB.me.id : '';
    const students = dbIsTeacher() ? d.members.map((m) => ({ id: m.student_id, name: (d.profiles[m.student_id] || {}).full_name || '—' })) : [{ id: me, name: (d.profiles || {})[me] ? d.profiles[me].full_name : 'Bản thân' }];
    const stuId = dbIsTeacher() ? DB_REPORT_STU : me;
    const rep = dbReportData(d, stuId || null);
    return `<section class="panel" aria-labelledby="db-h-rep">
      <div class="row between"><div><h2 id="db-h-rep">Báo cáo tiến bộ</h2><p class="lead">${stuId ? h((students.find((s) => s.id === stuId) || {}).name || '') : 'Tổng hợp cả lớp'} · ${dbIsTeacher() ? students.length + ' học sinh' : ''}</p></div>
        <div class="row">${dbBtn('Xuất Excel', 'reportExcel', {}, 'light')}${dbBtn('Xuất Word', 'reportWord', {}, 'light')}${dbBtn('In báo cáo', 'reportPrint', {}, 'light')}</div></div>
      ${dbIsTeacher() && students.length ? `<div class="row db-filter"><label for="db-rep-stu">Xem theo</label><select id="db-rep-stu" data-change="reportStu"><option value="">Tổng hợp cả lớp</option>${students.map((s) => `<option value="${h(s.id)}" ${s.id === stuId ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select></div>` : ''}
      ${stuId ? dbReportDetail(rep) : dbReportSummary(d, students)}
    </section>`;
  },
};
DB_ACT.reportStu = (el) => { DB_REPORT_STU = el.value; render(); };

/* ---- tính số liệu báo cáo ---- */
function dbReportData(d, stuId) {
  const pick = (rows) => (stuId ? rows.filter((x) => x.student_id === stuId) : rows);
  const subs = pick(d.submissions), atts = pick(d.attempts), mast = pick(d.mastery), gaps = pick(d.gaps), evs = pick(d.evidence);
  const now30 = dbNow() - 30 * 86400000;
  return {
    stuId, assignments: d.assignments, assessments: d.assessments, topics: d.topics, lessons: d.lessons, objectives: d.objectives,
    subs, atts, mast, gaps, evs, evs30: evs.filter((e) => new Date(e.observed_at).getTime() >= now30), profiles: d.profiles, members: d.members, maxBy: d.maxBy || {},
  };
}
/* Các số tiêu chí của một học sinh (hoặc cả lớp khi id rỗng) — dùng cho bảng tổng hợp và tệp xuất. */
function dbRepNums(d, id) {
  const r = dbReportData(d, id || null);
  const asgPct = r.assignments.map((a) => { const sub = r.subs.find((x) => x.assignment_id === a.id); return sub && sub.score != null ? (Number(sub.score) / Number(a.max_score || 10)) * 100 : null; }).filter((x) => x != null);
  const exPct = r.assessments.map((e) => { const max = r.maxBy[e.id], best = Math.max(-1, ...r.atts.filter((t) => t.assessment_id === e.id && t.total_score != null).map((t) => Number(t.total_score))); return best >= 0 && max ? (best / max) * 100 : null; }).filter((x) => x != null);
  return {
    r, submitted: r.subs.length, totalAsg: r.assignments.length,
    asgAvg: asgPct.length ? dbMean(asgPct) : null, exAvg: exPct.length ? dbMean(exPct) : null,
    masteryAvg: r.mast.length ? dbMean(r.mast.map((m) => Number(m.mastery_score))) : null,
    mastered: r.mast.filter((m) => Number(m.mastery_score) >= 0.8).length, objTotal: r.objectives.length,
    openGaps: r.gaps.filter((g) => g.status === 'OPEN').length, evs30: r.evs30.length,
  };
}
const dbRepPct = (v) => (v == null ? '—' : dbPct(v / 100));
/* Tổng hợp cả lớp: mỗi học sinh một dòng. */
function dbReportSummary(d, students) {
  const rows = students.map((s) => {
    const n = dbRepNums(d, s.id);
    return `<tr><th scope="row">${h(s.name)}</th>
      <td>${n.submitted}/${n.totalAsg}</td>
      <td>${dbRepPct(n.asgAvg)}</td>
      <td>${dbRepPct(n.exAvg)}</td>
      <td>${n.r.mast.length ? dbPct(n.masteryAvg) : '—'}</td>
      <td>${n.mastered}/${n.objTotal}</td>
      <td>${n.openGaps}</td>
      <td>${n.evs30}</td>
      <td class="db-cell-actions">${dbBtn('Chi tiết', 'reportPick', { id: s.id }, 'light mini')}</td></tr>`;
  });
  return `<div class="db-scroll">${dbTable(['Học sinh', 'Đã nộp bài tập', 'Điểm bài tập TB', 'Điểm kiểm tra TB', 'Nắm vững TB', 'Mục tiêu đạt ≥ 0,8', 'Lỗ hổng mở', 'Sự kiện 30 ngày', '<span class="sr">Xem</span>'], rows, 'Tổng hợp cả lớp')}</div>
  <p class="muted db-hint">“Mục tiêu đạt ≥ 0,8” là số mục tiêu có mức nắm vững từ 0,8 trở lên trên tổng số mục tiêu của lớp. Điểm TB là phần trăm điểm tối đa.</p>`;
}
DB_ACT.reportPick = (el) => { DB_REPORT_STU = el.dataset.id; render(); };

/* Chi tiết một học sinh: các bảng con. */
function dbReportDetail(r) {
  const byObj = dbById(r.objectives), byLesson = dbById(r.lessons);
  const asgRows = r.assignments.map((a) => { const sub = r.subs.find((x) => x.assignment_id === a.id); return `<tr><th scope="row">${h(a.title)}</th><td>${dbDate(a.due_at)}</td><td>${sub ? (sub.score == null ? 'Chưa chấm' : sub.score + '/' + a.max_score) : 'Chưa nộp'}</td></tr>`; });
  const exRows = r.assessments.map((e) => { const att = r.atts.filter((t) => t.assessment_id === e.id); const best = Math.max(-1, ...att.map((t) => t.total_score == null ? -1 : Number(t.total_score))); const max = r.maxBy[e.id]; return `<tr><th scope="row">${h(e.title)}</th><td>${att.length}</td><td>${best >= 0 ? dbNum(best) + (max ? '/' + dbNum(max) : '') : '—'}</td></tr>`; });
  const topicRows = r.topics.map((tp) => {
    const objs = r.objectives.filter((o) => (byLesson[o.lesson_id] || {}).topic_id === tp.id);
    const ms = objs.map((o) => (r.mast.find((m) => m.objective_id === o.id) || {}).mastery_score).filter((x) => x != null).map(Number);
    return `<tr><th scope="row">${h(tp.title)}</th><td>${objs.length}</td><td>${ms.length ? dbPct(dbMean(ms)) : 'Chưa có'}</td><td>${objs.filter((o) => Number(((r.mast.find((m) => m.objective_id === o.id) || {}).mastery_score) || 0) >= 0.8).length}</td></tr>`;
  });
  const gapRows = r.gaps.filter((g) => g.status === 'OPEN').map((g) => `<tr><th scope="row">${h((byObj[g.objective_id] || {}).code || '')}</th><td>${h((byObj[g.objective_id] || {}).description || '')}</td><td>${g.reason ? h(g.reason) : 'Mức nắm vững dưới 0,8'}</td></tr>`);
  return `<div class="grid db-metrics">
      ${metric('grade', 'Điểm bài tập TB', dbPct(dbMean(r.assignments.map((a) => { const sub = r.subs.find((x) => x.assignment_id === a.id); return sub && sub.score != null ? Number(sub.score) / Number(a.max_score || 10) : null; }).filter((x) => x != null)) || 0), r.subs.length + ' bài đã nộp')}
      ${metric('mastery', 'Mức nắm vững TB', dbPct(dbMean(r.mast.map((m) => Number(m.mastery_score)))), r.mast.length + ' mục tiêu có số liệu')}
      ${metric('gaps', 'Lỗ hổng đang mở', r.gaps.filter((g) => g.status === 'OPEN').length, 'cần ôn tập')}
      ${metric('clock', 'Sự kiện học tập', r.evs30.length, 'trong 30 ngày qua')}
    </div>
    <div class="cols"><section class="panel"><h3>Điểm bài tập</h3>${asgRows.length ? dbTable(['Bài tập', 'Hạn nộp', 'Điểm'], asgRows, 'Điểm bài tập') : dbEmpty('Chưa có bài tập.')}</section>
    <section class="panel"><h3>Điểm bài kiểm tra</h3>${exRows.length ? dbTable(['Bài kiểm tra', 'Số lượt làm', 'Điểm cao nhất'], exRows, 'Điểm kiểm tra') : dbEmpty('Chưa có bài kiểm tra.')}</section></div>
    <div class="cols"><section class="panel"><h3>Tiến độ theo chủ đề</h3>${topicRows.length ? dbTable(['Chủ đề', 'Số mục tiêu', 'Nắm vững TB', 'Mục tiêu đạt ≥ 0,8'], topicRows, 'Tiến độ theo chủ đề') : dbEmpty('Chưa có chủ đề.')}</section>
    <section class="panel"><h3>Lỗ hổng đang mở</h3>${gapRows.length ? dbTable(['Mục tiêu', 'Nội dung', 'Nguyên nhân'], gapRows, 'Lỗ hổng') : dbEmpty('Không có lỗ hổng nào đang mở.')}</section></div>`;
}

/* ---- xuất Excel / Word ---- */
function dbReportSheets(d, stuId) {
  const r0 = dbReportData(d, stuId || null), byObj = dbById(r0.objectives);
  const ids = stuId ? [stuId] : d.members.map((m) => m.student_id);
  const sheets = [{ name: 'Tổng hợp', headers: ['Học sinh', 'Bài tập đã nộp', 'Điểm bài tập TB', 'Điểm kiểm tra TB', 'Nắm vững TB', 'Mục tiêu đạt ≥ 0,8', 'Lỗ hổng mở', 'Sự kiện 30 ngày'], rows: ids.map((id) => {
    const n = dbRepNums(d, id);
    return [((d.profiles || {})[id] || {}).full_name || '—', n.submitted + '/' + n.totalAsg, dbRepPct(n.asgAvg), dbRepPct(n.exAvg),
      n.masteryAvg == null ? '' : Math.round(n.masteryAvg * 100) + '%', n.mastered + '/' + n.objTotal, n.openGaps, n.evs30];
  }) }];
  /* Bảng điểm lớp: mỗi học sinh một dòng, mỗi bài tập / bài kiểm tra một cột (điểm cao nhất của lượt đã chấm). */
  sheets.push({
    name: 'Bảng điểm',
    headers: ['Học sinh', ...r0.assignments.map((a) => a.title + ' (' + dbNum(a.max_score) + 'đ)'), ...r0.assessments.map((e) => e.title + (r0.maxBy[e.id] ? ' (' + dbNum(r0.maxBy[e.id]) + 'đ)' : ''))],
    rows: ids.map((id) => {
      const x = dbReportData(d, id || null);
      return [((d.profiles || {})[id] || {}).full_name || '—',
        ...r0.assignments.map((a) => { const sub = x.subs.find((s) => s.assignment_id === a.id); return sub && sub.score != null ? String(sub.score) : ''; }),
        ...r0.assessments.map((e) => { const best = Math.max(-1, ...x.atts.filter((t) => t.assessment_id === e.id && t.total_score != null).map((t) => Number(t.total_score))); return best >= 0 ? String(best) : ''; })];
    }),
  });
  if (stuId) {
    const r = r0;
    sheets.push({ name: 'Bài tập', headers: ['Bài tập', 'Hạn nộp', 'Điểm'], rows: r.assignments.map((a) => { const sub = r.subs.find((s) => s.assignment_id === a.id); return [a.title, dbDate(a.due_at), sub ? (sub.score == null ? 'Chưa chấm' : sub.score + '/' + a.max_score) : 'Chưa nộp']; }) });
    sheets.push({ name: 'Kiểm tra', headers: ['Bài kiểm tra', 'Số lượt làm', 'Điểm cao nhất'], rows: r.assessments.map((e) => { const att = r.atts.filter((t) => t.assessment_id === e.id); const best = Math.max(-1, ...att.map((t) => t.total_score == null ? -1 : Number(t.total_score))); const max = r.maxBy[e.id]; return [e.title, att.length, best >= 0 ? dbNum(best) + (max ? '/' + dbNum(max) : '') : '']; }) });
    sheets.push({ name: 'Nắm vững', headers: ['Mã mục tiêu', 'Mục tiêu', 'Mức nắm vững'], rows: r.objectives.map((o) => { const m = r.mast.find((x) => x.objective_id === o.id); return [o.code, o.description, m && m.mastery_score != null ? Number(m.mastery_score).toFixed(2) : '']; }) });
    sheets.push({ name: 'Lỗ hổng', headers: ['Mã mục tiêu', 'Mục tiêu', 'Nguyên nhân'], rows: r.gaps.filter((g) => g.status === 'OPEN').map((g) => [(byObj[g.objective_id] || {}).code || '', (byObj[g.objective_id] || {}).description || '', g.reason || 'Mức nắm vững dưới 0,8']) });
  }
  return sheets;
}
function dbReportExportCtx() {
  const d = DB.data, me = DB.me ? DB.me.id : '', stuId = dbIsTeacher() ? (DB_REPORT_STU || null) : me;
  const name = stuId ? ((d.profiles || {})[stuId] || {}).full_name || 'hoc-sinh' : 'ca-lop';
  return { d, stuId, name };
}
DB_ACT.reportExcel = () => {
  const { d, stuId, name } = dbReportExportCtx();
  DBTF.exportExcel(dbExportName('bao-cao-tien-bo-' + name.replace(/\s+/g, '-').toLowerCase(), 'xlsx'), dbReportSheets(d, stuId));
  toast('Đã xuất tệp Excel.');
};
DB_ACT.reportWord = () => {
  const { d, stuId, name } = dbReportExportCtx();
  const sections = dbReportSheets(d, stuId).map((s) => ({ heading: s.name, table: { headers: s.headers, rows: s.rows } }));
  DBTF.exportWord(dbExportName('bao-cao-tien-bo', 'doc'), 'Báo cáo tiến bộ — ' + name + ' — ' + (dbClass() || {}).name, sections);
  toast('Đã xuất tệp Word.');
};
/* In báo cáo (bản in ảo): mở hộp thoại in của trình duyệt — @media print trong CSS
   tự ẩn nút, bộ lọc và thanh điều hướng để bản in chỉ còn nội dung báo cáo. */
DB_ACT.reportPrint = () => { window.print(); };
