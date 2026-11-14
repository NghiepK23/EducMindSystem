/* EducMind · js/db/15-games.js
   Trò chơi ôn tập bằng câu hỏi trắc nghiệm trong ngân hàng của lớp (1 đáp án đúng):
     - Nhanh (BLITZ): 60 giây trả lời càng nhiều càng tốt.
     - Đua tốc độ (RACE): 10 câu, mỗi câu 20 giây — trả lời càng nhanh điểm càng cao.
     - Sinh tồn (SURVIVAL): 3 mạng, trả lời sai mất một mạng.
   Các ván chơi chỉ để luyện tập: KHÔNG ảnh hưởng điểm chính thức hay mức nắm vững.
   Lịch sử ván được lưu lại (bảng game_sessions) để học sinh xem lại và giáo viên xem thống kê lớp. */

const DB_GAME_MODES = {
  BLITZ: { name: 'Nhanh', desc: '60 giây — trả lời càng nhiều càng tốt', icon: 'spark', maxQ: 20 },
  RACE: { name: 'Đua tốc độ', desc: '10 câu, mỗi câu 20 giây', icon: 'trend', maxQ: 10 },
  SURVIVAL: { name: 'Sinh tồn', desc: '3 mạng — sai là mất một mạng', icon: 'target', maxQ: 10 },
};
const DB_GAME_MODE_LABEL = Object.fromEntries(Object.entries(DB_GAME_MODES).map(([k, v]) => [k, v.name]));
let DB_GAME = null, DB_GAME_RESULT = null, DB_GAME_TICK = null;

DB_PAGES.games = {
  title: 'Trò chơi ôn tập',
  sub: 'Luyện tập bằng câu hỏi trắc nghiệm của lớp — chơi vui, không ảnh hưởng điểm số.',
  leave() { dbGameStopTick(); },
  async load() {
    if (dbIsTeacher()) return {};
    if (!DB.classId) return {};
    const content = await dbLoadContent();
    /* Học sinh KHÔNG đọc trực tiếp bảng questions (RLS) — câu hỏi trò chơi lấy qua RPC game_questions. */
    const gameQs = DB.course ? await dbCall(EducMindDB.gameQuestions(DB.course.id)) : [];
    const questions = gameQs.map((q) => ({ id: q.id, content: q.content, kind: q.kind, options: q.options, correct_answer: q.correct_answer, objective_ids: q.objective_ids || [] }));
    const sessions = DB.course ? await dbCall(EducMindDB.listGameSessions(DB.course.id)) : [];
    const roster = dbIsTeacher() ? await dbLoadRoster() : { members: [], profiles: {} };
    return { ...content, questions, sessions, ...roster };
  },
  view(d) {
    if (dbIsTeacher()) return `<section class="panel">${dbEmpty('Trò chơi chỉ dành cho học sinh. Giáo viên có thể xem trước câu hỏi trong trang Bài tập.')}</section>`;
    if (!DB.classId) return `<section class="panel">${dbEmpty('Hãy chọn một lớp để chơi.')}</section>`;
    if (DB_GAME) return dbGamePlay(d);
    return `${DB_GAME_RESULT ? dbGameResult() : ''}${dbGameLobby(d)}${dbGameHistory(d)}`;
  },
};

/* ===== Chọn chế độ và bắt đầu ===== */
function dbGamePool(d, source) {
  const auto = d.questions.filter((q) => (q.kind === 'SINGLE_CHOICE' || q.kind === 'TRUE_FALSE') && q.correct_answer != null && (Array.isArray(q.options) ? q.options.length >= 2 : true));
  if (source === 'BANK') return auto;
  const objIds = new Set(d.objectives.filter((o) => o.lesson_id === source).map((o) => o.id));
  return auto.filter((q) => (q.objective_ids || []).some((x) => objIds.has(x)));
}
function dbGameLobby(d) {
  const lessonsWithQ = d.lessons.map((l) => ({ l, n: dbGamePool(d, l.id).length })).filter((x) => x.n);
  const bankN = dbGamePool(d, 'BANK').length;
  return `<section class="panel" aria-labelledby="db-h-gl">
    <h2 id="db-h-gl">Chọn cách chơi</h2>
    <p class="lead">Câu hỏi trắc nghiệm một đáp án từ ngân hàng của lớp. Kết quả chỉ để luyện tập.</p>
    <div class="grid db-game-modes">${Object.entries(DB_GAME_MODES).map(([k, m]) => `
      <button type="button" class="db-game-mode" data-act="gamePickMode" data-mode="${k}">
        ${ic(m.icon, 20)}<b>${m.name}</b><span class="muted">${m.desc}</span>
      </button>`).join('')}</div>
    <form data-act="gameStart" class="db-form-row" novalidate>
      ${dbField('Nguồn câu hỏi', 'db-game-src', `<select id="db-game-src" name="source" required>
        <option value="BANK">Toàn bộ ngân hàng (${bankN} câu)</option>
        ${lessonsWithQ.map((x) => `<option value="${h(x.l.id)}">Bài: ${h(x.l.title)} (${x.n} câu)</option>`).join('')}
      </select>`)}
      ${dbField('Chế độ', 'db-game-mode', `<select id="db-game-mode" name="mode" required>${Object.entries(DB_GAME_MODES).map(([k, m]) => `<option value="${k}">${m.name}</option>`).join('')}</select>`)}
      <button type="submit" class="btn" ${bankN ? '' : 'disabled'}>${ic('play', 16)} Bắt đầu chơi</button>
      ${dbFormError()}
    </form>
    ${bankN ? '' : dbEmpty('Ngân hàng chưa có câu trắc nghiệm nào. Giáo viên thêm câu hỏi trong “Ngân hàng câu hỏi”.')}
  </section>`;
}
DB_ACT.gamePickMode = (el) => {
  const sel = document.getElementById('db-game-mode');
  if (sel) sel.value = el.dataset.mode;
  document.querySelectorAll('.db-game-mode').forEach((b) => b.classList.toggle('chosen', b.dataset.mode === el.dataset.mode));
};

function dbGameShuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
DB_ACT.gameStart = (form) => dbRun(form, async (v) => {
  const d = DB.data, mode = v.mode, pool = dbGamePool(d, v.source);
  if (!pool.length) throw new Error('Nguồn câu hỏi này chưa có câu trắc nghiệm nào.');
  const n = Math.min(pool.length, DB_GAME_MODES[mode].maxQ);
  DB_GAME_RESULT = null;
  DB_GAME = {
    mode, source: v.source, sourceLabel: v.source === 'BANK' ? 'Toàn bộ ngân hàng' : (dbById(d.lessons)[v.source] || {}).title || '',
    pool: dbGameShuffle(pool).slice(0, n), idx: 0, score: 0, correct: 0, asked: 0,
    lives: mode === 'SURVIVAL' ? 3 : 0, answered: false, chosen: -1,
    startedAt: Date.now(), endsAt: mode === 'BLITZ' ? Date.now() + 60000 : 0, qEndsAt: mode === 'RACE' ? Date.now() + 20000 : 0,
  };
  dbGameStartTick();
  render();
  return false; /* tự vẽ lại trạng thái chơi */
}, 'Sẵn sàng!');

/* ===== Đang chơi ===== */
function dbGamePlay(d) {
  const g = DB_GAME, q = g.pool[g.idx], opts = Array.isArray(q.options) ? q.options : [];
  const total = g.pool.length;
  const clock = g.mode === 'BLITZ' ? `<span class="db-game-clock" id="db-game-clock">60s</span>`
    : g.mode === 'RACE' ? `<span class="db-game-clock" id="db-game-clock">20s</span>`
    : `<span class="db-game-lives" aria-label="Số mạng">${'❤'.repeat(Math.max(0, g.lives))}${'♡'.repeat(Math.max(0, 3 - g.lives))}</span>`;
  const rightIdx = q.kind === 'TRUE_FALSE' ? (q.correct_answer === true || String(q.correct_answer).toLowerCase() === 'true' ? 0 : 1) : Number(q.correct_answer);
  return `<section class="panel db-game-panel" aria-labelledby="db-h-gp">
    <div class="row between db-game-bar">
      <div class="row">${ic(DB_GAME_MODES[g.mode].icon, 18)}<b>${DB_GAME_MODES[g.mode].name}</b><span class="muted">Câu ${g.idx + 1}/${total}</span>${g.mode === 'SURVIVAL' ? '<span class="muted">·</span>' + clock : ''}</div>
      <div class="row"><span class="db-game-score">Điểm: <b id="db-game-score">${g.score}</b></span>${g.mode !== 'SURVIVAL' ? clock : ''}${dbBtn('Dừng & lưu ván', 'gameFinish', {}, 'light mini')}</div>
    </div>
    <h2 id="db-h-gp" class="db-qtext">${h(q.content)}</h2>
    <div class="db-game-opts">${opts.map((o, i) => {
      let cls = 'db-game-opt';
      if (g.answered) { if (i === rightIdx) cls += ' right'; else if (i === g.chosen) cls += ' wrong'; }
      return `<button type="button" class="${cls}" data-act="gameAnswer" data-i="${i}" ${g.answered ? 'disabled' : ''}><b>${dbLetter(i)}.</b> ${h(o)}</button>`;
    }).join('')}</div>
    ${g.answered ? `<div class="notice">${g.chosen === rightIdx ? ic('check', 16) + '<div><b>Chính xác!</b></div>' : ic('alert', 16) + '<div><b>Chưa đúng.</b> Đáp án đúng là ' + dbLetter(rightIdx) + '.</div>'}</div>
      <div class="row db-form-actions">${g.idx + 1 < total && (g.mode !== 'SURVIVAL' || g.lives > 0) ? dbBtn('Câu tiếp theo', 'gameNext', {}, '') : dbBtn('Kết thúc ván', 'gameFinish', {}, '')}</div>` : ''}
    ${dbFormError()}
  </section>`;
}
DB_ACT.gameAnswer = (el) => {
  const g = DB_GAME;
  if (!g || g.answered) return;
  const q = g.pool[g.idx], i = Number(el.dataset.i);
  const rightIdx = q.kind === 'TRUE_FALSE' ? (q.correct_answer === true || String(q.correct_answer).toLowerCase() === 'true' ? 0 : 1) : Number(q.correct_answer);
  g.answered = true; g.chosen = i; g.asked++;
  if (i === rightIdx) {
    g.correct++;
    g.score += g.mode === 'RACE' ? 10 + Math.max(0, Math.round((g.qEndsAt - Date.now()) / 1000)) : 10;
  } else if (g.mode === 'SURVIVAL') g.lives--;
  render();
};
DB_ACT.gameNext = () => {
  const g = DB_GAME;
  if (!g) return;
  g.idx++; g.answered = false; g.chosen = -1;
  if (g.mode === 'RACE') g.qEndsAt = Date.now() + 20000;
  render();
};
/* Kết thúc ván: lưu lịch sử rồi hiện kết quả. */
DB_ACT.gameFinish = () => dbRun(document.body, async () => {
  const g = DB_GAME;
  if (!g) return false;
  dbGameStopTick();
  const duration = Math.max(1, Math.round((Date.now() - g.startedAt) / 1000));
  if (g.asked > 0) {
    await dbCall(EducMindDB.createGameSession({
      course_id: DB.course.id, mode: g.mode, source: g.source,
      question_count: g.asked, correct_count: g.correct, score: g.score, duration_seconds: duration,
    }));
  }
  DB_GAME_RESULT = { mode: g.mode, score: g.score, correct: g.correct, asked: g.asked, duration, saved: g.asked > 0 };
  DB_GAME = null;
  render();
  return false; /* tự vẽ lại trang kết quả */
});
function dbGameResult() {
  const r = DB_GAME_RESULT;
  return `<section class="panel" aria-labelledby="db-h-gr">
    <h2 id="db-h-gr">Kết quả ván ${h(DB_GAME_MODE_LABEL[r.mode] || r.mode)}</h2>
    <div class="facts">
      <div><span>Điểm</span><b>${dbNum(r.score)}</b></div>
      <div><span>Trả lời đúng</span><b>${r.correct}/${r.asked}</b></div>
      <div><span>Thời gian</span><b>${dbNum(r.duration)} giây</b></div>
    </div>
    <p class="lead">${r.saved ? 'Ván chơi đã được lưu vào lịch sử.' : 'Chưa có câu nào được trả lời nên ván này không lưu.'}</p>
    <div class="row db-form-actions">${dbBtn('Chơi ván mới', 'gameAgain', {}, '')}</div>
  </section>`;
}
DB_ACT.gameAgain = () => { DB_GAME_RESULT = null; render(); };

/* Đồng hồ đếm (BLITZ tổng 60s / RACE từng câu 20s): chỉ sơn trực tiếp lên ô giờ, không vẽ lại trang. */
function dbGameStartTick() {
  dbGameStopTick();
  if (!DB_GAME || (DB_GAME.mode !== 'BLITZ' && DB_GAME.mode !== 'RACE')) return;
  DB_GAME_TICK = setInterval(() => {
    const g = DB_GAME;
    if (!g) return dbGameStopTick();
    const ms = g.mode === 'BLITZ' ? g.endsAt - Date.now() : g.qEndsAt - Date.now();
    const el = document.getElementById('db-game-clock');
    const secs = Math.max(0, Math.ceil(ms / 1000));
    if (el) el.textContent = secs + 's';
    if (ms <= 0) {
      if (g.mode === 'BLITZ') DB_ACT.gameFinish();
      else {
        /* Hết giờ một câu: tính là trả lời sai rồi chuyển câu. */
        const q = g.pool[g.idx];
        g.answered = true; g.chosen = -1; g.asked++;
        if (g.mode === 'SURVIVAL') g.lives--;
        render();
        if (g.idx + 1 < g.pool.length && (g.mode !== 'SURVIVAL' || g.lives > 0)) DB_ACT.gameNext(); else DB_ACT.gameFinish();
      }
    }
  }, 250);
}
function dbGameStopTick() { if (DB_GAME_TICK) { clearInterval(DB_GAME_TICK); DB_GAME_TICK = null; } }

/* ===== Lịch sử & thống kê ===== */
function dbGameHistory(d) {
  const mine = dbIsTeacher() ? d.sessions : d.sessions.filter((s) => s.student_id === (DB.me || {}).id);
  const rows = mine.slice(0, 20).map((s) => `<tr>
    ${dbIsTeacher() ? `<th scope="row">${h(dbName(d.profiles[s.student_id]))}</th>` : ''}
    <td>${h(DB_GAME_MODE_LABEL[s.mode] || s.mode)}</td>
    <td>${s.correct_count}/${s.question_count}</td>
    <td><b>${dbNum(s.score)}</b></td>
    <td>${dbNum(s.duration_seconds)} giây</td>
    <td>${dbDateTime(s.played_at)}</td></tr>`);
  const heads = [...(dbIsTeacher() ? ['Học sinh'] : []), 'Chế độ', 'Đúng', 'Điểm', 'Thời gian', 'Chơi lúc'];
  return `<section class="panel" aria-labelledby="db-h-gh"><h2 id="db-h-gh">${dbIsTeacher() ? 'Lịch sử chơi của lớp' : 'Các ván của em'}</h2>
    ${rows.length ? dbTable(heads, rows, 'Lịch sử trò chơi') : dbEmpty('Chưa có ván nào được lưu.')}</section>`;
}
