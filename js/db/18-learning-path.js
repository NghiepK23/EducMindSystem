/* EducMind · US-52 (giai đoạn 1): Lộ trình học tập ĐỀ XUẤT cho học sinh.
   - Chỉ đọc dữ liệu đã phân quyền qua EducMindDB, không ghi Supabase.
   - KHÔNG tạo bản ghi learning_path/learning_path_items.
   - Ưu tiên mục tiêu có mastery thấp và lỗ hổng OPEN lâu ngày.
   - Chỉ hiển thị dữ liệu của tài khoản hiện tại và khóa học đang chọn.
   - Không suy diễn đã hoàn thành khi chưa có điểm/đánh giá.
*/
(function dbLearningPathInit() {
  'use strict';
  if (typeof DB_PAGES === 'undefined' || typeof DB_NAV_S === 'undefined') return;

  const myId = () => String((DB.me && DB.me.id) || '');
  const validScore = (x) => x != null && x !== '' && Number.isFinite(Number(x));
  const scoreOf = (m) => (m && validScore(m.mastery_score) ? Math.max(0, Math.min(1, Number(m.mastery_score))) : null);
  const REC_LABELS = {
    REVIEW_CONTENT: 'Ôn lại nội dung', TARGETED_PRACTICE: 'Luyện tập trọng tâm',
    ADVANCED_ACTIVITY: 'Hoạt động nâng cao', RETAKE_ASSESSMENT: 'Ôn và làm lại bài kiểm tra',
  };
  const isAvailable = (lesson) => lesson && (!lesson.status || lesson.status === 'PUBLISHED');
  const recDate = (g) => {
    const t = Date.parse((g && g.opened_at) || '');
    return Number.isFinite(t) ? t : Infinity;
  };

  /* Hàm thuần: dễ kiểm thử với dữ liệu mẫu, không ghi database. */
  function dbLpBuild(data, studentId) {
    const d = data || {};
    const lessons = (d.lessons || []).filter(isAvailable);
    const lessonMap = Object.fromEntries(lessons.map((l) => [l.id, l]));
    const lessonIdx = Object.fromEntries(lessons.map((l, i) => [l.id, i]));
    const objectives = (d.objectives || []).filter((o) => lessonMap[o.lesson_id]);
    const mine = (r) => String(r.student_id) === String(studentId);
    const mastery = new Map((d.mastery || []).filter(mine).map((m) => [m.objective_id, m]));
    const gapMap = new Map();
    (d.gaps || []).filter((g) => mine(g) && g.status === 'OPEN').forEach((g) => {
      const prev = gapMap.get(g.objective_id);
      if (!prev || recDate(g) < recDate(prev)) gapMap.set(g.objective_id, g);
    });
    const recMap = new Map();
    (d.recs || []).filter((r) => mine(r) && (r.status === 'ACTIVE' || r.status === 'ACCEPTED') && r.objective_id)
      .forEach((r) => {
        const prev = recMap.get(r.objective_id);
        if (!prev || (prev.status !== 'ACCEPTED' && r.status === 'ACCEPTED')) recMap.set(r.objective_id, r);
      });
    const steps = objectives.map((o) => {
      const v = scoreOf(mastery.get(o.id)), gap = gapMap.get(o.id) || null;
      const rec = recMap.get(o.id) || null;
      const priority = gap ? 0 : v == null ? 4 : v < 0.4 ? 1 : v < 0.7 ? 2 : 3;
      return { objective: o, lesson: lessonMap[o.lesson_id], score: v, gap, rec,
        priority, lessonOrder: lessonIdx[o.lesson_id] || 0 };
    });
    steps.sort((a, b) => a.priority - b.priority
      || (a.score == null && b.score == null ? 0 : a.score == null ? 1 : b.score == null ? -1 : a.score - b.score)
      || recDate(a.gap) - recDate(b.gap)
      || a.lessonOrder - b.lessonOrder
      || String(a.objective.code || '').localeCompare(String(b.objective.code || ''), 'vi'));
    return steps;
  }

  function dbLpStep(step, idx) {
    const s = step.score, gap = step.gap;
    const flag = gap ? dbPill('Có lỗ hổng cần ôn', 'need')
      : s == null ? dbPill('Chưa có kết quả', 'plain')
      : s < 0.4 ? dbPill('Ưu tiên cao', 'need')
      : s < 0.7 ? dbPill('Cần củng cố', 'prog')
      : dbPill('Đã đạt ngưỡng', 'good');
    const reason = gap ? h(gap.reason || 'Hệ thống đã phát hiện lỗ hổng kiến thức.')
      : s == null ? 'Chưa đủ dữ liệu để đánh giá. Hãy học và làm bài để có kết quả.'
      : s < 0.4 ? 'Mục tiêu đang dưới ngưỡng 40%; nên ôn kiến thức nền trước.'
      : s < 0.7 ? 'Cần luyện thêm để đạt mức nắm vững từ 70%.'
      : 'Có thể tiếp tục luyện nâng cao hoặc ôn tập định kỳ.';
    const rec = step.rec && REC_LABELS[step.rec.kind] || (step.rec && step.rec.kind) || '';
    const action = step.rec
      ? dbBtn('Xem gợi ý học tập', 'go', { page: 'recommend' }, 'light mini')
      : dbBtn('Mở bài học', 'go', { page: 'lessons' }, 'light mini');
    return `<li class="lp-step">
      <div class="lp-index" aria-hidden="true">${idx + 1}</div>
      <div class="lp-content">
        <div class="lp-line"><strong>${h(step.objective.code || 'Mục tiêu')} · ${h(step.objective.description || '')}</strong>${flag}</div>
        <div class="lp-meta">Bài học: ${h(step.lesson.title || 'Chưa đặt tên')} · ${s == null ? 'Chưa có mức nắm vững' : 'Mức nắm vững: ' + Math.round(s * 100) + '%'}</div>
        <p class="lp-reason">${reason}</p>
        ${rec ? `<p class="lp-reason"><strong>Gợi ý:</strong> ${h(rec)}${step.rec.reason ? ' – ' + h(step.rec.reason) : ''}</p>` : ''}
        <div class="lp-actions">${action}</div>
      </div>
    </li>`;
  }

  DB_PAGES.learningPath = {
    title: 'Lộ trình học cá nhân hóa',
    sub: 'Đề xuất thứ tự học dựa trên kết quả của em. Bản xem trước chỉ đọc; chưa lưu tiến độ lộ trình.',
    async load() {
      if (!DB.me || dbIsTeacher()) return { lessons: [], objectives: [], mastery: [], gaps: [], recs: [] };
      if (!DB.course) return { lessons: [], objectives: [], mastery: [], gaps: [], recs: [] };
      return dbLoadProgress();
    },
    view(data) {
      if (dbIsTeacher()) return `<section class="panel">${dbEmpty('Lộ trình cá nhân dành cho tài khoản học sinh.')}</section>`;
      if (!DB.course) return `<section class="panel">${dbEmpty('Lớp chưa có khóa học để xây dựng lộ trình.')}</section>`;
      const steps = dbLpBuild(data, myId());
      if (!steps.length) return `<section class="panel lp-wrap"><h2>Lộ trình học của em</h2>
        ${dbEmpty('Chưa có mục tiêu học tập đã xuất bản. Lộ trình sẽ hiển thị sau khi giáo viên xuất bản bài học có mục tiêu.')}
        ${dbBtn('Xem bài học', 'go', { page: 'lessons' }, 'light')}</section>`;
      const needs = steps.filter((x) => x.priority <= 2), ready = steps.filter((x) => x.priority === 3), unknown = steps.filter((x) => x.priority === 4);
      const measured = steps.filter((x) => x.score != null).length;
      const header = `<section class="panel lp-wrap" aria-labelledby="lp-header"><div class="lp-head">
        <div><h2 id="lp-header">Lộ trình học đề xuất</h2><p class="lead">Sắp xếp từ mục tiêu cần ưu tiên đến mục tiêu đã nắm vững.</p></div>
        <span class="lp-count">${needs.length} mục tiêu nên ưu tiên</span></div>
        <div class="lp-summary"><span><b>${steps.length}</b> mục tiêu</span><span><b>${ready.length}</b> đã đạt từ 70%</span><span><b>${measured}</b> có kết quả</span></div>
        <p class="muted lp-caveat">Đây là thứ tự gợi ý tính từ dữ liệu hiện tại, không phải lộ trình đã lưu hoặc đánh dấu hoàn thành. Kết quả sẽ thay đổi khi bài làm được chấm.</p>
      </section>`;
      const group = (label, list, note, offset) => list.length ? `<section class="panel lp-wrap"><h2>${label}</h2><p class="lead">${note}</p>
          <ol class="lp-list">${list.map((step, i) => dbLpStep(step, offset + i)).join('')}</ol></section>` : '';
      return header
        + group('Ưu tiên học trước', needs, 'Mục tiêu có lỗ hổng hoặc mức nắm vững dưới 70%.', 0)
        + group('Chưa có kết quả đánh giá', unknown, 'Học và hoàn thành bài tập để hệ thống có dữ liệu xếp ưu tiên chính xác.', needs.length)
        + (ready.length ? `<details class="panel lp-wrap lp-complete"><summary><strong>Đã đạt ngưỡng 70% (${ready.length})</strong> – Xem mục tiêu</summary>
          <ol class="lp-list">${ready.map((step, i) => dbLpStep(step, needs.length + unknown.length + i)).join('')}</ol></details>` : '')
        + (!needs.length && !unknown.length ? `<section class="panel"><p class="lead">Các mục tiêu đã có kết quả đều đạt ngưỡng 70%. Tiếp tục duy trì ôn tập.</p></section>` : '');
    },
  };

  // Chỉ thêm vào menu học sinh; giữ nguyên menu giáo viên và các chức năng cũ.
  const resultGroup = DB_NAV_S.find((g) => g[0] === 'Kết quả');
  const entry = ['learningPath', 'Lộ trình học cá nhân hóa', 'recommend'];
  if (resultGroup) {
    if (!resultGroup[1].some((item) => item[0] === entry[0])) resultGroup[1].push(entry);
  } else if (!DB_NAV_S.some((g) => g[1].some((item) => item[0] === entry[0]))) {
    DB_NAV_S.push(['Lộ trình', [entry]]);
  }

  // Hỗ trợ kiểm thử hàm xếp thứ tự mà không phải gọi Supabase.
  // Không xuất dữ liệu học sinh ra biến toàn cục.
})();
