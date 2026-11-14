/* EducMind · js/db/09-progress.js
   Đánh giá học tập: mức nắm vững theo mục tiêu, lỗ hổng kiến thức và gợi ý học tập.
   Lưu ý: Mọi số liệu ở đây do máy chủ tính từ điểm bài tập và bài kiểm tra (bảng mastery, knowledge_gaps, recommendations).
   Giao diện chỉ đọc; giáo viên được bỏ qua một lỗ hổng, học sinh được nhận hoặc bỏ qua một gợi ý. */

const DB_REC_KIND = { REVIEW_CONTENT: 'Ôn lại nội dung', TARGETED_PRACTICE: 'Luyện tập có mục tiêu', ADVANCED_ACTIVITY: 'Hoạt động nâng cao', RETAKE_ASSESSMENT: 'Làm lại bài kiểm tra' };
const DB_REC_STATE = { ACTIVE: ['Mới', 'need'], ACCEPTED: ['Đã nhận', 'prog'], DISMISSED: ['Đã bỏ qua', 'plain'], COMPLETED: ['Đã hoàn thành', 'good'] };
const DB_GAP_STATE = { OPEN: ['Đang mở', 'need'], RESOLVED: ['Đã khắc phục', 'good'], DISMISSED: ['Giáo viên đã bỏ qua', 'plain'] };

/* Dữ liệu chung của ba trang đánh giá. */
async function dbLoadProgress() {
  const content = await dbLoadContent();
  const objIds = content.objectives.map((o) => o.id);
  const [mastery, gaps, recsAll, assessments, roster] = await Promise.all([
    dbCallIn(EducMindDB.listMastery, objIds), dbCallIn(EducMindDB.listGaps, objIds), dbCall(EducMindDB.listRecommendations()),
    DB.course ? dbCall(EducMindDB.listAssessments(DB.course.id)) : [], dbIsTeacher() ? dbLoadRoster() : { members: [], profiles: {} },
  ]);
  /* Gợi ý của lớp đang chọn: gắn với một mục tiêu hoặc một bài kiểm tra của lớp này. */
  const objSet = new Set(objIds), exSet = new Set(assessments.map((e) => e.id));
  const recs = recsAll.filter((r) => (r.objective_id && objSet.has(r.objective_id)) || (r.assessment_id && exSet.has(r.assessment_id)));
  return { ...content, mastery, gaps, recs, assessments, ...roster };
}
const dbMean = (list) => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : null);
const dbPct = (v) => (v == null ? '—' : pct(v) + '%');

/* ===== Mức nắm vững ===== */
DB_PAGES.progress = {
  title: () => (dbIsTeacher() ? 'Mức độ nắm vững' : 'Mức nắm vững'),
  sub: 'Dưới 40%: Cần ôn · 40–69%: Đang tiến bộ · từ 70%: Vững. Kết quả gần đây được tính nặng hơn kết quả cũ.',
  load: dbLoadProgress,
  view(d) {
    if (!d.objectives.length) return `<section class="panel">${dbEmpty(dbIsTeacher() ? 'Lớp chưa có mục tiêu học tập. Thêm mục tiêu ở trang “Thư mục học tập”, rồi gắn mục tiêu vào bài tập và câu hỏi.' : 'Lớp chưa có mục tiêu học tập nào được xuất bản.')}</section>`;
    return dbIsTeacher() ? dbMasteryTeacher(d) : dbMasteryStudent(d);
  },
};
function dbMasteryTeacher(d) {
  const cell = {}; d.mastery.forEach((m) => { cell[m.student_id + '|' + m.objective_id] = m; });
  const lessonById = dbById(d.lessons);
  const head = ['Học sinh', 'Trung bình'].concat(d.objectives.map((o) => `<span title="${h(o.description)}${lessonById[o.lesson_id] ? ' · ' + h(lessonById[o.lesson_id].title) : ''}">${h(o.code)}</span>`));
  const rows = d.members.map((m) => {
    const vals = d.objectives.map((o) => cell[m.student_id + '|' + o.id]).filter(Boolean).map((x) => Number(x.mastery_score)), avg = dbMean(vals);
    return `<tr><th scope="row">${h(dbName(d.profiles[m.student_id]))}</th><td>${avg == null ? '<span class="muted">—</span>' : `<span class="db-cell ${tier(avg)}">${pct(avg)}%</span>`}</td>${d.objectives.map((o) => {
      const x = cell[m.student_id + '|' + o.id];
      return `<td>${x ? `<span class="db-cell ${tier(Number(x.mastery_score))}" title="${x.evidence_count} bằng chứng">${pct(Number(x.mastery_score))}%</span>` : '<span class="muted">—</span>'}</td>`;
    }).join('')}</tr>`;
  });
  const classRow = `<tr class="db-total"><th scope="row">Trung bình lớp</th><td>${dbPct(dbMean(d.mastery.map((m) => Number(m.mastery_score))))}</td>${d.objectives.map((o) => `<td>${dbPct(dbMean(d.mastery.filter((m) => m.objective_id === o.id).map((m) => Number(m.mastery_score))))}</td>`).join('')}</tr>`;
  const need = d.members.filter((m) => { const v = dbMean(d.mastery.filter((x) => x.student_id === m.student_id).map((x) => Number(x.mastery_score))); return v != null && v < 0.5; });
  return `<section class="panel" aria-labelledby="db-h-m">
    <h2 id="db-h-m">Bảng mức nắm vững của lớp</h2>
    <p class="lead">${d.members.length} học sinh · ${d.objectives.length} mục tiêu · ${need.length} học sinh cần hỗ trợ (trung bình dưới 50%). Di chuột vào mã mục tiêu để xem nội dung.</p>
    ${d.members.length ? dbTable(head, rows.concat(classRow), 'Mức nắm vững theo học sinh và mục tiêu') : dbEmpty('Lớp chưa có học sinh.')}
  </section>
  <section class="panel" aria-labelledby="db-h-mo"><h2 id="db-h-mo">Danh sách mục tiêu</h2>
    <ul class="db-objectives">${d.objectives.map((o) => `<li><span class="db-obj-code">${h(o.code)}</span><span class="db-obj-text">${h(o.description)}<span class="muted"> · ${lessonById[o.lesson_id] ? h(lessonById[o.lesson_id].title) : ''}</span></span></li>`).join('')}</ul>
  </section>`;
}
function dbMasteryStudent(d) {
  const mine = Object.fromEntries(d.mastery.map((m) => [m.objective_id, m])), objBy = dbGroup(d.objectives, 'lesson_id');
  const avg = dbMean(d.mastery.map((m) => Number(m.mastery_score)));
  return `<section class="panel" aria-labelledby="db-h-sm">
    <h2 id="db-h-sm">Mức nắm vững của em</h2>
    <p class="lead">${avg == null ? 'Chưa có kết quả nào được chấm.' : 'Trung bình ' + pct(avg) + '% trên ' + d.mastery.length + ' mục tiêu đã có kết quả.'}</p>
    ${d.lessons.filter((l) => (objBy[l.id] || []).length).map((l) => `<div class="db-lesson"><b>${h(l.title)}</b>
      ${objBy[l.id].map((o) => { const m = mine[o.id], v = m ? Number(m.mastery_score) : null;
        return `<div class="db-mrow"><div class="db-mrow-text"><span class="db-obj-code">${h(o.code)}</span> ${h(o.description)}</div>
          <div class="db-mrow-bar">${v == null ? '' : bar(v, tier(v) === 'good' ? 'good' : tier(v) === 'need' ? 'need' : '', 'Mức nắm vững ' + pct(v) + '%')}</div>
          <div class="db-mrow-val">${dbMasteryPill(v)}${m ? `<span class="muted"> · ${m.evidence_count} kết quả</span>` : ''}</div></div>`; }).join('')}
    </div>`).join('')}
  </section>`;
}

/* ===== Lỗ hổng kiến thức ===== */
DB_PAGES.gaps = {
  title: 'Lỗ hổng kiến thức',
  sub: 'Lỗ hổng mở khi mức nắm vững một mục tiêu dưới 50% với ít nhất 2 kết quả, và tự đóng khi đạt từ 65%.',
  load: dbLoadProgress,
  view(d) {
    const T = dbIsTeacher(), objById = dbById(d.objectives);
    const open = d.gaps.filter((g) => g.status === 'OPEN'), closed = d.gaps.filter((g) => g.status !== 'OPEN');
    const item = (g) => `<div class="item"><div>
        <b>${T ? h(dbName(d.profiles[g.student_id])) + ' · ' : ''}${dbObjLabel(objById[g.objective_id])}</b>
        <div class="muted">${h(g.reason || '')}${g.reason ? ' · ' : ''}mở lúc ${dbDateTime(g.opened_at)}${g.status === 'RESOLVED' ? ' · khắc phục lúc ' + dbDateTime(g.resolved_at) : ''}${g.status === 'DISMISSED' ? ' · bỏ qua lúc ' + dbDateTime(g.dismissed_at) + (g.dismiss_reason ? ' (' + h(g.dismiss_reason) + ')' : '') : ''}</div>
      </div><div class="row">${dbPill(DB_GAP_STATE[g.status][0], DB_GAP_STATE[g.status][1])}${T && g.status === 'OPEN' ? dbBtn('Bỏ qua', 'dismissGap', { id: g.id }, 'light mini') : ''}${!T && g.status === 'OPEN' ? dbBtn('Xem bài học', 'go', { page: 'lessons' }, 'light mini') : ''}</div></div>`;
    return `<section class="panel" aria-labelledby="db-h-g"><h2 id="db-h-g">Lỗ hổng đang mở</h2>
      <p class="lead">${open.length ? open.length + ' lỗ hổng' + (T ? ' trong lớp' : ' cần em ôn lại') : T ? 'Hiện không có lỗ hổng nào đang mở trong lớp.' : 'Hiện em không có lỗ hổng nào đang mở.'}</p>
      ${open.map(item).join('')}
    </section>
    ${closed.length ? `<section class="panel" aria-labelledby="db-h-gc"><h2 id="db-h-gc">Đã đóng</h2><p class="lead">${closed.length} lỗ hổng đã khắc phục hoặc được giáo viên bỏ qua.</p>${closed.map(item).join('')}</section>` : ''}`;
  },
};
DB_ACT.dismissGap = (el) => dbOpenDialog({
  title: 'Bỏ qua lỗ hổng này?', okLabel: 'Bỏ qua lỗ hổng',
  body: `<p class="muted">Dùng khi giáo viên đã xử lý bằng cách khác (ví dụ kèm trực tiếp). Lỗ hổng chỉ mở lại khi học sinh có kết quả mới ở mục tiêu này.</p>`
    + dbField('Lý do', 'db-gap-reason', `<textarea id="db-gap-reason" name="reason" rows="3" maxlength="500" required></textarea>`),
  onOk: async (v) => {
    if (!v.reason) throw new Error('Nhập lý do bỏ qua.');
    await dbCall(EducMindDB.dismissGap(el.dataset.id, v.reason));
    toast('Đã bỏ qua lỗ hổng.');
  },
});

/* ===== Gợi ý học tập ===== */
DB_PAGES.recommend = {
  title: 'Gợi ý học tập',
  sub: () => (dbIsTeacher() ? 'Gợi ý hệ thống đã gửi cho học sinh dựa trên mức nắm vững từng mục tiêu.' : 'Gợi ý dựa trên kết quả của em ở từng mục tiêu. Nhận gợi ý để ghi nhớ việc cần làm.'),
  load: dbLoadProgress,
  view(d) {
    const T = dbIsTeacher(), objById = dbById(d.objectives), exById = dbById(d.assessments);
    const target = (r) => (r.assessment_id && exById[r.assessment_id] ? 'Bài kiểm tra: ' + h(exById[r.assessment_id].title) : r.objective_id ? dbObjLabel(objById[r.objective_id]) : '');
    if (T) {
      const rows = d.recs.map((r) => `<tr><th scope="row">${h(dbName(d.profiles[r.student_id]))}</th><td>${h(DB_REC_KIND[r.kind] || r.kind)}</td><td>${target(r)}<div class="muted">${h(r.reason || '')}</div></td>
        <td>${dbPill(DB_REC_STATE[r.status][0], DB_REC_STATE[r.status][1])}</td><td>${dbDateTime(r.created_at)}</td></tr>`);
      return `<section class="panel" aria-labelledby="db-h-r"><h2 id="db-h-r">Gợi ý đã gửi cho học sinh</h2><p class="lead">${d.recs.length} gợi ý</p>
        ${rows.length ? dbTable(['Học sinh', 'Loại gợi ý', 'Nội dung', 'Trạng thái', 'Tạo lúc'], rows, 'Gợi ý học tập của lớp') : dbEmpty('Chưa có gợi ý nào. Gợi ý xuất hiện sau khi bài tập hoặc bài kiểm tra có gắn mục tiêu được chấm.')}</section>`;
    }
    const card = (r) => `<article class="db-task"><div class="row between"><div>
        <b>${h(DB_REC_KIND[r.kind] || r.kind)}</b><div>${target(r)}</div><div class="muted">${h(r.reason || '')}</div></div>
      <div class="row">${dbPill(DB_REC_STATE[r.status][0], DB_REC_STATE[r.status][1])}
        ${r.status === 'ACTIVE' ? dbBtn('Nhận gợi ý', 'respondRec', { id: r.id, status: 'ACCEPTED' }, 'mini') + dbBtn('Bỏ qua', 'respondRec', { id: r.id, status: 'DISMISSED' }, 'light mini') : ''}
        ${r.status === 'ACTIVE' || r.status === 'ACCEPTED' ? (r.assessment_id ? dbBtn('Mở bài kiểm tra', 'go', { page: 'assessments', id: r.assessment_id }, 'light mini') : dbBtn('Xem bài học', 'go', { page: 'lessons' }, 'light mini')) : ''}</div></div></article>`;
    const live = d.recs.filter((r) => r.status === 'ACTIVE' || r.status === 'ACCEPTED'), old = d.recs.filter((r) => r.status === 'DISMISSED' || r.status === 'COMPLETED');
    return `<section class="panel" aria-labelledby="db-h-sr2"><h2 id="db-h-sr2">Việc nên làm tiếp</h2><p class="lead">${live.length ? live.length + ' gợi ý' : 'Hiện chưa có gợi ý nào dành cho em.'}</p>${live.map(card).join('')}</section>
      ${old.length ? `<section class="panel" aria-labelledby="db-h-so"><h2 id="db-h-so">Đã xong hoặc đã bỏ qua</h2>${old.map(card).join('')}</section>` : ''}`;
  },
};
DB_ACT.respondRec = (el) => dbRun(el, async () => {
  await dbCall(EducMindDB.respondRecommendation(el.dataset.id, el.dataset.status));
}, el.dataset.status === 'ACCEPTED' ? 'Đã nhận gợi ý.' : 'Đã bỏ qua gợi ý.');
