/* EducMind · js/db/13-report.js
   Trang “Báo cáo tiến bộ”:
     - Giáo viên: xem tổng hợp cả lớp hoặc chi tiết từng học sinh, xuất Excel / Word.
     - Học sinh: xem báo cáo của chính mình, xuất Excel / Word.
   Số liệu lấy từ bảng điểm, mức nắm vững, lỗ hổng và bằng chứng học tập (learning_evidence).
   Bản Word/Excel xuất ra theo dạng báo cáo hành chính: đầu trang đơn vị, tóm tắt, phân bố kết quả,
   học sinh cần quan tâm, mục tiêu cần củng cố, nhận xét – đề xuất, khu vực ký xác nhận. */

let DB_REPORT_STU = '';   // '' = tổng hợp cả lớp, ngược lại là id học sinh (chỉ giáo viên)

/* Các ngưỡng dùng trong báo cáo — chỉnh tại đây cho khớp quy định của trường.
   Điểm quy đổi về thang 10 (phần trăm điểm tối đa chia 10). */
const DB_REPORT_CFG = {
  masteryOk: 0.8,                       // mức nắm vững được xem là đạt
  bands: [                              // xếp loại kết quả chung theo phần trăm điểm tối đa (từ cao xuống thấp)
    { min: 80, label: 'Tốt', range: 'từ 8,0 trở lên', tone: 'good' },
    { min: 65, label: 'Khá', range: 'từ 6,5 đến dưới 8,0', tone: 'good' },
    { min: 50, label: 'Đạt', range: 'từ 5,0 đến dưới 6,5', tone: null },
    { min: 0, label: 'Chưa đạt', range: 'dưới 5,0', tone: 'bad' },
  ],
  watch: { overallBelow: 50, gapsAtLeast: 3, submitBelow: 0.7 },   // tiêu chí "cần quan tâm"
  topWeak: 5,                           // số mục tiêu cần củng cố nêu trong báo cáo
};

/* ---- thông tin đơn vị in trên báo cáo (lưu trong trình duyệt) ---- */
const DB_REPORT_ORG_KEY = 'educmind.report.org';
const DB_REPORT_ORG_FIELDS = [
  { key: 'parent', label: 'Cơ quan chủ quản', ph: 'VD: SỞ GIÁO DỤC VÀ ĐÀO TẠO …' },
  { key: 'school', label: 'Tên trường', ph: 'VD: TRƯỜNG THPT …' },
  { key: 'city', label: 'Địa danh (dòng ngày tháng)', ph: 'Tên tỉnh / thành phố' },
  { key: 'docNo', label: 'Số, ký hiệu văn bản', ph: 'VD: 12/BC-TH' },
  { key: 'term', label: 'Học kỳ', ph: 'VD: Học kỳ I' },
  { key: 'author', label: 'Người lập báo cáo', ph: 'Mặc định: tên tài khoản' },
  { key: 'position', label: 'Chức danh', ph: 'Giáo viên bộ môn' },
  { key: 'recipient', label: 'Kính gửi', ph: 'Tổ trưởng chuyên môn và Ban Giám hiệu nhà trường' },
];
function dbRepOrgLoad() { try { return JSON.parse(localStorage.getItem(DB_REPORT_ORG_KEY) || '{}') || {}; } catch (_) { return {}; } }
function dbRepOrgSave(o) { try { localStorage.setItem(DB_REPORT_ORG_KEY, JSON.stringify(o)); } catch (_) { /* bỏ qua nếu bị chặn lưu trữ */ } }
function dbRepOrg() {
  const o = dbRepOrgLoad(), me = DB.me || {};
  return {
    parent: o.parent || '', school: o.school || '', city: o.city || '', docNo: o.docNo || '',
    subject: DB.course && DB.course.title ? DB.course.title.trim() : 'Chưa thiết lập', term: o.term || '',
    author: o.author || me.full_name || me.email || '',
    position: o.position || 'Giáo viên bộ môn',
    recipient: o.recipient || 'Tổ trưởng chuyên môn và Ban Giám hiệu nhà trường',
  };
}
DB_ACT.reportOrg = (el) => { const o = dbRepOrgLoad(); o[el.dataset.field] = String(el.value || '').trim(); dbRepOrgSave(o); };
function dbRepOrgForm() {
  if (!dbIsTeacher()) return '';
  const o = dbRepOrgLoad();
  return `<details class="db-org" style="margin:.5rem 0 1rem"><summary>Thông tin đơn vị in trên báo cáo</summary>
    <p class="muted db-hint">Nhập một lần; trình duyệt này sẽ ghi nhớ và tự điền vào đầu báo cáo Word / Excel.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:.6rem">${DB_REPORT_ORG_FIELDS.map((f) => `<label style="display:grid;gap:.2rem"><span>${h(f.label)}</span><input type="text" data-change="reportOrg" data-field="${f.key}" value="${h(o[f.key] || '')}" placeholder="${h(f.ph)}"></label>`).join('')}</div></details>`;
}

DB_PAGES.report = {
  title: 'Báo cáo tiến bộ',
  sub: () => 'Tổng hợp điểm số, mức nắm vững, lỗ hổng và mức tham gia — xuất Excel hoặc Word.',
  async load() {
    if (!DB.classId) return {};
    const content = await dbLoadContent();
    const [activeAssignments, deletedAssignments, activeAssessments, deletedAssessments] = DB.course
      ? await Promise.all([
          dbCall(EducMindDB.listAssignments(DB.course.id)),
          dbCall(EducMindDB.listDeletedAssignmentRows(DB.course.id)),
          dbCall(EducMindDB.listAssessments(DB.course.id)),
          dbCall(EducMindDB.listDeletedAssessments(DB.course.id)),
        ])
      : [[], [], [], []];
    const assignments = [...activeAssignments, ...deletedAssignments];
    const assessments = [...activeAssessments, ...deletedAssessments];
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
    const students = dbIsTeacher() ? d.members.map((m) => ({ id: m.student_id, name: (d.profiles[m.student_id] || {}).full_name || '—' })) : [{ id: me, name: dbRepName(d, me) }];
    const stuId = dbIsTeacher() ? DB_REPORT_STU : me;
    const rep = dbReportData(d, stuId || null);
    return `<section class="panel" aria-labelledby="db-h-rep">
      <div class="row between db-report-header"><div><p class="lead">Môn học: ${h(DB.course && DB.course.title || 'Chưa thiết lập')} · ${stuId ? h((students.find((s) => s.id === stuId) || {}).name || '') : 'Tổng hợp cả lớp'} ${dbIsTeacher() ? students.length + ' học sinh' : ''}</p></div>
        <div class="row">${dbBtn('Xuất Excel', 'reportExcel', {}, 'light')}${dbBtn('Xuất Word', 'reportWord', {}, 'light')}</div></div>
      ${dbRepOrgForm()}
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
/* Tên học sinh; học sinh tự xem báo cáo thì lấy từ tài khoản (bảng hồ sơ lớp không tải cho học sinh). */
function dbRepName(d, id) {
  const p = (d.profiles || {})[id];
  if (p && p.full_name) return p.full_name;
  if (DB.me && DB.me.id === id) return DB.me.full_name || DB.me.email || 'Bản thân';
  return '—';
}
/* Xếp loại theo phần trăm điểm tối đa (0–100). */
function dbRepBand(pct) { return DB_REPORT_CFG.bands.find((b) => pct >= b.min) || DB_REPORT_CFG.bands[DB_REPORT_CFG.bands.length - 1]; }
/* Các số tiêu chí của một học sinh (hoặc cả lớp khi id rỗng) — dùng cho bảng tổng hợp và tệp xuất. */
function dbRepNums(d, id) {
  const r = dbReportData(d, id || null), W = DB_REPORT_CFG.watch;
  const asgPct = r.assignments.map((a) => { const sub = r.subs.find((x) => x.assignment_id === a.id); return sub && sub.score != null ? (Number(sub.score) / Number(a.max_score || 10)) * 100 : null; }).filter((x) => x != null);
  const exPct = r.assessments.map((e) => { const max = r.maxBy[e.id], best = Math.max(-1, ...r.atts.filter((t) => t.assessment_id === e.id && t.total_score != null).map((t) => Number(t.total_score))); return best >= 0 && max ? (best / max) * 100 : null; }).filter((x) => x != null);
  const n = {
    r, submitted: r.subs.length, totalAsg: r.assignments.length,
    asgAvg: asgPct.length ? dbMean(asgPct) : null, exAvg: exPct.length ? dbMean(exPct) : null,
    masteryAvg: r.mast.length ? dbMean(r.mast.map((m) => Number(m.mastery_score))) : null,
    mastered: r.mast.filter((m) => Number(m.mastery_score) >= DB_REPORT_CFG.masteryOk).length, objTotal: r.objectives.length,
    openGaps: r.gaps.filter((g) => g.status === 'OPEN').length, evs30: r.evs30.length,
  };
  /* Kết quả chung = trung bình cộng của điểm bài tập TB và điểm kiểm tra TB (những phần đã có dữ liệu). */
  const parts = [n.asgAvg, n.exAvg].filter((x) => x != null);
  n.overall = parts.length ? dbMean(parts) : null;
  n.band = n.overall == null ? null : dbRepBand(n.overall);
  n.submitRate = n.totalAsg ? n.submitted / n.totalAsg : null;
  n.reasons = [];
  if (n.overall != null && n.overall < W.overallBelow) n.reasons.push('Điểm chung ' + dbRepS(n.overall) + '/10, ' + dbRepBand(n.overall).label.toLowerCase());
  if (n.openGaps >= W.gapsAtLeast) n.reasons.push(n.openGaps + ' lỗ hổng kiến thức đang mở');
  if (n.submitRate != null && n.submitRate < W.submitBelow) n.reasons.push('Mới nộp ' + n.submitted + '/' + n.totalAsg + ' bài tập');
  return n;
}
/* Định dạng số cho báo cáo: điểm thang 10 một chữ số thập phân, dấu phẩy kiểu Việt Nam. */
const dbRepS = (pct) => (pct == null ? '' : (Math.round(pct) / 10).toFixed(1).replace('.', ','));
const dbRepPctTxt = (v01) => (v01 == null ? '' : Math.round(v01 * 100) + '%');
const dbRepSc = (pct) => (pct == null ? '' : { v: Math.round(pct) / 10, fmt: 'score', tone: pct < DB_REPORT_CFG.watch.overallBelow ? 'bad' : undefined });
const dbRepPc = (v01) => (v01 == null ? '' : { v: v01, fmt: 'pct' });
const dbRepPct = (v) => (v == null ? '—' : dbPct(v / 100));
const dbRepBandCell = (b) => (b ? { v: b.label, tone: b.tone || undefined, align: 'center' } : '');

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
    return `<tr><th scope="row">${h(tp.title)}</th><td>${objs.length}</td><td>${ms.length ? dbPct(dbMean(ms)) : 'Chưa có'}</td><td>${objs.filter((o) => Number(((r.mast.find((m) => m.objective_id === o.id) || {}).mastery_score) || 0) >= DB_REPORT_CFG.masteryOk).length}</td></tr>`;
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

/* ================= MÔ HÌNH SỐ LIỆU CHO TỆP XUẤT ================= */

/* Thống kê toàn lớp (chỉ giáo viên). */
function dbRepClassStats(d) {
  const per = d.members.map((m) => ({ id: m.student_id, name: dbRepName(d, m.student_id), n: dbRepNums(d, m.student_id) }));
  const avg = (f) => { const a = per.map(f).filter((x) => x != null); return a.length ? dbMean(a) : null; };
  const withData = per.filter((p) => p.n.overall != null);
  const totalAsg = d.assignments.length, totalSub = per.reduce((s, p) => s + p.n.submitted, 0);
  return {
    per, count: per.length, withData: withData.length,
    asgAvg: avg((p) => p.n.asgAvg), exAvg: avg((p) => p.n.exAvg), overall: avg((p) => p.n.overall), masteryAvg: avg((p) => p.n.masteryAvg),
    totalSub, missing: Math.max(0, totalAsg * per.length - totalSub), submitRate: totalAsg && per.length ? totalSub / (totalAsg * per.length) : null,
    dist: DB_REPORT_CFG.bands.map((b) => ({ band: b, count: withData.filter((p) => p.n.band === b).length })),
    watch: per.filter((p) => p.n.reasons.length),
  };
}
/* Mức nắm vững theo từng mục tiêu của cả lớp. */
function dbRepObjectiveRows(d) {
  const byLesson = dbById(d.lessons), byTopic = dbById(d.topics), ok = DB_REPORT_CFG.masteryOk;
  return d.objectives.map((o) => {
    const ms = d.mastery.filter((m) => m.objective_id === o.id && m.mastery_score != null).map((m) => Number(m.mastery_score));
    const lesson = byLesson[o.lesson_id] || {}, topic = byTopic[lesson.topic_id] || {};
    return { o, topic: topic.title || '', n: ms.length, avg: ms.length ? dbMean(ms) : null, reach: ms.filter((x) => x >= ok).length, gaps: d.gaps.filter((g) => g.objective_id === o.id && g.status === 'OPEN').length };
  });
}
const dbRepToneOf = (v01) => (v01 == null ? undefined : v01 >= DB_REPORT_CFG.masteryOk ? 'good' : v01 < 0.5 ? 'bad' : 'warn');

/* Nhận xét tự động từ số liệu (câu có căn cứ, giáo viên có thể bổ sung thêm trong tệp Word). */
function dbRepClassText(d, st, objRows) {
  const obs = [], rec = [];
  obs.push(`Lớp có ${st.count} học sinh; ${st.withData} học sinh đã có điểm bài tập hoặc bài kiểm tra được ghi nhận.`);
  if (st.asgAvg != null || st.exAvg != null) obs.push([st.asgAvg != null ? `Điểm bài tập trung bình là ${dbRepS(st.asgAvg)}/10` : 'Chưa có điểm bài tập', st.exAvg != null ? `điểm kiểm tra trung bình là ${dbRepS(st.exAvg)}/10` : 'chưa có điểm kiểm tra'].join('; ') + '.');
  if (st.withData) obs.push('Phân bố kết quả chung: ' + st.dist.map((x) => `${x.band.label} ${x.count} học sinh`).join(', ') + '.');
  if (st.submitRate != null) obs.push(`Tỉ lệ nộp bài tập toàn lớp đạt ${dbRepPctTxt(st.submitRate)} (${st.totalSub}/${d.assignments.length * st.count} bài).`);
  if (st.masteryAvg != null) obs.push(`Mức nắm vững trung bình của lớp là ${dbRepPctTxt(st.masteryAvg)} trên các mục tiêu đã có dữ liệu.`);
  const weak = objRows.filter((x) => x.avg != null && x.avg < DB_REPORT_CFG.masteryOk).sort((a, b) => a.avg - b.avg).slice(0, DB_REPORT_CFG.topWeak);
  if (weak.length) rec.push('Tổ chức ôn tập, củng cố các mục tiêu có mức nắm vững thấp: ' + weak.map((x) => `${x.o.code} (${dbRepPctTxt(x.avg)})`).join(', ') + '.');
  if (st.watch.length) rec.push(`Theo dõi và hỗ trợ riêng ${st.watch.length} học sinh thuộc danh sách cần quan tâm (mục IV).`);
  if (st.missing > 0) rec.push(`Nhắc nhở, tạo điều kiện để học sinh hoàn thành ${st.missing} bài tập còn thiếu.`);
  if (!rec.length) rec.push('Duy trì nhịp độ học tập hiện tại và tiếp tục theo dõi định kỳ.');
  return { obs, rec, weak };
}
function dbRepStudentText(n, name) {
  const obs = [], rec = [], r = n.r;
  obs.push(`Học sinh ${name} đã nộp ${n.submitted}/${n.totalAsg} bài tập.`);
  if (n.asgAvg != null || n.exAvg != null) obs.push([n.asgAvg != null ? `Điểm bài tập trung bình ${dbRepS(n.asgAvg)}/10` : 'Chưa có điểm bài tập', n.exAvg != null ? `điểm kiểm tra trung bình ${dbRepS(n.exAvg)}/10` : 'chưa có điểm kiểm tra'].join('; ') + (n.band ? `; xếp loại chung: ${n.band.label}.` : '.'));
  if (n.masteryAvg != null) obs.push(`Mức nắm vững trung bình ${dbRepPctTxt(n.masteryAvg)}; ${n.mastered}/${n.objTotal} mục tiêu đạt từ 0,8 trở lên.`);
  const byObj = dbById(r.objectives), openG = r.gaps.filter((g) => g.status === 'OPEN');
  if (openG.length) rec.push('Ôn tập các mục tiêu còn lỗ hổng: ' + openG.map((g) => (byObj[g.objective_id] || {}).code || '').filter(Boolean).join(', ') + '.');
  if (n.totalAsg - n.submitted > 0) rec.push(`Hoàn thành ${n.totalAsg - n.submitted} bài tập chưa nộp.`);
  if (!rec.length) rec.push('Tiếp tục duy trì kết quả học tập hiện tại.');
  return { obs, rec };
}

/* Ghi chú cách tính (dùng chung cho Excel và Word). */
function dbRepNotes() {
  const C = DB_REPORT_CFG, W = C.watch;
  return [
    ['Thang điểm', 'Điểm trung bình được quy đổi về thang 10 (phần trăm điểm tối đa chia 10).'],
    ['Điểm bài tập TB', 'Trung bình phần trăm điểm đạt được trên điểm tối đa của các bài tập đã chấm.'],
    ['Điểm kiểm tra TB', 'Trung bình phần trăm điểm cao nhất ở mỗi bài kiểm tra đã làm.'],
    ['Điểm TB chung', 'Trung bình cộng của điểm bài tập TB và điểm kiểm tra TB (phần nào đã có dữ liệu).'],
    ['Xếp loại', C.bands.map((b) => `${b.label}: ${b.range}`).join('; ') + '. Ngưỡng cấu hình trong DB_REPORT_CFG, cần đối chiếu quy định của nhà trường.'],
    ['Nắm vững TB', 'Trung bình mức nắm vững của các mục tiêu đã có dữ liệu.'],
    ['Mục tiêu đạt ≥ 0,8', 'Số mục tiêu có mức nắm vững từ 0,8 trở lên trên tổng số mục tiêu.'],
    ['Lỗ hổng mở', 'Số lỗ hổng kiến thức đang ở trạng thái mở.'],
    ['Sự kiện 30 ngày', 'Số sự kiện học tập được ghi nhận trong 30 ngày gần nhất.'],
    ['Học sinh cần quan tâm', `Có ít nhất một dấu hiệu: điểm chung dưới ${dbRepS(W.overallBelow)}/10; từ ${W.gapsAtLeast} lỗ hổng mở trở lên; tỉ lệ nộp bài tập dưới ${Math.round(W.submitBelow * 100)}%.`],
    ['Ô trống / dấu —', 'Chưa có dữ liệu phù hợp để tính hoặc chưa có kết quả được ghi nhận (chưa nộp / chưa chấm).'],
  ];
}

/* ---- bối cảnh xuất: thông tin đơn vị, người lập, ngày lập ---- */
function dbReportExportCtx() {
  const d = DB.data, me = DB.me ? DB.me.id : '', stuId = dbIsTeacher() ? (DB_REPORT_STU || null) : me;
  const org = dbRepOrg(), teacher = dbIsTeacher();
  const name = stuId ? dbRepName(d, stuId) : 'Cả lớp';
  const className = (dbClass() || {}).name || DB.classId;
  const now = new Date(), p2 = (n) => String(n).padStart(2, '0');
  const generatedAt = now.toLocaleString('vi-VN');
  const dateLong = `ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  const placeDate = (org.city ? org.city + ', ' : '') + dateLong;
  const y0 = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const schoolYear = y0 + '–' + (y0 + 1);
  const scope = stuId ? 'Học sinh: ' + name : 'Tổng hợp toàn lớp';
  const title = 'BÁO CÁO TIẾN ĐỘ HỌC TẬP';
  const subtitle = `Môn ${org.subject} · Lớp ${className} · ${stuId ? 'Học sinh ' + name : 'Tổng hợp toàn lớp'} · Năm học ${schoolYear}${org.term ? ' · ' + org.term : ''}`;
  const recipients = teacher ? ['Tổ trưởng chuyên môn;', 'Ban Giám hiệu nhà trường;', 'Lưu: hồ sơ chuyên môn.'] : ['Hồ sơ học tập cá nhân.'];
  const metadata = [
    ['Đơn vị', org.school || ''],
    ['Môn học', org.subject],
    ['Lớp', className],
    ['Phạm vi báo cáo', scope],
    ['Năm học' + (org.term ? ' / học kỳ' : ''), schoolYear + (org.term ? ' · ' + org.term : '')],
    ['Người lập báo cáo', teacher ? org.author + (org.author && org.position ? ' – ' + org.position : '') : ((DB.me && (DB.me.full_name || DB.me.email)) || '')],
    ['Ngày lập', generatedAt],
    ['Nơi nhận', teacher ? 'Tổ trưởng chuyên môn; Ban Giám hiệu nhà trường' : 'Hồ sơ học tập cá nhân'],
  ].filter((m) => m[1] !== '');
  return { d, stuId, name, className, org, teacher, generatedAt, placeDate, schoolYear, scope, title, subtitle, recipients, metadata };
}

/* ================= EXCEL ================= */
function dbReportSheets(d, stuId, ctx) {
  const notes = dbRepNotes();
  const noteSheet = { name: 'Ghi chú', title: 'GHI CHÚ CÁCH TÍNH', headers: ['Chỉ số', 'Cách hiểu'], rows: notes, widths: [24, 90], filter: false };
  return stuId ? dbRepSheetsStudent(d, stuId, noteSheet) : dbRepSheetsClass(d, noteSheet);
}
function dbRepSheetsClass(d, noteSheet) {
  const st = dbRepClassStats(d), objRows = dbRepObjectiveRows(d), C = DB_REPORT_CFG;
  const sheets = [];
  /* 1. Tổng quan */
  const kv = (label, v, note) => [label, v, note];
  sheets.push({
    name: 'Tổng quan', title: 'TỔNG QUAN KẾT QUẢ HỌC TẬP', headers: ['Chỉ số', 'Giá trị', 'Diễn giải'], align: ['left', 'center', 'left'], widths: [34, 14, 60], filter: false,
    rows: [
      { section: 'CHỈ SỐ CHUNG' },
      kv('Số học sinh', { v: st.count, fmt: 'int' }, 'Tổng số học sinh trong lớp'),
      kv('Số học sinh đã có điểm', { v: st.withData, fmt: 'int' }, 'Có điểm bài tập hoặc bài kiểm tra'),
      kv('Số bài tập đã giao', { v: d.assignments.length, fmt: 'int' }, ''),
      kv('Số bài kiểm tra', { v: d.assessments.length, fmt: 'int' }, ''),
      kv('Số mục tiêu học tập', { v: d.objectives.length, fmt: 'int' }, ''),
      kv('Tỉ lệ nộp bài tập', dbRepPc(st.submitRate), 'Số bài đã nộp / số bài đã giao cho cả lớp'),
      kv('Điểm bài tập TB (thang 10)', dbRepSc(st.asgAvg), 'Trung bình các học sinh có điểm'),
      kv('Điểm kiểm tra TB (thang 10)', dbRepSc(st.exAvg), 'Trung bình các học sinh có điểm'),
      kv('Điểm TB chung (thang 10)', dbRepSc(st.overall), 'Trung bình cộng điểm bài tập và kiểm tra'),
      kv('Mức nắm vững TB', dbRepPc(st.masteryAvg), 'Trên các mục tiêu đã có dữ liệu'),
      kv('Học sinh cần quan tâm', { v: st.watch.length, fmt: 'int', tone: st.watch.length ? 'warn' : undefined }, 'Xem trang “Cần hỗ trợ”'),
      { section: 'PHÂN BỐ KẾT QUẢ CHUNG' },
      ...st.dist.map((x) => kv(`${x.band.label} (${x.band.range})`, { v: x.count, fmt: 'int', tone: x.band.tone || undefined }, st.withData ? dbRepPctTxt(x.count / st.withData) + ' số học sinh đã có điểm' : '')),
    ],
  });
  /* 2. Tổng hợp từng học sinh */
  const sumRow = (lab, f) => ['', lab, '', f(0), f(1), f(2), '', f(3), '', '', '', ''];
  sheets.push({
    name: 'Tổng hợp', title: 'KẾT QUẢ TỪNG HỌC SINH', signBlock: true,
    headers: ['STT', 'Học sinh', 'Bài tập đã nộp', 'Điểm bài tập TB (/10)', 'Điểm kiểm tra TB (/10)', 'Điểm TB chung (/10)', 'Xếp loại', 'Nắm vững TB', 'Mục tiêu đạt ≥ 0,8', 'Lỗ hổng mở', 'Sự kiện 30 ngày', 'Ghi chú'],
    align: ['center', 'left', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'left'],
    widths: [6, 28, 12, 14, 14, 14, 12, 12, 14, 10, 12, 44],
    rows: st.per.map((p, i) => [i + 1, p.name, p.n.submitted + '/' + p.n.totalAsg, dbRepSc(p.n.asgAvg), dbRepSc(p.n.exAvg), dbRepSc(p.n.overall), dbRepBandCell(p.n.band),
      dbRepPc(p.n.masteryAvg), p.n.mastered + '/' + p.n.objTotal, { v: p.n.openGaps, fmt: 'int' }, { v: p.n.evs30, fmt: 'int' }, p.n.reasons.join('; ')]),
    summaryRows: [sumRow('Trung bình lớp', (k) => [dbRepSc(st.asgAvg), dbRepSc(st.exAvg), dbRepSc(st.overall), dbRepPc(st.masteryAvg)][k])],
  });
  /* 3. Bảng điểm */
  const asgScore = (id, a) => { const sub = dbReportData(d, id).subs.find((s) => s.assignment_id === a.id); return sub && sub.score != null ? Number(sub.score) : ''; };
  const exScore = (id, e) => { const best = Math.max(-1, ...dbReportData(d, id).atts.filter((t) => t.assessment_id === e.id && t.total_score != null).map((t) => Number(t.total_score))); return best >= 0 ? best : ''; };
  const gradeRows = st.per.map((p, i) => [i + 1, p.name, ...d.assignments.map((a) => asgScore(p.id, a)), ...d.assessments.map((e) => exScore(p.id, e))]);
  const cols = d.assignments.length + d.assessments.length;
  const colVals = Array.from({ length: cols }, (_, c) => gradeRows.map((r) => r[2 + c]).filter((v) => typeof v === 'number'));
  const agg = (lab, f) => ['', lab, ...colVals.map((v) => (v.length ? { v: f(v), fmt: 'score2' } : ''))];
  sheets.push({
    name: 'Bảng điểm', title: 'BẢNG ĐIỂM CHI TIẾT',
    headers: ['STT', 'Học sinh', ...d.assignments.map((a) => a.title + ' (' + dbNum(a.max_score) + 'đ)'), ...d.assessments.map((e) => e.title + (d.maxBy[e.id] ? ' (' + dbNum(d.maxBy[e.id]) + 'đ)' : ''))],
    align: ['center', 'left'], rows: gradeRows, widths: [6, 28],
    summaryRows: [agg('Trung bình', (v) => v.reduce((a, b) => a + b, 0) / v.length), agg('Cao nhất', (v) => Math.max(...v)), agg('Thấp nhất', (v) => Math.min(...v))],
    notes: ['Điểm bài tập là điểm đã chấm; điểm bài kiểm tra là lượt làm có điểm cao nhất. Ô trống: chưa nộp, chưa chấm hoặc chưa làm.'],
  });
  /* 4. Mục tiêu */
  sheets.push({
    name: 'Mục tiêu', title: 'MỨC NẮM VỮNG THEO MỤC TIÊU HỌC TẬP',
    headers: ['STT', 'Mã mục tiêu', 'Chủ đề', 'Mục tiêu', 'Số HS có dữ liệu', 'Nắm vững TB', 'Số HS đạt ≥ 0,8', 'Tỉ lệ đạt', 'Lỗ hổng mở'],
    align: ['center', 'center', 'left', 'left', 'center', 'center', 'center', 'center', 'center'], widths: [6, 14, 26, 60, 12, 12, 12, 11, 10],
    rows: objRows.map((x, i) => [i + 1, x.o.code, x.topic, x.o.description, { v: x.n, fmt: 'int' }, x.avg == null ? '' : { v: x.avg, fmt: 'pct', tone: dbRepToneOf(x.avg) }, { v: x.reach, fmt: 'int' }, x.n ? { v: x.reach / x.n, fmt: 'pct' } : '', { v: x.gaps, fmt: 'int' }]),
    notes: ['Màu nền cột “Nắm vững TB”: xanh từ 0,8 trở lên; vàng từ 0,5 đến dưới 0,8; đỏ dưới 0,5.'],
  });
  /* 5. Cần hỗ trợ */
  sheets.push({
    name: 'Cần hỗ trợ', title: 'HỌC SINH CẦN QUAN TÂM, HỖ TRỢ',
    headers: ['STT', 'Học sinh', 'Điểm TB chung (/10)', 'Xếp loại', 'Bài tập đã nộp', 'Lỗ hổng mở', 'Lý do'],
    align: ['center', 'left', 'center', 'center', 'center', 'center', 'left'], widths: [6, 28, 14, 12, 14, 11, 60],
    rows: st.watch.length ? st.watch.map((p, i) => [i + 1, p.name, dbRepSc(p.n.overall), dbRepBandCell(p.n.band), p.n.submitted + '/' + p.n.totalAsg, { v: p.n.openGaps, fmt: 'int' }, p.n.reasons.join('; ')]) : [{ section: 'Không có học sinh nào thuộc diện cần quan tâm theo các tiêu chí ở trang “Ghi chú”.' }],
  });
  sheets.push(noteSheet);
  return sheets;
}
function dbRepSheetsStudent(d, stuId, noteSheet) {
  const n = dbRepNums(d, stuId), r = n.r, byObj = dbById(r.objectives), byLesson = dbById(r.lessons), byTopic = dbById(r.topics);
  const text = dbRepStudentText(n, dbRepName(d, stuId));
  const sheets = [];
  sheets.push({
    name: 'Tổng quan', title: 'TỔNG QUAN KẾT QUẢ HỌC TẬP', headers: ['Chỉ số', 'Giá trị', 'Diễn giải'], align: ['left', 'center', 'left'], widths: [34, 16, 60], filter: false,
    rows: [
      { section: 'CHỈ SỐ CHUNG' },
      ['Bài tập đã nộp', n.submitted + '/' + n.totalAsg, ''],
      ['Điểm bài tập TB (thang 10)', dbRepSc(n.asgAvg), 'Trung bình các bài tập đã chấm'],
      ['Điểm kiểm tra TB (thang 10)', dbRepSc(n.exAvg), 'Trung bình điểm cao nhất mỗi bài kiểm tra'],
      ['Điểm TB chung (thang 10)', dbRepSc(n.overall), ''],
      ['Xếp loại', dbRepBandCell(n.band), ''],
      ['Mức nắm vững TB', dbRepPc(n.masteryAvg), ''],
      ['Mục tiêu đạt ≥ 0,8', n.mastered + '/' + n.objTotal, ''],
      ['Lỗ hổng đang mở', { v: n.openGaps, fmt: 'int', tone: n.openGaps ? 'warn' : undefined }, ''],
      ['Sự kiện học tập 30 ngày', { v: n.evs30, fmt: 'int' }, ''],
      { section: 'NHẬN XÉT' },
      ...text.obs.map((t) => ['', '', t]),
      { section: 'ĐỀ XUẤT' },
      ...text.rec.map((t) => ['', '', t]),
    ],
  });
  sheets.push({
    name: 'Bài tập', title: 'KẾT QUẢ BÀI TẬP', headers: ['STT', 'Bài tập', 'Hạn nộp', 'Điểm', 'Điểm tối đa', 'Trạng thái'], align: ['center', 'left', 'center', 'center', 'center', 'center'], widths: [6, 44, 14, 10, 12, 14],
    rows: r.assignments.map((a, i) => { const sub = r.subs.find((s) => s.assignment_id === a.id); return [i + 1, a.title, dbDate(a.due_at), sub && sub.score != null ? Number(sub.score) : '', { v: Number(a.max_score || 10), fmt: 'int' }, sub ? (sub.score == null ? { v: 'Chưa chấm', tone: 'warn' } : 'Đã chấm') : { v: 'Chưa nộp', tone: 'bad' }]; }),
  });
  sheets.push({
    name: 'Kiểm tra', title: 'KẾT QUẢ BÀI KIỂM TRA', headers: ['STT', 'Bài kiểm tra', 'Số lượt làm', 'Điểm cao nhất', 'Điểm tối đa'], align: ['center', 'left', 'center', 'center', 'center'], widths: [6, 44, 12, 14, 12],
    rows: r.assessments.map((e, i) => { const att = r.atts.filter((t) => t.assessment_id === e.id); const best = Math.max(-1, ...att.map((t) => (t.total_score == null ? -1 : Number(t.total_score)))); const max = r.maxBy[e.id]; return [i + 1, e.title, { v: att.length, fmt: 'int' }, best >= 0 ? best : '', max ? Number(max) : '']; }),
  });
  sheets.push({
    name: 'Nắm vững', title: 'MỨC NẮM VỮNG THEO MỤC TIÊU', headers: ['STT', 'Mã mục tiêu', 'Chủ đề', 'Mục tiêu', 'Mức nắm vững'], align: ['center', 'center', 'left', 'left', 'center'], widths: [6, 14, 26, 60, 14],
    rows: r.objectives.map((o, i) => { const m = r.mast.find((x) => x.objective_id === o.id); const v = m && m.mastery_score != null ? Number(m.mastery_score) : null; return [i + 1, o.code, (byTopic[(byLesson[o.lesson_id] || {}).topic_id] || {}).title || '', o.description, v == null ? '' : { v, fmt: 'pct', tone: dbRepToneOf(v) }]; }),
    notes: ['Màu nền: xanh từ 0,8 trở lên; vàng từ 0,5 đến dưới 0,8; đỏ dưới 0,5.'],
  });
  sheets.push({
    name: 'Lỗ hổng', title: 'LỖ HỔNG KIẾN THỨC ĐANG MỞ', headers: ['STT', 'Mã mục tiêu', 'Mục tiêu', 'Nguyên nhân'], align: ['center', 'center', 'left', 'left'], widths: [6, 14, 60, 40],
    rows: r.gaps.filter((g) => g.status === 'OPEN').length ? r.gaps.filter((g) => g.status === 'OPEN').map((g, i) => [i + 1, (byObj[g.objective_id] || {}).code || '', (byObj[g.objective_id] || {}).description || '', g.reason || 'Mức nắm vững dưới 0,8']) : [{ section: 'Không có lỗ hổng nào đang mở.' }],
  });
  sheets.push(noteSheet);
  return sheets;
}

DB_ACT.reportExcel = () => {
  const ctx = dbReportExportCtx(), { d, stuId, name, title, subtitle, metadata, org, teacher, recipients } = ctx;
  const fileBase = dbSafeFileName('bao-cao-tien-do-' + name.replace(/\s+/g, '-').toLowerCase());
  DBTF.exportExcel(dbExportName(fileBase, 'xlsx'), dbReportSheets(d, stuId, ctx), {
    title, subtitle, metadata, orgName: org.school ? (org.parent ? org.parent + ' – ' : '') + org.school : '', author: org.author || 'EducMind',
    subject: 'Báo cáo tiến độ học tập',
    signatures: teacher ? [{ title: 'GIÁO VIÊN LẬP BÁO CÁO', name: org.author }, { title: 'TỔ TRƯỞNG CHUYÊN MÔN' }, { title: 'BAN GIÁM HIỆU' }] : [{ title: 'HỌC SINH', name: name }, { title: 'GIÁO VIÊN XÁC NHẬN' }],
  });
  toast('Đã xuất tệp Excel.');
};

/* ================= WORD ================= */
function dbReportSections(d, stuId, ctx) {
  return stuId ? dbRepWordStudent(d, stuId, ctx) : dbRepWordClass(d, ctx);
}
function dbRepWordClass(d, ctx) {
  const st = dbRepClassStats(d), objRows = dbRepObjectiveRows(d), text = dbRepClassText(d, st, objRows), org = ctx.org;
  const secs = [];
  secs.push({
    heading: 'I. THÔNG TIN CHUNG',
    paragraphs: [`Căn cứ dữ liệu học tập ghi nhận trên hệ thống EducMind đến ${ctx.generatedAt}, giáo viên bộ môn ${org.subject} báo cáo kết quả học tập của lớp ${ctx.className} (năm học ${ctx.schoolYear}${org.term ? ', ' + org.term : ''}) như sau:`],
    keyValue: [['Lớp', ctx.className], ['Môn học', org.subject], ['Số học sinh', st.count], ['Số bài tập đã giao', d.assignments.length], ['Số bài kiểm tra', d.assessments.length], ['Số mục tiêu học tập', d.objectives.length]],
  });
  secs.push({
    heading: 'II. KẾT QUẢ CHUNG',
    kpis: [
      { label: 'Điểm bài tập TB', value: st.asgAvg == null ? '—' : dbRepS(st.asgAvg), note: 'thang 10' },
      { label: 'Điểm kiểm tra TB', value: st.exAvg == null ? '—' : dbRepS(st.exAvg), note: 'thang 10' },
      { label: 'Tỉ lệ nộp bài tập', value: st.submitRate == null ? '—' : dbRepPctTxt(st.submitRate), note: st.totalSub + ' bài đã nộp' },
      { label: 'Nắm vững TB', value: st.masteryAvg == null ? '—' : dbRepPctTxt(st.masteryAvg), note: 'các mục tiêu có dữ liệu' },
    ],
    table: {
      headers: ['Mức kết quả chung', 'Khoảng điểm (thang 10)', 'Số học sinh', 'Tỉ lệ'], align: ['left', 'left', 'center', 'center'], widths: [30, 34, 18, 18],
      rows: st.dist.map((x) => [{ v: x.band.label, tone: x.band.tone || undefined }, x.band.range, { v: x.count, fmt: 'int' }, st.withData ? { v: x.count / st.withData, fmt: 'pct' } : '']),
      summaryRows: [['Tổng số học sinh đã có điểm', '', { v: st.withData, fmt: 'int' }, st.withData ? { v: 1, fmt: 'pct' } : '']],
    },
    bullets: text.obs,
  });
  secs.push({
    heading: 'III. KẾT QUẢ TỪNG HỌC SINH',
    table: {
      headers: ['STT', 'Học sinh', 'Bài tập nộp', 'Điểm BT (/10)', 'Điểm KT (/10)', 'Điểm chung (/10)', 'Xếp loại', 'Nắm vững', 'Lỗ hổng mở'],
      align: ['center', 'left', 'center', 'center', 'center', 'center', 'center', 'center', 'center'], widths: [5, 25, 9, 10, 10, 10, 11, 10, 10],
      rows: st.per.map((p, i) => [i + 1, p.name, p.n.submitted + '/' + p.n.totalAsg, dbRepSc(p.n.asgAvg), dbRepSc(p.n.exAvg), dbRepSc(p.n.overall), dbRepBandCell(p.n.band), dbRepPc(p.n.masteryAvg), { v: p.n.openGaps, fmt: 'int' }]),
      summaryRows: [['', 'Trung bình lớp', '', dbRepSc(st.asgAvg), dbRepSc(st.exAvg), dbRepSc(st.overall), '', dbRepPc(st.masteryAvg), '']],
    },
  });
  secs.push({
    heading: 'IV. HỌC SINH CẦN QUAN TÂM',
    ...(st.watch.length ? {
      text: `Có ${st.watch.length}/${st.count} học sinh có ít nhất một dấu hiệu cần theo dõi (tiêu chí nêu ở Phụ lục 3):`,
      table: { headers: ['STT', 'Học sinh', 'Điểm chung (/10)', 'Xếp loại', 'Lý do'], align: ['center', 'left', 'center', 'center', 'left'], widths: [6, 24, 14, 12, 44], rows: st.watch.map((p, i) => [i + 1, p.name, dbRepSc(p.n.overall), dbRepBandCell(p.n.band), p.n.reasons.join('; ')]) },
    } : { text: 'Chưa có học sinh nào thuộc diện cần quan tâm theo các tiêu chí đã nêu.' }),
  });
  secs.push({
    heading: 'V. MỤC TIÊU CẦN CỦNG CỐ',
    ...(text.weak.length ? {
      text: `${text.weak.length} mục tiêu có mức nắm vững trung bình của lớp thấp nhất (dưới 0,8):`,
      table: { headers: ['Mã', 'Mục tiêu', 'Nắm vững TB', 'HS đạt ≥ 0,8', 'Lỗ hổng mở'], align: ['center', 'left', 'center', 'center', 'center'], widths: [10, 48, 14, 14, 14],
        rows: text.weak.map((x) => [x.o.code, x.o.description, { v: x.avg, fmt: 'pct', tone: dbRepToneOf(x.avg) }, x.reach + '/' + x.n, { v: x.gaps, fmt: 'int' }]) },
    } : { text: 'Chưa có mục tiêu nào có mức nắm vững trung bình dưới 0,8 trong dữ liệu hiện có.' }),
  });
  secs.push({
    heading: 'VI. NHẬN XÉT VÀ ĐỀ XUẤT',
    paragraphs: ['Đề xuất căn cứ trên số liệu:'], bullets: text.rec,
    fillLabel: 'Ý kiến bổ sung của giáo viên:', fillLines: 3,
  });
  secs.push({ signatures: [{ title: 'TỔ TRƯỞNG CHUYÊN MÔN', note: '(Xác nhận, ký, ghi rõ họ tên)' }, { title: org.position.toUpperCase(), name: org.author }], recipients: ctx.recipients });
  /* Phụ lục: giấy ngang */
  const scoreSheet = dbRepSheetsClass(d, { name: 'x', headers: [], rows: [] }).find((s) => s.name === 'Bảng điểm');
  secs.push({ landscape: true, heading: 'PHỤ LỤC 1. BẢNG ĐIỂM CHI TIẾT', table: { headers: scoreSheet.headers, rows: scoreSheet.rows, summaryRows: scoreSheet.summaryRows, align: ['center', 'left'], dash: true }, note: 'Ô “—”: chưa nộp, chưa chấm hoặc chưa làm bài.' });
  secs.push({
    landscape: true, heading: 'PHỤ LỤC 2. MỨC NẮM VỮNG THEO MỤC TIÊU HỌC TẬP', pageBreak: true,
    table: { headers: ['STT', 'Mã', 'Chủ đề', 'Mục tiêu', 'HS có dữ liệu', 'Nắm vững TB', 'HS đạt ≥ 0,8', 'Lỗ hổng mở'], align: ['center', 'center', 'left', 'left', 'center', 'center', 'center', 'center'], widths: [5, 8, 20, 41, 9, 9, 9, 9],
      rows: objRows.map((x, i) => [i + 1, x.o.code, x.topic, x.o.description, { v: x.n, fmt: 'int' }, x.avg == null ? '' : { v: x.avg, fmt: 'pct', tone: dbRepToneOf(x.avg) }, { v: x.reach, fmt: 'int' }, { v: x.gaps, fmt: 'int' }]) },
  });
  secs.push({ landscape: true, heading: 'PHỤ LỤC 3. GHI CHÚ CÁCH TÍNH', pageBreak: true, table: { headers: ['Chỉ số', 'Cách hiểu'], rows: dbRepNotes(), align: ['left', 'left'], widths: [22, 78] } });
  return secs;
}
function dbRepWordStudent(d, stuId, ctx) {
  const n = dbRepNums(d, stuId), r = n.r, name = dbRepName(d, stuId), org = ctx.org;
  const byObj = dbById(r.objectives), byLesson = dbById(r.lessons), byTopic = dbById(r.topics), text = dbRepStudentText(n, name);
  const sh = dbRepSheetsStudent(d, stuId, { name: 'x', headers: [], rows: [] });
  const get = (nm) => sh.find((s) => s.name === nm);
  const openGaps = r.gaps.filter((g) => g.status === 'OPEN');
  const secs = [
    { heading: 'I. THÔNG TIN CHUNG', keyValue: [['Học sinh', name], ['Lớp', ctx.className], ['Môn học', org.subject], ['Năm học', ctx.schoolYear + (org.term ? ' · ' + org.term : '')]] },
    {
      heading: 'II. KẾT QUẢ TỔNG HỢP',
      kpis: [
        { label: 'Điểm bài tập TB', value: n.asgAvg == null ? '—' : dbRepS(n.asgAvg), note: 'thang 10' },
        { label: 'Điểm kiểm tra TB', value: n.exAvg == null ? '—' : dbRepS(n.exAvg), note: 'thang 10' },
        { label: 'Nắm vững TB', value: n.masteryAvg == null ? '—' : dbRepPctTxt(n.masteryAvg), note: n.mastered + '/' + n.objTotal + ' mục tiêu đạt' },
        { label: 'Lỗ hổng đang mở', value: n.openGaps, note: n.band ? 'Xếp loại chung: ' + n.band.label : '' },
      ],
      bullets: text.obs,
    },
    { heading: 'III. KẾT QUẢ BÀI TẬP', table: { headers: get('Bài tập').headers, rows: get('Bài tập').rows, align: get('Bài tập').align, widths: [6, 44, 15, 11, 12, 12] } },
    { heading: 'IV. KẾT QUẢ BÀI KIỂM TRA', table: { headers: get('Kiểm tra').headers, rows: get('Kiểm tra').rows, align: get('Kiểm tra').align, widths: [7, 47, 14, 17, 15] } },
    { heading: 'V. MỨC NẮM VỮNG THEO MỤC TIÊU', table: { headers: get('Nắm vững').headers, rows: get('Nắm vững').rows, align: get('Nắm vững').align, widths: [6, 11, 21, 46, 16] } },
    { heading: 'VI. LỖ HỔNG KIẾN THỨC ĐANG MỞ', ...(openGaps.length ? { table: { headers: get('Lỗ hổng').headers, rows: get('Lỗ hổng').rows, align: get('Lỗ hổng').align, widths: [6, 12, 52, 30] } } : { text: 'Không có lỗ hổng nào đang mở.' }) },
    { heading: 'VII. NHẬN XÉT VÀ ĐỀ XUẤT', bullets: text.rec, fillLabel: ctx.teacher ? 'Ý kiến bổ sung của giáo viên:' : 'Ghi chú cá nhân:', fillLines: 3 },
    { signatures: ctx.teacher ? [{ title: org.position.toUpperCase(), name: org.author }, { title: 'TỔ TRƯỞNG CHUYÊN MÔN', note: '(Xác nhận, ký, ghi rõ họ tên)' }] : [{ title: 'HỌC SINH', name: name }, { title: 'GIÁO VIÊN XÁC NHẬN' }], recipients: ctx.recipients },
    { heading: 'GHI CHÚ CÁCH TÍNH', table: { headers: ['Chỉ số', 'Cách hiểu'], rows: dbRepNotes(), align: ['left', 'left'], widths: [22, 78] } },
  ];
  return secs;
}
DB_ACT.reportWord = () => {
  const ctx = dbReportExportCtx(), { d, stuId, name, title, subtitle, org, teacher, generatedAt, placeDate } = ctx;
  const fileBase = dbSafeFileName('bao-cao-tien-do-' + name.replace(/\s+/g, '-').toLowerCase());
  DBTF.exportWord(dbExportName(fileBase, 'doc'), title, dbReportSections(d, stuId, ctx), {
    official: teacher, subtitle, generatedAt, placeDate,
    orgName: org.school ? org.school.toUpperCase() : '', parentOrg: org.parent ? org.parent.toUpperCase() : '', docNo: org.docNo || '',
    recipient: teacher ? org.recipient : '', metadata: teacher ? null : ctx.metadata,
    footerText: 'Báo cáo tiến độ học tập · Lớp ' + ctx.className,
    footnote: 'Số liệu được trích xuất từ hệ thống EducMind lúc ' + generatedAt + '. Đề nghị đối chiếu trước khi ký duyệt và lưu hành.',
  });
  toast('Đã xuất tệp Word.');
};
