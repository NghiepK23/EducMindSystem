/* EducMind · js/db/15-games.js
   Trò chơi ôn tập bằng câu hỏi trong ngân hàng của lớp. Mỗi chế độ nhận các dạng câu khác nhau (DB_GAME_MODES[].kinds):
     Nhanh / Đua tốc độ: một lựa chọn, đúng/sai (bấm là xong).
     Sinh tồn "Giữ căn cứ": cả 5 dạng chấm tự động (một/nhiều lựa chọn, đúng/sai, điền khuyết, ghép đôi),
       mỗi dạng một cách tương tác riêng; đúng/sai tính theo cả câu (sai một ý là sai cả câu).
   Trả lời ngắn và tự luận không có trong trò chơi (không có đáp án chuẩn để máy chấm).
   Mô tả cũ của từng chế độ:
     - Nhanh (BLITZ): 60 giây; đúng liên tiếp để nhân điểm (x2–x4) và cộng thêm giây; tự chuyển câu.
     - Đua tốc độ (RACE): 10 câu, mỗi câu 20 giây — trả lời càng nhanh điểm càng cao.
     - Sinh tồn (SURVIVAL): 3 mạng, trả lời sai mất một mạng.
   Các ván chơi chỉ để luyện tập: KHÔNG ảnh hưởng điểm chính thức hay mức nắm vững.
   Lịch sử ván được lưu lại (bảng game_sessions) để học sinh xem lại và giáo viên xem thống kê lớp.
   Mới: âm thanh (Web Audio, mặc định TẮT), lời giải thích (trường explain), thanh thời gian cạn dần,
        chuỗi đúng, kỷ lục cá nhân, màn kết quả có xem lại câu sai, phím tắt 1–4 / A–D / Enter. */

const DB_GAME_KINDS_TAP = ['SINGLE_CHOICE', 'TRUE_FALSE'];
const DB_GAME_KINDS_ALL = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANK', 'MATCHING'];
const DB_GAME_KIND_HINT = {
  SINGLE_CHOICE: 'Chọn 1 đáp án đúng', MULTIPLE_CHOICE: 'Chọn TẤT CẢ đáp án đúng rồi bấm “Chốt đáp án”',
  TRUE_FALSE: 'Chọn Đúng hoặc Sai', FILL_IN_BLANK: 'Điền vào chỗ trống rồi bấm “Chốt đáp án” (hoặc Enter)',
  MATCHING: 'Bấm một mục bên trái, rồi bấm mục tương ứng bên phải',
};
const DB_GAME_ENEMY = { SINGLE_CHOICE: '🐛', MULTIPLE_CHOICE: '🦠', TRUE_FALSE: '👾', FILL_IN_BLANK: '🕷️', MATCHING: '🧩' };
const DB_GAME_MODES = {
  BLITZ: { name: 'Nhanh', desc: '60 giây — đúng liên tiếp để nhân điểm và cộng giây', icon: 'spark', maxQ: 0 /* 0 = không giới hạn, xoay vòng câu hỏi */, kinds: DB_GAME_KINDS_TAP },
  RACE: { name: 'Đua tốc độ', desc: '10 câu, mỗi câu 20 giây', icon: 'trend', maxQ: 10, kinds: DB_GAME_KINDS_TAP },
  SURVIVAL: { name: 'Sinh tồn — Giữ căn cứ', desc: '10 đợt tấn công, 3 khiên — đủ mọi dạng câu hỏi', icon: 'target', maxQ: 10, kinds: DB_GAME_KINDS_ALL },
};
const DB_GAME_MODE_LABEL = Object.fromEntries(Object.entries(DB_GAME_MODES).map(([k, v]) => [k, v.name]));
const DB_GAME_BLITZ_MS = 60000, DB_GAME_RACE_MS = 20000;
let DB_GAME = null, DB_GAME_RESULT = null, DB_GAME_TICK = null, DB_GAME_ADV = null, DB_GAME_MODE_PICK = 'BLITZ', DB_GAME_SRC_PICK = 'BANK';
const DB_GAME_BEST = {}; /* kỷ lục cục bộ theo chế độ trong phiên (dữ liệu tải lúc mở trang có thể cũ) */

/* ===== Âm thanh: Web Audio, không cần tệp. Mặc định TẮT (lớp học nhiều em chơi cùng lúc). ===== */
const DbSfx = (() => {
  const KEY = 'educmind.sfx';
  let ctx = null, on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (_) { on = false; }
  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (_) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq, start, dur, type, vol) {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime + start, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const sounds = {
    right: () => { tone(660, 0, 0.12, 'triangle'); tone(880, 0.09, 0.18, 'triangle'); },
    wrong: () => { tone(220, 0, 0.18, 'sawtooth', 0.07); tone(165, 0.12, 0.25, 'sawtooth', 0.07); },
    tick: () => tone(1000, 0, 0.05, 'square', 0.04),
    combo: () => { tone(784, 0, 0.1, 'triangle'); tone(988, 0.08, 0.1, 'triangle'); tone(1175, 0.16, 0.2, 'triangle'); },
    finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle')),
    click: () => tone(520, 0, 0.05, 'sine', 0.08),
  };
  return {
    get enabled() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* bỏ qua */ }
      if (on) sounds.click();
      return on;
    },
    play(name) { if (on && sounds[name]) { try { sounds[name](); } catch (_) { /* bỏ qua */ } } },
  };
})();
function dbGameSoundBtn() {
  const on = DbSfx.enabled;
  return `<button type="button" class="btn light mini db-game-sound" data-noicon="1" data-act="gameToggleSound" aria-pressed="${on}">${on ? '🔊 Âm thanh: Bật' : '🔇 Âm thanh: Tắt'}</button>`;
}
DB_ACT.gameToggleSound = () => {
  const on = DbSfx.toggle();
  document.querySelectorAll('.db-game-sound').forEach((b) => {
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? '🔊 Âm thanh: Bật' : '🔇 Âm thanh: Tắt';
  });
};

/* ===== Trang ===== */
DB_PAGES.games = {
  title: 'Trò chơi ôn tập',
  sub: 'Luyện tập bằng câu hỏi của lớp — chơi vui, không ảnh hưởng điểm số.',
  /* Rời trang: dừng đồng hồ/hẹn giờ và bỏ ván đang dở (đồng hồ không chạy khi không ở trang này). */
  leave() { dbGameStopTick(); dbGameClearAdv(); DB_GAME = null; DB_GAME_RESULT = null; },
  async load() {
    if (dbIsTeacher()) return {};
    if (!DB.classId) return {};
    const content = await dbLoadContent();
    /* Học sinh KHÔNG đọc trực tiếp bảng questions (RLS) — câu hỏi trò chơi lấy qua RPC game_questions. */
    const gameQs = DB.course ? await dbCall(EducMindDB.gameQuestions(DB.course.id)) : [];
    const questions = gameQs.map((q) => ({ id: q.id, content: q.content, kind: q.kind, options: q.options, correct_answer: q.correct_answer, explain: q.explain || '', objective_ids: q.objective_ids || [] }));
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

/* ===== Tiện ích câu hỏi ===== */
/* Câu Đúng/Sai không có options thì dùng nhãn mặc định để vẫn có nút bấm. */
function dbGameOpts(q) {
  if (Array.isArray(q.options) && q.options.length) return q.options.map(String);
  return q.kind === 'TRUE_FALSE' ? ['Đúng', 'Sai'] : [];
}
function dbGameRight(q) {
  return q.kind === 'TRUE_FALSE' ? (q.correct_answer === true || String(q.correct_answer).toLowerCase() === 'true' ? 0 : 1) : Number(q.correct_answer);
}
function dbGameShuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function dbGameMatching(q) {
  const o = q.options && !Array.isArray(q.options) ? q.options : {};
  return { left: Array.isArray(o.left) ? o.left.map(String) : [], right: Array.isArray(o.right) ? o.right.map(String) : [] };
}
/* Câu có dạng dữ liệu hỏng thì bỏ qua (không để cả ván bị lỗi). */
function dbGameValid(q) {
  const a = q.correct_answer;
  if (a == null) return false;
  switch (q.kind) {
    case 'SINGLE_CHOICE': return Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(Number(a)) && Number(a) >= 0 && Number(a) < q.options.length;
    case 'MULTIPLE_CHOICE': return Array.isArray(q.options) && q.options.length >= 2 && Array.isArray(a) && a.length >= 1 && a.every((x) => Number.isInteger(Number(x)) && Number(x) >= 0 && Number(x) < q.options.length);
    case 'TRUE_FALSE': return typeof a === 'boolean' || /^(true|false)$/i.test(String(a));
    case 'FILL_IN_BLANK': return Array.isArray(a) && a.length >= 1 && a.length === (String(q.content || '').match(/_{3,}/g) || []).length;
    case 'MATCHING': { const m = dbGameMatching(q); return m.left.length >= 2 && m.left.length === m.right.length && Array.isArray(a) && a.length === m.left.length && a.every((x) => Number(x) >= 0 && Number(x) < m.right.length); }
    default: return false;
  }
}
/* Chuẩn hóa chữ khi so điền khuyết: bỏ khoảng trắng đầu/cuối và thừa, không phân biệt hoa/thường.
   (Máy chủ chấm bài chính thức chỉ bỏ khoảng trắng đầu/cuối + không phân biệt hoa/thường; trò chơi ôn tập dễ tính hơn một chút.) */
const dbGameNorm = (s) => String(s == null ? '' : s).normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
/* Chấm một câu. Đáp án của học sinh: một/đúng-sai = số thứ tự; nhiều lựa chọn = mảng số; điền khuyết = mảng chuỗi; ghép đôi = mảng (số | null).
   Trả về { ok, parts } — parts (điền khuyết / ghép đôi) là mảng đúng-sai theo từng ý để hiện dấu ✓/✗. Một câu chỉ đúng khi đúng tất cả các ý. */
function dbGameGrade(q, a) {
  switch (q.kind) {
    case 'SINGLE_CHOICE': case 'TRUE_FALSE':
      return { ok: typeof a === 'number' && a === dbGameRight(q), parts: null };
    case 'MULTIPLE_CHOICE': {
      const key = new Set([].concat(q.correct_answer).map(Number)), sel = new Set(Array.isArray(a) ? a.map(Number) : []);
      return { ok: key.size === sel.size && [...key].every((x) => sel.has(x)), parts: null };
    }
    case 'FILL_IN_BLANK': {
      const ans = Array.isArray(a) ? a : [], parts = q.correct_answer.map((k, i) => dbGameNorm(ans[i]) !== '' && dbGameNorm(ans[i]) === dbGameNorm(k));
      return { ok: parts.every(Boolean), parts };
    }
    case 'MATCHING': {
      const ans = Array.isArray(a) ? a : [], parts = q.correct_answer.map((k, i) => ans[i] != null && Number(ans[i]) === Number(k));
      return { ok: parts.every(Boolean), parts };
    }
    default: return { ok: false, parts: null };
  }
}
/* Đáp án đúng / đáp án của em ở dạng chữ (dùng cho phản hồi và màn xem lại). */
function dbGameKeyText(q) { return dbGameAnswerText(q, q.kind === 'SINGLE_CHOICE' || q.kind === 'TRUE_FALSE' ? dbGameRight(q) : q.kind === 'MULTIPLE_CHOICE' ? q.correct_answer.map(Number) : q.correct_answer); }
function dbGameAnswerText(q, a) {
  if (a == null || (Array.isArray(a) && !a.length)) return '';
  const o = dbGameOpts(q);
  if (q.kind === 'SINGLE_CHOICE' || q.kind === 'TRUE_FALSE') return dbLetter(a) + '. ' + (o[a] == null ? '' : o[a]);
  if (q.kind === 'MULTIPLE_CHOICE') return a.map((i) => dbLetter(i) + '. ' + (o[i] == null ? '' : o[i])).join('; ');
  if (q.kind === 'FILL_IN_BLANK') return a.map((x, i) => `${i + 1}. ${x == null || x === '' ? '(bỏ trống)' : x}`).join(' · ');
  const m = dbGameMatching(q);
  return a.map((r, i) => `${m.left[i] || ''} → ${r == null ? '(chưa nối)' : (m.right[Number(r)] || '')}`).join(' · ');
}
/* Dữ liệu nháp theo dạng câu khi đang trả lời (chưa chốt). */
function dbGameNewDraft(q) {
  if (q.kind === 'MULTIPLE_CHOICE') return { sel: [] };
  if (q.kind === 'MATCHING') {
    const n = dbGameMatching(q).left.length, key = q.correct_answer.map(Number), base = Array.from({ length: n }, (_, i) => i);
    let order = dbGameShuffle(base);
    for (let t = 0; t < 6 && order.every((r, i) => r === key[i]); t++) order = dbGameShuffle(base); /* tránh cột phải đã xếp sẵn đúng thứ tự */
    return { pairs: Array(n).fill(null), pick: null, order };
  }
  return {};
}
function dbGameClearAdv() { if (DB_GAME_ADV) { clearTimeout(DB_GAME_ADV); DB_GAME_ADV = null; } }
function dbGameSchedule(ms) {
  dbGameClearAdv();
  const g = DB_GAME;
  DB_GAME_ADV = setTimeout(() => { DB_GAME_ADV = null; if (DB_GAME === g) DB_ACT.gameNext(); }, ms);
}

/* ===== Chọn chế độ và bắt đầu ===== */
function dbGamePool(d, source, mode) {
  const kinds = DB_GAME_MODES[mode || DB_GAME_MODE_PICK].kinds;
  const auto = d.questions.filter((q) => kinds.includes(q.kind) && dbGameValid(q));
  if (source === 'BANK') return auto;
  const objIds = new Set(d.objectives.filter((o) => o.lesson_id === source).map((o) => o.id));
  return auto.filter((q) => (q.objective_ids || []).some((x) => objIds.has(x)));
}
function dbGameLobby(d) {
  const lessonsWithQ = d.lessons.map((l) => ({ l, n: dbGamePool(d, l.id).length })).filter((x) => x.n);
  const bankN = dbGamePool(d, 'BANK').length;
  const srcPick = DB_GAME_SRC_PICK === 'BANK' || lessonsWithQ.some((x) => x.l.id === DB_GAME_SRC_PICK) ? DB_GAME_SRC_PICK : 'BANK';
  const modes = Object.entries(DB_GAME_MODES).map(([k, m]) => `
    <button type="button" class="db-game-mode${DB_GAME_MODE_PICK === k ? ' chosen' : ''}" aria-pressed="${DB_GAME_MODE_PICK === k}" data-act="gamePickMode" data-mode="${k}" data-noicon="1">
      <span class="db-game-mode-icon">${ic(m.icon, 21)}</span>
      <span class="db-game-mode-copy"><b>${m.name}</b><small>${m.desc}</small><small class="db-game-mode-count">${dbGamePool(d, 'BANK', k).length} câu dùng được</small></span>
      <span class="db-game-mode-radio" aria-hidden="true">${DB_GAME_MODE_PICK === k ? '✓' : ''}</span>
    </button>`).join('');
  return `<div class="db-game-lobby-layout">
    <section class="panel db-game-lobby" aria-labelledby="db-h-gl">
      <header class="db-game-lobby-hero">
        <span class="db-game-lobby-kicker">✦ LUYỆN TẬP THEO CÁCH CỦA EM</span>
        <h2 id="db-h-gl">Chọn cách chơi</h2>
        <p>Mỗi chế độ có cách chơi riêng và nhận các dạng câu hỏi khác nhau từ ngân hàng của lớp.</p>
      </header>
      <div class="db-game-lobby-body">
        <div class="db-game-lobby-heading"><div><h3>Chế độ chơi</h3><p>Chọn một cách luyện tập để bắt đầu</p></div><span>${bankN} câu cho chế độ này</span></div>
        <div class="db-game-modes" role="group" aria-label="Chọn chế độ chơi">${modes}</div>
        <form data-act="gameStart" class="db-game-start-form" novalidate>
          ${dbField('Nguồn câu hỏi', 'db-game-src', `<select id="db-game-src" name="source" required>
            <option value="BANK"${srcPick === 'BANK' ? ' selected' : ''}>Toàn bộ ngân hàng (${bankN} câu)</option>
            ${lessonsWithQ.map((x) => `<option value="${h(x.l.id)}"${srcPick === x.l.id ? ' selected' : ''}>Bài: ${h(x.l.title)} (${x.n} câu)</option>`).join('')}
          </select>`)}
          <input type="hidden" id="db-game-mode" name="mode" value="${h(DB_GAME_MODE_PICK)}">
          ${dbFormError()}
          <button type="submit" class="btn db-game-start" ${bankN ? '' : 'disabled'}>${ic('play', 16)} Bắt đầu ${DB_GAME_MODES[DB_GAME_MODE_PICK].name}</button>
        </form>
        ${bankN ? '' : dbEmpty('Chế độ này chưa có câu hỏi phù hợp. Giáo viên thêm câu hỏi trong “Ngân hàng câu hỏi”.')}
      </div>
    </section>
    <aside class="panel db-game-lobby-aside" aria-label="Thông tin trò chơi">
      <h3>Thông tin trò chơi</h3>
      <div class="db-game-lobby-fact"><span aria-hidden="true">📚</span><div><b>Nguồn câu hỏi</b><small>${dbGamePool(d, 'BANK', 'SURVIVAL').length} câu chơi được (mọi chế độ)</small></div></div>
      <div class="db-game-lobby-fact"><span aria-hidden="true">🗂️</span><div><b>Bài học có câu hỏi</b><small>${lessonsWithQ.length} bài học</small></div></div>
      <div class="db-game-lobby-fact"><span aria-hidden="true">🎧</span><div><b>Âm thanh</b><small>Mặc định tắt. Bật khi em chơi một mình hoặc dùng tai nghe.</small></div></div>
      <div class="db-game-lobby-sound">${dbGameSoundBtn()}</div>
      <div class="db-game-lobby-note">Đây là hoạt động ôn tập độc lập. Kết quả được lưu trong lịch sử trò chơi, không thay thế điểm bài tập chính thức.</div>
    </aside>
  </div>`;
}
DB_ACT.gamePickMode = (el) => {
  /* Đổi chế độ làm thay đổi số câu khả dụng theo nguồn, nên vẽ lại sảnh (giữ nguồn đang chọn). */
  const sel = document.getElementById('db-game-src');
  if (sel) DB_GAME_SRC_PICK = sel.value;
  DB_GAME_MODE_PICK = el.dataset.mode;
  render();
};

function dbGameBegin(d, mode, source) {
  const m = DB_GAME_MODES[mode];
  if (!m) throw new Error('Chế độ chơi không hợp lệ.');
  const pool = dbGamePool(d, source, mode);
  if (!pool.length) throw new Error('Nguồn câu hỏi này chưa có câu phù hợp với chế độ ' + m.name + '.');
  DB_GAME_SRC_PICK = source;
  const shuffled = dbGameShuffle(pool), now = Date.now();
  dbGameClearAdv();
  DB_GAME_RESULT = null;
  DB_GAME = {
    mode, source, sourceLabel: source === 'BANK' ? 'Toàn bộ ngân hàng' : (dbById(d.lessons)[source] || {}).title || '',
    allQ: pool, pool: mode === 'BLITZ' ? shuffled : shuffled.slice(0, Math.min(pool.length, m.maxQ)),
    idx: 0, score: 0, correct: 0, asked: 0, streak: 0, maxStreak: 0, wrong: [],
    lives: mode === 'SURVIVAL' ? 3 : 0, answered: false, chosen: null, ok: false, parts: null, timedOut: false, lastGain: 0, lastNote: '', log: [], draft: null,
    startedAt: now, endsAt: mode === 'BLITZ' ? now + DB_GAME_BLITZ_MS : 0, totalMs: mode === 'BLITZ' ? DB_GAME_BLITZ_MS : 0,
    qEndsAt: mode === 'RACE' ? now + DB_GAME_RACE_MS : 0, lastTickSec: null, finishing: false,
  };
  DB_GAME.draft = dbGameNewDraft(DB_GAME.pool[0]);
  dbGameStartTick();
}
DB_ACT.gameStart = (form) => dbRun(form, async (v) => {
  dbGameBegin(DB.data, v.mode, v.source);
  DbSfx.play('click');
  render(); dbGameFocus();
  return false; /* tự vẽ lại trạng thái chơi */
}, 'Sẵn sàng!');
/* Chơi lại cùng chế độ và nguồn câu hỏi. */
DB_ACT.gameReplay = () => {
  const r = DB_GAME_RESULT;
  if (!r) return;
  try { dbGameBegin(DB.data, r.mode, r.source); DbSfx.play('click'); render(); dbGameFocus(); }
  catch (e) { toast(e.message || 'Không thể bắt đầu ván mới.'); }
};

/* ===== Đang chơi ===== */
function dbGameMult(streakAfter) { return Math.min(3, Math.floor(streakAfter / 3)) + 1; }
function dbGameTimeLeft(g) {
  if (g.mode === 'BLITZ') return { ms: g.endsAt - Date.now(), total: g.totalMs };
  if (g.mode === 'RACE') return { ms: g.qEndsAt - Date.now(), total: DB_GAME_RACE_MS };
  return null;
}
/* Sau khi vẽ câu mới: đưa con trỏ vào ô điền đầu tiên (câu điền khuyết). */
function dbGameFocus() {
  setTimeout(() => { const g = DB_GAME; if (g && !g.answered) { const el = document.querySelector('.db-game-gap'); if (el) el.focus(); } }, 30);
}
function dbGameIsTap(q) { return q.kind === 'SINGLE_CHOICE' || q.kind === 'TRUE_FALSE'; }

/* Câu điền khuyết: nội dung câu hỏi với ô nhập ngay tại chỗ trống. */
function dbGameFillMarkup(g, q) {
  const done = g.answered, vals = done && Array.isArray(g.chosen) ? g.chosen : [];
  let gap = 0;
  return String(q.content || '').split(/(_{3,})/g).map((part) => {
    if (!/^_{3,}$/.test(part)) return h(part);
    const i = gap++, cls = done ? (g.parts && g.parts[i] ? ' ok' : ' bad') : '';
    return `<input class="db-game-gap${cls}" type="text" maxlength="200" data-gap="${i}" aria-label="Chỗ trống ${i + 1}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${h(vals[i] == null ? '' : vals[i])}"${done ? ' disabled' : ''}>`;
  }).join('');
}
/* Câu ghép đôi: bấm một mục bên trái rồi bấm mục bên phải để nối; bấm lại để gỡ. */
function dbGameMatchMarkup(g, q) {
  const m = dbGameMatching(q);
  if (g.answered) {
    const key = q.correct_answer.map(Number), ans = Array.isArray(g.chosen) ? g.chosen : [];
    return `<ul class="db-game-match-result">${m.left.map((l, i) => {
      const ok = ans[i] != null && Number(ans[i]) === key[i];
      return `<li class="${ok ? 'ok' : 'bad'}"><span class="db-game-mark" aria-hidden="true">${ok ? '✓' : '✗'}</span><span><b>${h(l)}</b> → ${h(ans[i] == null ? '(chưa nối)' : m.right[Number(ans[i])])}${ok ? '' : ` <small>Đúng: ${h(m.right[key[i]])}</small>`}</span></li>`;
    }).join('')}</ul>`;
  }
  const dr = g.draft, owner = {};
  dr.pairs.forEach((r, i) => { if (r != null) owner[r] = i; });
  const left = m.left.map((l, i) => {
    const cls = 'db-match-item' + (dr.pairs[i] != null ? ` paired p${i % 6}` : '') + (dr.pick === i ? ' picking' : '');
    return `<button type="button" class="${cls}" data-act="gameMatchL" data-i="${i}" data-noicon="1" aria-pressed="${dr.pick === i}">${h(l)}${dr.pairs[i] != null ? `<span class="db-match-tag" aria-hidden="true">${i + 1}</span>` : ''}</button>`;
  }).join('');
  const right = dr.order.map((r) => {
    const o = owner[r];
    return `<button type="button" class="db-match-item${o != null ? ` paired p${o % 6}` : ''}" data-act="gameMatchR" data-r="${r}" data-noicon="1">${h(m.right[r])}${o != null ? `<span class="db-match-tag" aria-hidden="true">${o + 1}</span>` : ''}</button>`;
  }).join('');
  return `<div class="db-game-match-col">${left}</div><div class="db-game-match-col">${right}</div>`;
}
function dbGameMatchRepaint() {
  const g = DB_GAME, box = document.getElementById('db-game-match');
  if (!g || !box) return;
  box.innerHTML = dbGameMatchMarkup(g, g.pool[g.idx]);
  const b = document.getElementById('db-game-submit');
  if (b) b.disabled = g.draft.pairs.some((x) => x == null);
}
DB_ACT.gameMatchL = (el) => {
  const g = DB_GAME;
  if (!g || g.answered) return;
  const i = Number(el.dataset.i), dr = g.draft;
  if (dr.pairs[i] != null) { dr.pairs[i] = null; dr.pick = i; } /* gỡ cặp cũ và chọn lại mục này */
  else dr.pick = dr.pick === i ? null : i;
  DbSfx.play('click'); dbGameMatchRepaint();
};
DB_ACT.gameMatchR = (el) => {
  const g = DB_GAME;
  if (!g || g.answered) return;
  const r = Number(el.dataset.r), dr = g.draft, holder = dr.pairs.indexOf(r);
  if (dr.pick == null) { if (holder >= 0) dr.pairs[holder] = null; } /* chưa chọn mục trái: bấm mục đã nối để gỡ */
  else { if (holder >= 0) dr.pairs[holder] = null; dr.pairs[dr.pick] = r; dr.pick = null; }
  DbSfx.play('click'); dbGameMatchRepaint();
};
/* Nhiều lựa chọn: bật/tắt trực tiếp trên giao diện (không vẽ lại để giữ vị trí cuộn và tiêu điểm). */
function dbGameToggleOpt(i, btn) {
  const g = DB_GAME;
  if (!g || g.answered || g.pool[g.idx].kind !== 'MULTIPLE_CHOICE') return;
  const sel = g.draft.sel, at = sel.indexOf(i);
  if (at >= 0) sel.splice(at, 1); else sel.push(i);
  const b = btn || document.querySelector(`.db-game-opt.multi[data-i="${i}"]`);
  if (b) { b.classList.toggle('on', at < 0); b.setAttribute('aria-pressed', String(at < 0)); }
  const mark = b && b.querySelector('.db-game-check'); if (mark) mark.textContent = at < 0 ? '☑' : '☐';
  DbSfx.play('click');
}
DB_ACT.gameToggle = (el) => dbGameToggleOpt(Number(el.dataset.i), el);
/* Chốt đáp án cho các dạng cần bấm nút (nhiều lựa chọn, điền khuyết, ghép đôi). */
DB_ACT.gameSubmit = () => {
  const g = DB_GAME;
  if (!g || g.answered || g.finishing) return;
  const q = g.pool[g.idx];
  if (q.kind === 'MULTIPLE_CHOICE') {
    if (!g.draft.sel.length) { toast('Hãy chọn ít nhất một đáp án.'); return; }
    dbGameResolve([...g.draft.sel].sort((x, y) => x - y));
  } else if (q.kind === 'FILL_IN_BLANK') {
    const vals = [...document.querySelectorAll('.db-game-gap')].map((el) => el.value);
    if (!vals.some((v) => v.trim())) { toast('Hãy điền ít nhất một chỗ trống.'); return; }
    dbGameResolve(vals);
  } else if (q.kind === 'MATCHING') {
    if (g.draft.pairs.some((x) => x == null)) { toast('Hãy nối đủ tất cả các mục.'); return; }
    dbGameResolve([...g.draft.pairs]);
  }
};

/* Vùng trả lời theo từng dạng câu. */
function dbGameAnswerArea(g, q) {
  const done = g.answered, submit = (label) => done ? '' : `<div class="row db-form-actions"><button type="button" class="btn db-game-submit" id="db-game-submit" data-act="gameSubmit" data-noicon="1"${q.kind === 'MATCHING' && g.draft.pairs.some((x) => x == null) ? ' disabled' : ''}>${label || 'Chốt đáp án'}</button></div>`;
  if (dbGameIsTap(q)) {
    const opts = dbGameOpts(q), right = dbGameRight(q);
    return `<div class="db-game-opts">${opts.map((o, i) => {
      let cls = 'db-game-opt', mark = '';
      if (done) {
        if (i === right) { cls += ' right'; mark = '<span class="db-game-mark" aria-hidden="true">✓</span><span class="sr"> (đáp án đúng)</span>'; }
        else if (i === g.chosen) { cls += ' wrong'; mark = '<span class="db-game-mark" aria-hidden="true">✗</span><span class="sr"> (em đã chọn, chưa đúng)</span>'; }
      }
      return `<button type="button" class="${cls}" data-act="gameAnswer" data-i="${i}" ${done ? 'disabled' : ''}><b>${dbLetter(i)}.</b> <span class="db-game-opt-text">${h(o)}</span>${mark}</button>`;
    }).join('')}</div>`;
  }
  if (q.kind === 'MULTIPLE_CHOICE') {
    const key = new Set(q.correct_answer.map(Number)), sel = new Set(done ? (g.chosen || []) : g.draft.sel);
    return `<div class="db-game-opts">${dbGameOpts(q).map((o, i) => {
      let cls = 'db-game-opt multi' + (sel.has(i) ? ' on' : ''), mark = '';
      if (done) {
        if (key.has(i) && sel.has(i)) { cls += ' right'; mark = '<span class="db-game-mark" aria-hidden="true">✓</span><span class="sr"> (đúng)</span>'; }
        else if (key.has(i)) { cls += ' missed'; mark = '<span class="db-game-mark" aria-hidden="true">!</span><span class="sr"> (đáp án đúng em chưa chọn)</span>'; }
        else if (sel.has(i)) { cls += ' wrong'; mark = '<span class="db-game-mark" aria-hidden="true">✗</span><span class="sr"> (em chọn nhưng chưa đúng)</span>'; }
      }
      return `<button type="button" class="${cls}" data-act="gameToggle" data-i="${i}" data-noicon="1" aria-pressed="${sel.has(i)}" ${done ? 'disabled' : ''}><span class="db-game-check" aria-hidden="true">${sel.has(i) ? '☑' : '☐'}</span> <span class="db-game-opt-text">${h(o)}</span>${mark}</button>`;
    }).join('')}</div>${submit()}`;
  }
  if (q.kind === 'FILL_IN_BLANK') return submit();
  if (q.kind === 'MATCHING') return `<div class="db-game-match" id="db-game-match">${dbGameMatchMarkup(g, q)}</div>${submit()}`;
  return '';
}

/* Cảnh “giữ căn cứ” của chế độ Sinh tồn: kẻ địch từng đợt, 3 khiên của căn cứ, bản đồ các đợt. */
function dbGameSurvivalScene(g, q) {
  const total = g.pool.length, state = g.answered ? (g.ok ? 'defeated' : 'attack') : 'idle';
  const shields = [0, 1, 2].map((i) => `<span class="db-surv-shield${i < g.lives ? '' : ' broken'}${g.answered && !g.ok && i === g.lives ? ' hit' : ''}">🛡️</span>`).join('');
  const track = g.pool.map((_, i) => `<li class="${g.log[i] === 'ok' ? 'ok' : g.log[i] === 'bad' ? 'bad' : ''}${i === g.idx ? ' now' : ''}">${g.log[i] === 'ok' ? '✓' : g.log[i] === 'bad' ? '✗' : i + 1}</li>`).join('');
  return `<div class="db-surv-scene">
      <div class="db-surv-field" aria-hidden="true"><span class="db-surv-enemy ${state}">${DB_GAME_ENEMY[q.kind] || '🐛'}</span>${state === 'defeated' ? '<span class="db-surv-boom">✨</span>' : state === 'attack' ? '<span class="db-surv-boom">💥</span>' : ''}</div>
      <div class="db-surv-base" aria-hidden="true"><div class="db-surv-shields">${shields}</div><small>Căn cứ</small></div>
      <p class="sr">Đợt ${g.idx + 1} trên ${total}. Căn cứ còn ${Math.max(0, g.lives)} khiên.</p>
    </div>
    <ol class="db-surv-track" aria-hidden="true">${track}</ol>`;
}

function dbGameFeedback(g, q, last) {
  const blitz = g.mode === 'BLITZ', ok = g.ok;
  const partial = !ok && !g.timedOut && g.parts ? ` Đúng ${g.parts.filter(Boolean).length}/${g.parts.length} ý — cần đúng tất cả.` : '';
  const key = q.kind === 'MATCHING' ? '' : ` Đáp án đúng: <b>${h(dbGameKeyText(q))}</b>.`;
  const msg = ok ? `<b>Chính xác!</b>${g.lastNote ? ` <span class="db-game-bonus">${h(g.lastNote)}</span>` : ''}${g.mode === 'SURVIVAL' ? ' Đã đẩy lùi đợt tấn công!' : ''}`
    : `<b>${g.timedOut ? 'Hết giờ!' : 'Chưa đúng.'}</b>${partial}${key}${g.mode === 'SURVIVAL' ? ' Căn cứ mất một khiên.' : ''}`;
  return `<div class="notice db-game-feedback ${ok ? 'ok' : 'bad'}" role="status" aria-live="polite">${ok ? ic('check', 16) : ic('alert', 16)}<div>${msg}</div></div>
    ${q.explain && !blitz ? `<div class="db-game-explain"><b>Giải thích:</b> ${h(q.explain)}</div>` : ''}
    <div class="row db-form-actions">${dbBtn(last ? 'Kết thúc ván' : g.mode === 'SURVIVAL' ? 'Đợt tiếp theo' : 'Câu tiếp theo', 'gameNext', {}, '')}</div>`;
}

function dbGamePlay(d) {
  const g = DB_GAME, q = g.pool[g.idx], total = g.pool.length;
  const blitz = g.mode === 'BLITZ', surv = g.mode === 'SURVIVAL', t = dbGameTimeLeft(g);
  const secs = t ? Math.max(0, Math.ceil(t.ms / 1000)) : 0;
  const pct = t ? Math.max(0, Math.min(100, t.ms / t.total * 100)) : 0;
  const clock = t ? `<span class="db-game-clock" id="db-game-clock">${secs}s</span>` : '';
  const nextMult = blitz ? dbGameMult(g.streak + 1) : 1;
  const streak = g.streak >= 2 ? `<span class="db-game-streak" title="Chuỗi đúng liên tiếp">🔥 ${g.streak}${blitz && nextMult > 1 ? ' · câu sau x' + nextMult : ''}</span>` : '';
  const pop = g.answered && g.lastGain ? `<span class="db-game-pop" aria-hidden="true">+${g.lastGain}</span>` : '';
  const last = surv ? g.lives <= 0 || g.idx + 1 >= total : !blitz && g.idx + 1 >= total;
  const head = q.kind === 'FILL_IN_BLANK' ? dbGameFillMarkup(g, q) : h(q.content);
  const label = surv ? `Đợt ${g.idx + 1}/${total}` : blitz ? 'Câu ' + (g.idx + 1) : 'Câu ' + (g.idx + 1) + '/' + total;
  return `<section class="panel db-game-panel mode-${g.mode.toLowerCase()}" aria-labelledby="db-h-gp">
    <div class="row between db-game-bar">
      <div class="row">${ic(DB_GAME_MODES[g.mode].icon, 18)}<b>${DB_GAME_MODES[g.mode].name}</b><span class="muted">${label}</span></div>
      <div class="row"><span class="db-game-score">Điểm: <b id="db-game-score">${g.score}</b>${pop}</span>${streak}${clock}${dbGameSoundBtn()}${dbBtn('Dừng & lưu ván', 'gameFinish', {}, 'light mini')}</div>
    </div>
    ${t ? `<div class="db-game-timebar${secs <= 5 ? ' low' : ''}" aria-hidden="true"><span id="db-game-timebar" style="width:${pct.toFixed(1)}%"></span></div>` : ''}
    ${surv ? dbGameSurvivalScene(g, q) : ''}
    <span class="db-game-kind">${h(({ SINGLE_CHOICE: 'Một lựa chọn', MULTIPLE_CHOICE: 'Nhiều lựa chọn', TRUE_FALSE: 'Đúng / Sai', FILL_IN_BLANK: 'Điền khuyết', MATCHING: 'Ghép đôi' })[q.kind] || '')}</span>
    <h2 id="db-h-gp" class="db-qtext db-game-q">${head}</h2>
    ${g.answered ? '' : `<p class="muted db-game-hint">${DB_GAME_KIND_HINT[q.kind] || ''}${dbGameIsTap(q) ? '. Phím tắt: 1–4 hoặc A–D.' : ''}</p>`}
    ${dbGameAnswerArea(g, q)}
    ${g.answered ? dbGameFeedback(g, q, last) : ''}
    ${dbFormError()}
  </section>`;
}

/* Xử lý một câu trả lời (đáp án theo dạng câu — xem dbGameGrade). timedOut = hết giờ. */
function dbGameResolve(ans, timedOut) {
  const g = DB_GAME;
  if (!g || g.answered || g.finishing) return;
  const q = g.pool[g.idx], res = timedOut ? { ok: false, parts: null } : dbGameGrade(q, ans), ok = res.ok;
  g.answered = true; g.chosen = timedOut ? null : ans; g.asked++; g.timedOut = !!timedOut; g.ok = ok; g.parts = res.parts; g.lastGain = 0; g.lastNote = '';
  if (ok) {
    g.correct++; g.streak++; g.maxStreak = Math.max(g.maxStreak, g.streak);
    if (g.mode === 'RACE') g.lastGain = 10 + Math.max(0, Math.round((g.qEndsAt - Date.now()) / 1000));
    else if (g.mode === 'BLITZ') {
      g.lastGain = 10 * dbGameMult(g.streak);
      if (g.streak % 5 === 0) { g.endsAt += 3000; g.totalMs += 3000; g.lastNote = '+3 giây'; g.lastTickSec = null; }
    } else g.lastGain = dbGameIsTap(q) ? 10 : 15; /* câu nhiều ý khó hơn nên thưởng nhiều hơn */
    g.score += g.lastGain;
    DbSfx.play(g.streak >= 3 ? 'combo' : 'right');
  } else {
    g.streak = 0;
    if (g.mode === 'SURVIVAL') g.lives--;
    g.wrong.push({ q, chosen: g.chosen });
    DbSfx.play('wrong');
  }
  if (g.mode === 'SURVIVAL') g.log[g.idx] = ok ? 'ok' : 'bad';
  /* Nhanh: tự chuyển câu (đúng chuyển nhanh, sai dừng lâu hơn để kịp thấy đáp án). Đua: hết giờ thì tự chuyển sau khi hiện đáp án. */
  if (g.mode === 'BLITZ') dbGameSchedule(ok ? 650 : 1500);
  else if (g.mode === 'RACE' && g.timedOut) dbGameSchedule(2200);
  render();
}
DB_ACT.gameAnswer = (el) => { dbGameResolve(Number(el.dataset.i)); };
DB_ACT.gameNext = () => {
  const g = DB_GAME;
  if (!g || g.finishing || !g.answered) return;
  dbGameClearAdv();
  const total = g.pool.length;
  if ((g.mode === 'SURVIVAL' && g.lives <= 0) || (g.mode !== 'BLITZ' && g.idx + 1 >= total)) { DB_ACT.gameFinish(); return; }
  if (g.mode === 'BLITZ' && g.idx + 1 >= total) g.pool = g.pool.concat(dbGameShuffle(g.allQ)); /* hết câu thì xáo lại, không dừng sớm */
  g.idx++; g.answered = false; g.chosen = null; g.ok = false; g.parts = null; g.timedOut = false; g.lastGain = 0; g.lastNote = '';
  g.draft = dbGameNewDraft(g.pool[g.idx]);
  if (g.mode === 'RACE') { g.qEndsAt = Date.now() + DB_GAME_RACE_MS; g.lastTickSec = null; }
  render(); dbGameFocus();
};

/* Kết thúc ván: lưu lịch sử rồi hiện kết quả. */
DB_ACT.gameFinish = () => dbRun(document.body, async () => {
  const g = DB_GAME;
  if (!g || g.finishing) return false;
  g.finishing = true;
  dbGameStopTick(); dbGameClearAdv();
  try {
    const duration = Math.max(1, Math.round((Date.now() - g.startedAt) / 1000));
    const mine = ((DB.data && DB.data.sessions) || []).filter((s) => s.student_id === (DB.me || {}).id && s.mode === g.mode);
    const prevBest = Math.max(0, DB_GAME_BEST[g.mode] || 0, ...mine.map((s) => Number(s.score) || 0));
    const hadBefore = mine.length > 0 || DB_GAME_BEST[g.mode] !== undefined;
    if (g.asked > 0) {
      await dbCall(EducMindDB.createGameSession({
        course_id: DB.course.id, mode: g.mode, source: g.source,
        question_count: g.asked, correct_count: g.correct, score: g.score, duration_seconds: duration,
      }));
    }
    DB_GAME_BEST[g.mode] = Math.max(prevBest, g.score);
    const seen = new Set(), wrong = g.wrong.filter((w) => (seen.has(w.q.id) ? false : (seen.add(w.q.id), true)));
    DB_GAME_RESULT = {
      mode: g.mode, source: g.source, score: g.score, correct: g.correct, asked: g.asked, duration,
      maxStreak: g.maxStreak, wrong, prevBest, hadBefore, lives: g.lives,
      isBest: g.asked > 0 && g.score > 0 && g.score > prevBest, saved: g.asked > 0,
    };
    DB_GAME = null;
    DbSfx.play('finish');
    render();
    return false; /* tự vẽ lại trang kết quả */
  } catch (e) {
    g.finishing = false; /* cho phép bấm "Dừng & lưu ván" lại nếu lưu lỗi */
    throw e;
  }
});
function dbGameResult() {
  const r = DB_GAME_RESULT, pct = r.asked ? Math.round(r.correct / r.asked * 100) : 0;
  const msg = !r.asked ? '' : pct >= 90 ? 'Tuyệt vời! Em nắm kiến thức rất chắc.' : pct >= 70 ? 'Làm tốt lắm! Xem lại vài câu sai là vững hơn nữa.' : pct >= 40 ? 'Khá ổn! Mỗi lần chơi em lại tiến bộ thêm.' : 'Không sao, sai là cơ hội để học. Xem lại các câu bên dưới nhé!';
  const best = !r.asked ? '' : r.isBest
    ? (r.hadBefore ? `🏆 Kỷ lục mới! (kỷ lục cũ: ${dbNum(r.prevBest)})` : '🏆 Ván đầu tiên ở chế độ này — kỷ lục của em đã được ghi!')
    : (r.hadBefore ? `Kỷ lục của em ở chế độ này: ${dbNum(r.prevBest)}` : '');
  const confetti = r.isBest ? `<div class="db-game-confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="left:${Math.round(Math.random() * 100)}%;animation-delay:${(Math.random() * 0.6).toFixed(2)}s;background:${['#f4b942', '#3978f6', '#e45c56', '#21a16b', '#9b59d0'][i % 5]}"></i>`).join('')}</div>` : '';
  const review = r.wrong.length
    ? `<h3 class="db-game-review-title">Xem lại ${r.wrong.length} câu chưa đúng</h3><ol class="db-game-review">${r.wrong.map((w) => {
        const mine = dbGameAnswerText(w.q, w.chosen) || 'Hết giờ — chưa trả lời';
        return `<li><div class="db-qtext">${h(w.q.content)}</div>
          <p class="db-game-review-line bad"><span aria-hidden="true">✗</span> Em trả lời: ${h(mine)}</p>
          <p class="db-game-review-line good"><span aria-hidden="true">✓</span> Đáp án đúng: ${h(dbGameKeyText(w.q))}</p>
          ${w.q.explain ? `<p class="db-game-explain"><b>Giải thích:</b> ${h(w.q.explain)}</p>` : ''}</li>`;
      }).join('')}</ol>`
    : (r.asked ? '<p class="lead">Không sai câu nào. Giỏi quá! 🎉</p>' : '');
  return `<section class="panel db-game-result" aria-labelledby="db-h-gr">${confetti}
    <h2 id="db-h-gr">Kết quả ván ${h(DB_GAME_MODE_LABEL[r.mode] || r.mode)}</h2>
    ${best ? `<p class="db-game-best">${best}</p>` : ''}
    <div class="facts">
      <div><span>Điểm</span><b>${dbNum(r.score)}</b></div>
      <div><span>Trả lời đúng</span><b>${r.correct}/${r.asked}</b></div>
      <div><span>Chuỗi đúng dài nhất</span><b>${r.maxStreak}</b></div>
      <div><span>Thời gian</span><b>${dbNum(r.duration)} giây</b></div>
    </div>
    ${msg ? `<p class="lead">${msg}</p>` : ''}
    <p class="muted">${r.saved ? 'Ván chơi đã được lưu vào lịch sử.' : 'Chưa có câu nào được trả lời nên ván này không lưu.'}</p>
    ${review}
    <div class="row db-form-actions">${dbBtn('Chơi lại cùng nguồn', 'gameReplay', {}, '')}${dbBtn('Đổi chế độ', 'gameAgain', {}, 'light')}</div>
  </section>`;
}
DB_ACT.gameAgain = () => { DB_GAME_RESULT = null; render(); };

/* Đồng hồ (BLITZ tổng 60s / RACE từng câu 20s): chỉ sơn trực tiếp lên ô giờ và thanh thời gian, không vẽ lại trang. */
function dbGameStartTick() {
  dbGameStopTick();
  if (!DB_GAME || (DB_GAME.mode !== 'BLITZ' && DB_GAME.mode !== 'RACE')) return;
  DB_GAME_TICK = setInterval(() => {
    const g = DB_GAME;
    if (!g || g.finishing) return dbGameStopTick();
    if (g.mode === 'RACE' && g.answered) return; /* đã trả lời thì đồng hồ câu này dừng (tránh đếm trùng) */
    const t = dbGameTimeLeft(g), secs = Math.max(0, Math.ceil(t.ms / 1000));
    const el = document.getElementById('db-game-clock');
    if (el && el.textContent !== secs + 's') el.textContent = secs + 's';
    const bar = document.getElementById('db-game-timebar');
    if (bar) {
      bar.style.width = Math.max(0, Math.min(100, t.ms / t.total * 100)) + '%';
      if (bar.parentElement) bar.parentElement.classList.toggle('low', secs <= 5);
    }
    if (secs > 0 && secs <= 5 && g.lastTickSec !== secs) { g.lastTickSec = secs; DbSfx.play('tick'); }
    if (t.ms <= 0) {
      if (g.mode === 'BLITZ') { dbGameStopTick(); DB_ACT.gameFinish(); }
      else dbGameResolve(null, true); /* hết giờ một câu: tính sai, giữ lại để hiện đáp án rồi tự chuyển câu */
    }
  }, 100);
}
function dbGameStopTick() { if (DB_GAME_TICK) { clearInterval(DB_GAME_TICK); DB_GAME_TICK = null; } }

/* Phím tắt khi đang chơi: 1–9 hoặc A–D chọn đáp án (nhiều lựa chọn: bật/tắt), Enter chốt đáp án hoặc sang câu tiếp. */
document.addEventListener('keydown', (ev) => {
  if (!DB_GAME || ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  if (typeof dbActive === 'function' && !dbActive()) return;
  if (DB.page !== 'games' || DB.dialog) return;
  const t = ev.target, g = DB_GAME, key = String(ev.key).toLowerCase();
  /* Ô điền khuyết: Enter sang ô kế tiếp, ô cuối thì chốt đáp án. */
  if (t && t.classList && t.classList.contains('db-game-gap')) {
    if (key !== 'enter') return;
    ev.preventDefault();
    const gaps = [...document.querySelectorAll('.db-game-gap')], i = gaps.indexOf(t);
    if (i >= 0 && i < gaps.length - 1) gaps[i + 1].focus(); else DB_ACT.gameSubmit();
    return;
  }
  if (ev.repeat) return;
  if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
  const q = g.pool[g.idx];
  if (!g.answered) {
    const idx = /^[1-9]$/.test(key) ? Number(key) - 1 : /^[a-d]$/.test(key) ? key.charCodeAt(0) - 97 : -1;
    if (idx >= 0 && idx < dbGameOpts(q).length) {
      if (dbGameIsTap(q)) { ev.preventDefault(); dbGameResolve(idx); }
      else if (q.kind === 'MULTIPLE_CHOICE') { ev.preventDefault(); dbGameToggleOpt(idx); }
    } else if (key === 'enter' && q.kind === 'MULTIPLE_CHOICE' && !(t && t.closest && t.closest('button,a'))) { ev.preventDefault(); DB_ACT.gameSubmit(); }
  } else if (key === 'enter' && !(t && t.closest && t.closest('button,a'))) {
    ev.preventDefault();
    DB_ACT.gameNext();
  }
});

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