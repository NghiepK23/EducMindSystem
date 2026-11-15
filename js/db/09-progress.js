/* EducMind · js/db/09-progress.js
   Đánh giá học tập: mức nắm vững theo mục tiêu, lỗ hổng kiến thức và gợi ý học tập.
   Lưu ý: Mọi số liệu ở đây do máy chủ tính từ điểm bài tập và bài kiểm tra (bảng mastery, knowledge_gaps, recommendations).
   Giao diện chỉ đọc; giáo viên được bỏ qua một lỗ hổng, học sinh được nhận hoặc bỏ qua một gợi ý.
   Bộ lọc theo bài học, ô tìm kiếm và nút thu gọn nằm ở mục "Bộ lọc và thu gọn" bên dưới; cả ba trang dùng chung. */

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

/* ===== Bộ lọc và thu gọn (dùng chung cho ba trang) =====
   - Trạng thái (bài học đang chọn, từ khóa, khối nào đã mở/thu gọn) lưu theo trang và theo lớp, nên vẫn giữ khi trang tải lại sau một thao tác.
   - Khi gõ hoặc bấm, chỉ phần nội dung bên dưới thanh lọc được vẽ lại từ dữ liệu đã tải, không gọi lại máy chủ.
   - Mặc định: mở bài đầu tiên, thu gọn các bài còn lại; khi đang lọc hoặc tìm kiếm thì mở hết các bài khớp. */
const DB_PF = { state: {}, data: {} };
const DB_PF_NONE = '_none';
const DB_PF_OTHER = 'Bài học khác'; /* mục tiêu hoặc bài kiểm tra không có bài học để xếp vào */
const dbPfNorm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

function dbPfSt(page) {
  const k = page + '|' + (DB.course ? DB.course.id : '');
  return DB_PF.state[k] || (DB_PF.state[k] = { lesson: 'all', q: '', fold: {} });
}
const dbPfKey = (d, lessonId) => (lessonId && d.lessons.some((l) => l.id === lessonId) ? lessonId : DB_PF_NONE);
function dbPfTitle(d, key, other) {
  const l = key === DB_PF_NONE ? null : d.lessons.find((x) => x.id === key);
  return l ? l.title : other;
}
/* Gom các mục theo bài học (đúng thứ tự bài học của lớp); mục không gắn bài học xuống cuối. */
function dbPfGroups(d, items, keyOf, other, lesson) {
  const by = {};
  items.forEach((it) => { const k = keyOf(it); (by[k] = by[k] || []).push(it); });
  return d.lessons.map((l) => l.id).concat(DB_PF_NONE)
    .filter((k) => by[k] && (lesson === 'all' || lesson === k))
    .map((k) => ({ key: k, title: dbPfTitle(d, k, other), items: by[k] }));
}
function dbPfScope(d, st, items, keyOf, other) {
  const present = dbPfGroups(d, items, keyOf, other, 'all');
  const keys = present.map((g) => g.key);
  const lesson = keys.includes(st.lesson) ? st.lesson : 'all';
  const tokens = dbPfNorm(st.q).split(/\s+/).filter(Boolean);
  return { f: { lesson, tokens, active: lesson !== 'all' || tokens.length > 0 }, options: present.map((g) => ({ key: g.key, title: g.title })) };
}
/* Tìm không phân biệt hoa thường và dấu; mọi từ khóa phải có mặt trong văn bản. */
const dbPfHit = (tokens, text) => { const t = dbPfNorm(text); return tokens.every((k) => t.includes(k)); };
const dbPfOpen = (st, key, idx, f) => (st.fold[key] === undefined ? (f.active || idx === 0) : st.fold[key]);

/* Một khối bài học có tiêu đề bấm được để thu gọn hoặc mở. */
function dbPfGroup(page, key, title, idx, open, meta, summary, inner, scope) {
  const id = 'db-pf-' + page + '-' + scope + '-' + idx;
  return `<div class="db-lesson db-pf-group${open ? ' is-open' : ''}">
    <button type="button" class="db-pf-head" data-pf-toggle="${h(key)}" data-pf-slot="${scope}${idx}" aria-expanded="${open ? 'true' : 'false'}" aria-controls="${id}" title="${open ? 'Thu gọn' : 'Mở'}: ${h(title)}">
      <span class="db-pf-chev" aria-hidden="true"></span><b class="db-pf-title">${h(title)}</b><span class="muted db-pf-meta">${meta}</span>${summary ? `<span class="db-pf-sum">${summary}</span>` : ''}
    </button>
    <div class="db-pf-content" id="${id}"${open ? '' : ' hidden'}>${inner}</div>
  </div>`;
}

function dbPfBar(page, st, r) {
  return `<section class="panel db-pf-bar" aria-label="Lọc theo bài học">
    <div class="db-pf-controls">
      <div class="db-pf-field"><label for="db-pf-l-${page}">Bài học</label>
        <select id="db-pf-l-${page}" data-pf-lesson="${page}"><option value="all">Tất cả bài học</option>${r.options.map((o) => `<option value="${h(o.key)}"${r.f.lesson === o.key ? ' selected' : ''}>${h(o.title)}</option>`).join('')}</select></div>
      <div class="db-pf-field db-pf-grow"><label for="db-pf-q-${page}">Tìm kiếm</label>
        <input id="db-pf-q-${page}" type="search" data-pf-q="${page}" value="${h(st.q)}" placeholder="${h(r.placeholder)}" autocomplete="off"></div>
    </div>
    <div class="db-pf-actions">
      <span class="muted" data-pf-count="${page}" role="status" aria-live="polite">${h(r.count)}</span>
      ${dbBtn('Mở tất cả', 'pfFold', { pf: page, mode: 'open' }, 'light mini')}${dbBtn('Thu gọn tất cả', 'pfFold', { pf: page, mode: 'close' }, 'light mini')}<span data-pf-clearwrap="${page}"${r.active ? '' : ' hidden'}>${dbBtn('Xóa lọc', 'pfClear', { pf: page }, 'light mini')}</span>
    </div>
  </section>`;
}
function dbPfView(page, d) {
  DB_PF.data[page] = d;
  const st = dbPfSt(page), r = DB_PF_RENDER[page](d, st);
  if (!r.total) return r.html;
  return dbPfBar(page, st, r) + `<div data-pf-body="${page}">${r.html}</div>`;
}
/* Vẽ lại phần nội dung từ dữ liệu đã tải; focus quay về nút vừa bấm. */
function dbPfRefresh(page, focus) {
  const d = DB_PF.data[page], root = document.querySelector('[data-pf-body="' + page + '"]');
  if (!d || !root) return;
  const r = DB_PF_RENDER[page](d, dbPfSt(page));
  root.innerHTML = r.html;
  root.classList.add('db-pf-still');
  const c = document.querySelector('[data-pf-count="' + page + '"]'); if (c) c.textContent = r.count;
  const x = document.querySelector('[data-pf-clearwrap="' + page + '"]'); if (x) x.hidden = !r.active;
  if (focus) {
    const t = root.querySelector('[data-pf-slot="' + focus.slot + '"]') || Array.from(root.querySelectorAll('[data-pf-toggle]')).find((b) => b.dataset.pfToggle === focus.key);
    if (t) t.focus({ preventScroll: true });
  }
}
DB_ACT.pfFold = (el) => {
  const page = el.dataset.pf, open = el.dataset.mode === 'open', root = document.querySelector('[data-pf-body="' + page + '"]');
  if (!root) return;
  const st = dbPfSt(page);
  root.querySelectorAll('[data-pf-toggle]').forEach((b) => { st.fold[b.dataset.pfToggle] = open; });
  dbPfRefresh(page);
};
DB_ACT.pfClear = (el) => {
  const page = el.dataset.pf, st = dbPfSt(page);
  st.lesson = 'all'; st.q = '';
  const s = document.querySelector('[data-pf-lesson="' + page + '"]'), q = document.querySelector('[data-pf-q="' + page + '"]');
  if (s) s.value = 'all';
  if (q) q.value = '';
  dbPfRefresh(page);
};


/* Gắn sự kiện một lần cho cả trang (chip, tiêu đề khối, ô chọn bài học, ô tìm kiếm). CSS nằm trong css/01-base.css. */
(function dbPfInit() {
  if (typeof document === 'undefined' || window.__dbPfBound) return;
  window.__dbPfBound = true;
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('[data-pf-toggle]') : null, root = b && b.closest('[data-pf-body]');
    if (!root) return;
    const page = root.dataset.pfBody, key = b.dataset.pfToggle;
    dbPfSt(page).fold[key] = b.getAttribute('aria-expanded') !== 'true';
    dbPfRefresh(page, { key, slot: b.dataset.pfSlot });
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches('[data-pf-lesson]')) return;
    dbPfSt(t.dataset.pfLesson).lesson = t.value;
    dbPfRefresh(t.dataset.pfLesson);
  });
  let timer = 0;
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches('[data-pf-q]')) return;
    const page = t.dataset.pfQ;
    dbPfSt(page).q = t.value;
    clearTimeout(timer);
    timer = setTimeout(() => dbPfRefresh(page), 120);
  });
})();

/* ===== Mức nắm vững ===== */
DB_PAGES.progress = {
  title: () => (dbIsTeacher() ? 'Mức độ nắm vững' : 'Mức nắm vững'),
  sub: '< 40%: Cần ôn | 40–69%: Đang tiến bộ | >= 70%: Vững.',
  load: dbLoadProgress,
  view(d) {
    if (!d.objectives.length) return `<section class="panel">${dbEmpty(dbIsTeacher() ? 'Lớp chưa có mục tiêu học tập. Thêm mục tiêu ở trang “Thư mục học tập”, rồi gắn mục tiêu vào bài tập và câu hỏi.' : 'Lớp chưa có mục tiêu học tập nào được xuất bản.')}</section>`;
    return dbPfView('progress', d);
  },
};
function dbPfProgress(d, st) {
  const T = dbIsTeacher(), other = DB_PF_OTHER, keyOf = (o) => dbPfKey(d, o.lesson_id);
  const { f, options } = dbPfScope(d, st, d.objectives, keyOf, other);
  const inLesson = d.objectives.filter((o) => f.lesson === 'all' || keyOf(o) === f.lesson);
  const objHit = f.tokens.length ? inLesson.filter((o) => dbPfHit(f.tokens, o.code + ' ' + o.description + ' ' + dbPfTitle(d, keyOf(o), other))) : inLesson;
  /* Giáo viên: từ khóa khớp tên học sinh thì lọc cả hàng; khớp mục tiêu thì lọc cột; khớp cả hai thì lọc cả hai. */
  const stuHit = T && f.tokens.length ? d.members.filter((m) => dbPfHit(f.tokens, dbName(d.profiles[m.student_id]))) : [];
  let objs = objHit, mem = d.members;
  if (stuHit.length) { mem = stuHit; if (!objHit.length) objs = inLesson; }
  const groups = dbPfGroups(d, objs, keyOf, other, 'all');
  const html = !objs.length
    ? `<section class="panel">${dbEmpty(T ? 'Không có mục tiêu hoặc học sinh nào khớp bộ lọc.' : 'Không có mục tiêu nào khớp bộ lọc.')}</section>`
    : (T ? dbMasteryTeacher : dbMasteryStudent)(d, { st, f, objs, mem, groups });
  return {
    html, f, options, total: d.objectives.length, active: f.active,
    placeholder: T ? 'Mã, mô tả mục tiêu hoặc tên học sinh' : 'Mã hoặc mô tả mục tiêu',
    count: 'Hiển thị ' + objs.length + '/' + d.objectives.length + ' mục tiêu' + (T && mem.length !== d.members.length ? ' · ' + mem.length + '/' + d.members.length + ' học sinh' : ''),
  };
}
function dbMasteryTeacher(d, c) {
  const { st, f, objs, mem, groups } = c;
  const cell = {}; d.mastery.forEach((m) => { cell[m.student_id + '|' + m.objective_id] = m; });
  const lessonById = dbById(d.lessons);
  const score = (m, o) => { const x = cell[m.student_id + '|' + o.id]; return x ? Number(x.mastery_score) : null; };
  const notNull = (v) => v != null;
  const cols = groups.map((g, i) => ({ g, i, open: dbPfOpen(st, g.key, i, f) }));
  const lessonTip = (o) => `${h(o.description)}${lessonById[o.lesson_id] ? ' · ' + h(lessonById[o.lesson_id].title) : ''}`;
  /* Bài đang mở: mỗi mục tiêu một cột. Bài đang thu gọn: một cột trung bình của bài, bấm tiêu đề để mở. */
  const head = ['Học sinh', 'Trung bình'];
  cols.forEach(({ g, i, open }) => {
    if (open) g.items.forEach((o) => head.push(`<span title="${lessonTip(o)}">${h(o.code)}</span>`));
    else head.push(`<button type="button" class="db-pf-th" data-pf-toggle="${h(g.key)}" data-pf-slot="h${i}" aria-expanded="false" title="Mở ${g.items.length} mục tiêu của: ${h(g.title)}"><span class="db-pf-chev" aria-hidden="true"></span><span class="db-pf-th-t">${h(g.title)}</span><span class="muted"> · TB</span></button>`);
  });
  const cellHtml = (v, tip) => (v == null ? '<span class="muted">—</span>' : `<span class="db-cell ${tier(v)}"${tip ? ` title="${h(tip)}"` : ''}>${pct(v)}%</span>`);
  const rows = mem.map((m) => {
    const avg = dbMean(objs.map((o) => score(m, o)).filter(notNull));
    const tds = cols.map(({ g, open }) => {
      if (open) return g.items.map((o) => { const x = cell[m.student_id + '|' + o.id]; return `<td>${cellHtml(x ? Number(x.mastery_score) : null, x ? x.evidence_count + ' bằng chứng' : '')}</td>`; }).join('');
      const vs = g.items.map((o) => score(m, o)).filter(notNull);
      return `<td>${cellHtml(dbMean(vs), vs.length + '/' + g.items.length + ' mục tiêu có kết quả')}</td>`;
    }).join('');
    return `<tr><th scope="row">${h(dbName(d.profiles[m.student_id]))}</th><td>${cellHtml(avg)}</td>${tds}</tr>`;
  });
  const memSet = new Set(mem.map((m) => m.student_id)), objSet = new Set(objs.map((o) => o.id));
  const ms = d.mastery.filter((x) => memSet.has(x.student_id) && objSet.has(x.objective_id));
  const colAvg = (ids) => dbPct(dbMean(ms.filter((x) => ids.has(x.objective_id)).map((x) => Number(x.mastery_score))));
  const classRow = `<tr class="db-total"><th scope="row">${mem.length === d.members.length ? 'Trung bình lớp' : 'Trung bình (học sinh đang lọc)'}</th><td>${dbPct(dbMean(ms.map((x) => Number(x.mastery_score))))}</td>${cols.map(({ g, open }) => (open ? g.items.map((o) => `<td>${colAvg(new Set([o.id]))}</td>`).join('') : `<td>${colAvg(new Set(g.items.map((o) => o.id)))}</td>`)).join('')}</tr>`;
  const need = mem.filter((m) => { const v = dbMean(objs.map((o) => score(m, o)).filter(notNull)); return v != null && v < 0.5; });
  const chips = cols.length > 1 ? `<div class="db-pf-chips" role="group" aria-label="Thu gọn hoặc mở cột theo bài học">${cols.map(({ g, i, open }) => `<button type="button" class="db-pf-chip" data-pf-toggle="${h(g.key)}" data-pf-slot="c${i}" aria-expanded="${open ? 'true' : 'false'}" title="${h(g.title)}"><span class="db-pf-chev" aria-hidden="true"></span><span class="db-pf-chip-t">${h(g.title)}</span><span class="muted">${g.items.length}</span></button>`).join('')}</div>` : '';
  return `<section class="panel" aria-labelledby="db-h-m">
    <h2 id="db-h-m">Bảng mức nắm vững của lớp</h2>
    <p class="lead">${mem.length} học sinh · ${objs.length} mục tiêu · ${need.length} học sinh cần hỗ trợ (trung bình dưới 50%).${f.active ? ' Số liệu tính trên phần đang hiển thị.' : ''}</p>
    ${chips}
    ${mem.length ? dbTable(head, rows.concat(classRow), 'Mức nắm vững theo học sinh và mục tiêu') : dbEmpty('Lớp chưa có học sinh.')}
  </section>
  <section class="panel" aria-labelledby="db-h-mo"><h2 id="db-h-mo">Danh sách mục tiêu</h2>
    ${cols.map(({ g, i, open }) => dbPfGroup('progress', g.key, g.title, i, open, g.items.length + ' mục tiêu', '',
      `<ul class="db-objectives">${g.items.map((o) => `<li><span class="db-obj-code">${h(o.code)}</span><span class="db-obj-text">${h(o.description)}</span></li>`).join('')}</ul>`, 'l')).join('')}
  </section>`;
}
function dbMasteryStudent(d, c) {
  const { st, f, objs, groups } = c;
  const mine = Object.fromEntries(d.mastery.map((m) => [m.objective_id, m]));
  const score = (o) => (mine[o.id] ? Number(mine[o.id].mastery_score) : null);
  const vals = objs.map(score).filter((v) => v != null), avg = dbMean(vals);
  const scopeNote = f.active ? ' (trong phần đang hiển thị)' : '';
  return `<section class="panel" aria-labelledby="db-h-sm">
    <h2 id="db-h-sm">Mức nắm vững của em</h2>
    <p class="lead">${avg == null ? 'Chưa có kết quả nào được chấm' + scopeNote + '.' : 'Trung bình ' + pct(avg) + '% trên ' + vals.length + ' mục tiêu đã có kết quả' + scopeNote + '.'}</p>
    ${groups.map((g, i) => {
      const gv = g.items.map(score).filter((v) => v != null);
      const inner = g.items.map((o) => { const m = mine[o.id], v = score(o);
        return `<div class="db-mrow"><div class="db-mrow-text"><span class="db-obj-code">${h(o.code)}</span> ${h(o.description)}</div>
          <div class="db-mrow-bar">${v == null ? '' : bar(v, tier(v) === 'good' ? 'good' : tier(v) === 'need' ? 'need' : '', 'Mức nắm vững ' + pct(v) + '%')}</div>
          <div class="db-mrow-val">${dbMasteryPill(v)}${m ? `<span class="muted"> · ${m.evidence_count} kết quả</span>` : ''}</div></div>`; }).join('');
      return dbPfGroup('progress', g.key, g.title, i, dbPfOpen(st, g.key, i, f), g.items.length + ' mục tiêu · ' + gv.length + ' có kết quả', gv.length ? dbMasteryPill(dbMean(gv)) : '', inner, 'm');
    }).join('')}
  </section>`;
}

/* ===== Lỗ hổng kiến thức ===== */
DB_PAGES.gaps = {
  title: 'Lỗ hổng kiến thức',
  sub: 'Lỗ hổng mở khi mức nắm vững một mục tiêu dưới 50% với ít nhất 2 kết quả, và tự đóng khi đạt từ 65%.',
  load: dbLoadProgress,
  view(d) { return dbPfView('gaps', d); },
};
function dbPfGaps(d, st) {
  const T = dbIsTeacher(), objById = dbById(d.objectives), other = DB_PF_OTHER;
  const keyOf = (g) => { const o = objById[g.objective_id]; return dbPfKey(d, o && o.lesson_id); };
  const { f, options } = dbPfScope(d, st, d.gaps, keyOf, other);
  const hay = (g) => { const o = objById[g.objective_id]; return (T ? dbName(d.profiles[g.student_id]) : '') + ' ' + (o ? o.code + ' ' + o.description : '') + ' ' + dbPfTitle(d, keyOf(g), other) + ' ' + (g.reason || ''); };
  const shown = d.gaps.filter((g) => (f.lesson === 'all' || keyOf(g) === f.lesson) && dbPfHit(f.tokens, hay(g)));
  const open = shown.filter((g) => g.status === 'OPEN'), closed = shown.filter((g) => g.status !== 'OPEN');
  const item = (g) => `<div class="item"><div>
      <b>${T ? h(dbName(d.profiles[g.student_id])) + ' · ' : ''}${dbObjLabel(objById[g.objective_id])}</b>
      <div class="muted">${h(g.reason || '')}${g.reason ? ' · ' : ''}mở lúc ${dbDateTime(g.opened_at)}${g.status === 'RESOLVED' ? ' · khắc phục lúc ' + dbDateTime(g.resolved_at) : ''}${g.status === 'DISMISSED' ? ' · bỏ qua lúc ' + dbDateTime(g.dismissed_at) + (g.dismiss_reason ? ' (' + h(g.dismiss_reason) + ')' : '') : ''}</div>
    </div><div class="row">${dbPill(DB_GAP_STATE[g.status][0], DB_GAP_STATE[g.status][1])}${T && g.status === 'OPEN' ? dbBtn('Bỏ qua', 'dismissGap', { id: g.id }, 'light mini') : ''}${!T && g.status === 'OPEN' ? dbBtn('Xem bài học', 'go', { page: 'lessons' }, 'light mini') : ''}</div></div>`;
  const section = (list, scope) => dbPfGroups(d, list, keyOf, other, 'all').map((g, i) => {
    const key = scope + ':' + g.key;
    return dbPfGroup('gaps', key, g.title, i, dbPfOpen(st, key, i, f), g.items.length + ' lỗ hổng', '', g.items.map(item).join(''), scope);
  }).join('');
  const openAll = d.gaps.filter((g) => g.status === 'OPEN').length;
  const lead = open.length ? open.length + ' lỗ hổng' + (T ? ' trong lớp' : ' cần em ôn lại')
    : f.active && openAll ? 'Không có lỗ hổng đang mở nào khớp bộ lọc.'
    : T ? 'Hiện không có lỗ hổng nào đang mở trong lớp.' : 'Hiện em không có lỗ hổng nào đang mở.';
  const html = `<section class="panel" aria-labelledby="db-h-g"><h2 id="db-h-g">Lỗ hổng đang mở</h2>
      <p class="lead">${lead}</p>
      ${section(open, 'o')}
    </section>
    ${closed.length ? `<section class="panel" aria-labelledby="db-h-gc"><h2 id="db-h-gc">Đã đóng</h2><p class="lead">${closed.length} lỗ hổng đã khắc phục hoặc được giáo viên bỏ qua.</p>${section(closed, 'c')}</section>` : ''}`;
  return {
    html, f, options, total: d.gaps.length, active: f.active,
    placeholder: T ? 'Mã, mô tả mục tiêu, tên học sinh hoặc lý do' : 'Mã, mô tả mục tiêu hoặc lý do',
    count: 'Hiển thị ' + shown.length + '/' + d.gaps.length + ' lỗ hổng',
  };
}
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
  view(d) { return dbPfView('recommend', d); },
};
function dbPfRecs(d, st) {
  const T = dbIsTeacher(), objById = dbById(d.objectives), exById = dbById(d.assessments), other = DB_PF_OTHER;
  /* Gợi ý xếp theo bài học của mục tiêu; không có mục tiêu thì theo bài học của bài kiểm tra (assessments.lesson_id); không có cả hai thì vào nhóm cuối. */
  const keyOf = (r) => { const o = r.objective_id && objById[r.objective_id], ex = r.assessment_id && exById[r.assessment_id]; return dbPfKey(d, (o && o.lesson_id) || (ex && ex.lesson_id)); };
  const { f, options } = dbPfScope(d, st, d.recs, keyOf, other);
  const target = (r) => (r.assessment_id && exById[r.assessment_id] ? 'Bài kiểm tra: ' + h(exById[r.assessment_id].title) : r.objective_id ? dbObjLabel(objById[r.objective_id]) : '');
  const hay = (r) => { const ex = r.assessment_id && exById[r.assessment_id], o = r.objective_id && objById[r.objective_id];
    return (T ? dbName(d.profiles[r.student_id]) : '') + ' ' + (DB_REC_KIND[r.kind] || r.kind) + ' ' + (ex ? ex.title : '') + ' ' + (o ? o.code + ' ' + o.description : '') + ' ' + dbPfTitle(d, keyOf(r), other) + ' ' + (r.reason || ''); };
  const shown = d.recs.filter((r) => (f.lesson === 'all' || keyOf(r) === f.lesson) && dbPfHit(f.tokens, hay(r)));
  const base = { f, options, total: d.recs.length, active: f.active, placeholder: T ? 'Mã, mô tả mục tiêu, tên học sinh hoặc loại gợi ý' : 'Mã, mô tả mục tiêu hoặc loại gợi ý', count: 'Hiển thị ' + shown.length + '/' + d.recs.length + ' gợi ý' };
  const none = 'Không có gợi ý nào khớp bộ lọc.';
  if (T) {
    const row = (r) => `<tr><th scope="row">${h(dbName(d.profiles[r.student_id]))}</th><td>${h(DB_REC_KIND[r.kind] || r.kind)}</td><td>${target(r)}<div class="muted">${h(r.reason || '')}</div></td>
        <td>${dbPill(DB_REC_STATE[r.status][0], DB_REC_STATE[r.status][1])}</td><td>${dbDateTime(r.created_at)}</td></tr>`;
    const groups = dbPfGroups(d, shown, keyOf, other, 'all').map((g, i) => dbPfGroup('recommend', g.key, g.title, i, dbPfOpen(st, g.key, i, f), g.items.length + ' gợi ý', '',
      dbTable(['Học sinh', 'Loại gợi ý', 'Nội dung', 'Trạng thái', 'Tạo lúc'], g.items.map(row), 'Gợi ý học tập: ' + g.title), 'r')).join('');
    return { ...base, html: `<section class="panel" aria-labelledby="db-h-r"><h2 id="db-h-r">Gợi ý đã gửi cho học sinh</h2><p class="lead">${shown.length} gợi ý</p>
        ${shown.length ? groups : dbEmpty(d.recs.length ? none : 'Chưa có gợi ý nào. Gợi ý xuất hiện sau khi bài tập hoặc bài kiểm tra có gắn mục tiêu được chấm.')}</section>` };
  }
  const card = (r) => `<article class="db-task"><div class="row between"><div>
      <b>${h(DB_REC_KIND[r.kind] || r.kind)}</b><div>${target(r)}</div><div class="muted">${h(r.reason || '')}</div></div>
    <div class="row">${dbPill(DB_REC_STATE[r.status][0], DB_REC_STATE[r.status][1])}
      ${r.status === 'ACTIVE' ? dbBtn('Nhận gợi ý', 'respondRec', { id: r.id, status: 'ACCEPTED' }, 'mini') + dbBtn('Bỏ qua', 'respondRec', { id: r.id, status: 'DISMISSED' }, 'light mini') : ''}
      ${r.status === 'ACTIVE' || r.status === 'ACCEPTED' ? (r.assessment_id ? dbBtn('Mở bài kiểm tra', 'go', { page: 'assessments', id: r.assessment_id }, 'light mini') : dbBtn('Xem bài học', 'go', { page: 'lessons' }, 'light mini')) : ''}</div></div></article>`;
  const section = (list, scope) => dbPfGroups(d, list, keyOf, other, 'all').map((g, i) => {
    const key = scope + ':' + g.key;
    return dbPfGroup('recommend', key, g.title, i, dbPfOpen(st, key, i, f), g.items.length + ' gợi ý', '', g.items.map(card).join(''), scope);
  }).join('');
  const live = shown.filter((r) => r.status === 'ACTIVE' || r.status === 'ACCEPTED'), old = shown.filter((r) => r.status === 'DISMISSED' || r.status === 'COMPLETED');
  const liveAll = d.recs.filter((r) => r.status === 'ACTIVE' || r.status === 'ACCEPTED').length;
  const lead = live.length ? live.length + ' gợi ý' : f.active && liveAll ? none : 'Hiện chưa có gợi ý nào dành cho em.';
  return { ...base, html: `<section class="panel" aria-labelledby="db-h-sr2"><h2 id="db-h-sr2">Việc nên làm tiếp</h2><p class="lead">${lead}</p>${section(live, 'n')}</section>
      ${old.length ? `<section class="panel" aria-labelledby="db-h-so"><h2 id="db-h-so">Đã xong hoặc đã bỏ qua</h2>${section(old, 'o')}</section>` : ''}` };
}
DB_ACT.respondRec = (el) => dbRun(el, async () => {
  await dbCall(EducMindDB.respondRecommendation(el.dataset.id, el.dataset.status));
}, el.dataset.status === 'ACCEPTED' ? 'Đã nhận gợi ý.' : 'Đã bỏ qua gợi ý.');

const DB_PF_RENDER = { progress: dbPfProgress, gaps: dbPfGaps, recommend: dbPfRecs };