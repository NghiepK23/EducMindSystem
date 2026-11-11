/* EducMind · js/db/08-exam.js
   Học sinh làm bài kiểm tra: bắt đầu / làm tiếp một lượt, lưu câu trả lời ngay khi chọn, đồng hồ đếm ngược, nộp bài.
   Lưu ý: Máy chủ là nơi quyết định: số lượt, thời điểm hết giờ (ends_at) và việc chấm điểm. Hết giờ, câu trả lời gửi muộn bị máy chủ từ chối;
   lệnh nộp bài vẫn dùng được và chỉ tính các câu đã lưu đúng hạn. */

/* Lượt đang làm: { assessment, attempt, endsAt (ms, giờ máy chủ), questions, answers {mã câu: câu trả lời}, state {mã câu: saved|dirty|saving|error},
   debounce {mã câu: bộ hẹn giờ}, inFlight {mã câu: Promise}, tick, finishing } */
let DBX = null;
const DB_EXAM_SAVE_DELAY = 900;   // ms chờ sau lần gõ cuối rồi mới lưu câu trả lời dạng chữ

DB_ACT.startExam = (el) => {
  const e = DB.data.assessments.find((x) => x.id === el.dataset.id);
  if (!e) return;
  const begin = async () => {
    const r = await dbCall(EducMindDB.startAttempt(e.id));
    if (r.status === 'CLOSED') throw new Error('Bài kiểm tra hiện không mở.');
    if (r.status === 'NO_ATTEMPTS_LEFT') throw new Error('Em đã dùng hết số lượt làm bài.');
    DBX = { assessment: e, attempt: r.attempt, endsAt: new Date(r.ends_at).getTime(), questions: [], answers: {}, state: {}, debounce: {}, inFlight: {}, tick: null, finishing: false };
    await dbGo('exam', { id: e.id });
    return false;
  };
  if (el.dataset.resume) return dbRun(el, begin);
  dbConfirm('Bắt đầu làm bài?', `Bài “${h(e.title)}” có thời lượng <b>${h(e.duration_minutes)} phút</b>. Đồng hồ chạy liên tục từ lúc bắt đầu, kể cả khi em rời trang hoặc mất mạng. Lượt này được tính vào ${h(e.max_attempts)} lượt làm của em.`, 'Bắt đầu', begin);
};

DB_PAGES.exam = {
  hideClass: true,   // không đổi lớp giữa lúc làm bài
  title: () => (DBX ? DBX.assessment.title : 'Bài kiểm tra'),
  sub: () => (DBX ? 'Lượt ' + h(DBX.attempt.attempt_number) + ' · câu trả lời được lưu tự động' : ''),
  async load() {
    if (!DBX || DBX.assessment.id !== DB.arg.id) return { missing: true };
    const [questions, answers] = await Promise.all([dbCall(EducMindDB.getAssessmentQuestions(DBX.assessment.id)), dbCallIn(EducMindDB.listAnswers, [DBX.attempt.id])]);
    DBX.questions = questions;
    for (const a of answers) { DBX.answers[a.question_id] = a.answer_content; DBX.state[a.question_id] = 'saved'; }
    dbExamStartTimer();
    return { ready: true };
  },
  view(d) {
    if (d.missing || !DBX) return `<section class="panel">${dbEmpty('Không có lượt làm nào đang mở ở đây.')}${dbBtn('Về danh sách bài kiểm tra', 'go', { page: 'assessments' }, 'light')}</section>`;
    const X = DBX, total = X.questions.reduce((s, q) => s + Number(q.weight), 0);
    return `<section class="panel db-exam-bar" aria-label="Thời gian và tiến độ">
      <div class="row between">
        <div><b>${X.questions.length} câu · ${dbNum(total)} điểm</b><div class="muted" id="db-exam-progress">${dbExamProgressText()}</div></div>
        <div class="db-timer" id="db-exam-timer" role="timer" aria-label="Thời gian còn lại">${dbExamClock()}</div>
        ${dbBtn('Nộp bài', 'examSubmit')}
      </div>
    </section>
    ${X.questions.map((q, i) => dbExamQuestion(q, i)).join('')}
    <div class="row db-form-actions">${dbBtn('Nộp bài', 'examSubmit')}</div>`;
  },
  /* Rời trang làm bài: lưu nốt câu đang gõ dở và dừng đồng hồ trên màn hình (đồng hồ ở máy chủ vẫn chạy). */
  leave() { dbExamStop(true); },
};
const dbExamBlank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const dbExamProgressText = () => `Đã trả lời ${DBX.questions.filter((q) => !dbExamBlank(DBX.answers[q.question_id])).length}/${DBX.questions.length} câu`;
function dbExamClock() {
  const left = Math.max(0, Math.ceil((DBX.endsAt - dbNow()) / 1000)), hh = Math.floor(left / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;
  return (hh ? hh + ':' : '') + dbPad(mm) + ':' + dbPad(ss);
}
const DB_EXAM_STATE = { saved: 'Đã lưu', dirty: 'Đang chờ lưu…', saving: 'Đang lưu…', error: 'Chưa lưu được' };
function dbExamQuestion(q, i) {
  const id = q.question_id, a = DBX.answers[id], opts = Array.isArray(q.options) ? q.options : [], st = DBX.state[id];
  let input;
  if (q.kind === 'SINGLE_CHOICE') input = opts.map((o, k) => `<label class="objrow"><input type="radio" name="q-${h(id)}" value="${k}" data-change="examAnswer" data-q="${h(id)}" ${Number(a) === k && a != null && a !== '' ? 'checked' : ''}><span>${dbLetter(k)}. ${h(o)}</span></label>`).join('');
  else if (q.kind === 'MULTIPLE_CHOICE') { const set = new Set([].concat(a == null ? [] : a).map(Number)); input = `<div class="muted db-hint">Chọn mọi đáp án đúng.</div>` + opts.map((o, k) => `<label class="objrow"><input type="checkbox" name="q-${h(id)}" value="${k}" data-change="examAnswer" data-q="${h(id)}" ${set.has(k) ? 'checked' : ''}><span>${dbLetter(k)}. ${h(o)}</span></label>`).join(''); }
  else if (q.kind === 'TRUE_FALSE') input = [['true', 'Đúng'], ['false', 'Sai']].map(([val, label]) => `<label class="objrow"><input type="radio" name="q-${h(id)}" value="${val}" data-change="examAnswer" data-q="${h(id)}" ${a != null && String(a) === val ? 'checked' : ''}><span>${label}</span></label>`).join('');
  else if (q.kind === 'SHORT_ANSWER') input = `<label class="sr" for="db-xa-${h(id)}">Câu trả lời câu ${i + 1}</label><input id="db-xa-${h(id)}" type="text" maxlength="1000" value="${h(a == null ? '' : a)}" data-input="examText" data-change="examTextNow" data-q="${h(id)}" placeholder="Câu trả lời của em" autocomplete="off">`;
  else input = `<label class="sr" for="db-xa-${h(id)}">Bài làm câu ${i + 1}</label><textarea id="db-xa-${h(id)}" rows="7" maxlength="20000" data-input="examText" data-change="examTextNow" data-q="${h(id)}" placeholder="Bài làm của em">${h(a == null ? '' : a)}</textarea>`;
  return `<section class="panel db-question" aria-labelledby="db-xq-${i}">
    <div class="row between"><h2 id="db-xq-${i}">Câu ${i + 1}</h2><div class="row"><span class="muted">${h(DB_QKIND[q.kind] || q.kind)} · ${dbNum(q.weight)} điểm</span><span class="db-save-state" id="db-xs-${h(id)}" data-state="${h(st || '')}" role="status">${st ? DB_EXAM_STATE[st] : ''}</span></div></div>
    <div class="db-prose">${h(q.content)}</div>
    <div class="db-answers" role="group" aria-labelledby="db-xq-${i}">${input}</div>
  </section>`;
}
/* Cập nhật nhãn trạng thái lưu và dòng tiến độ ngay trên trang (không vẽ lại, không làm mất con trỏ đang gõ). */
function dbExamPaint(id) {
  const el = document.getElementById('db-xs-' + id);
  if (el) { el.dataset.state = DBX.state[id] || ''; el.textContent = DBX.state[id] ? DB_EXAM_STATE[DBX.state[id]] : ''; }
  const p = document.getElementById('db-exam-progress');
  if (p) p.textContent = dbExamProgressText();
}
DB_ACT.examAnswer = (el) => {
  if (!DBX) return;
  const id = el.dataset.q, q = DBX.questions.find((x) => x.question_id === id);
  if (q.kind === 'MULTIPLE_CHOICE') DBX.answers[id] = [...document.querySelectorAll(`#main input[data-q="${id}"]:checked`)].map((x) => Number(x.value)).sort((a, b) => a - b);
  else if (q.kind === 'TRUE_FALSE') DBX.answers[id] = el.value === 'true';
  else DBX.answers[id] = Number(el.value);
  dbExamSave(id);
};
DB_ACT.examText = (el) => {
  if (!DBX) return;
  const id = el.dataset.q;
  DBX.answers[id] = el.value; DBX.state[id] = 'dirty'; dbExamPaint(id);
  clearTimeout(DBX.debounce[id]);
  DBX.debounce[id] = setTimeout(() => dbExamSave(id), DB_EXAM_SAVE_DELAY);
};
/* Rời khỏi ô nhập: lưu ngay, không chờ. */
DB_ACT.examTextNow = (el) => { if (DBX && DBX.state[el.dataset.q] === 'dirty') dbExamSave(el.dataset.q); };
/* Lưu một câu trả lời. Mỗi câu chỉ có một lần gửi chạy tại một thời điểm; nếu câu trả lời đổi trong lúc đang gửi
   thì chính lần gửi đó gửi tiếp giá trị mới nhất khi xong. */
function dbExamSave(id) {
  const X = DBX;
  if (!X) return Promise.resolve();
  clearTimeout(X.debounce[id]); delete X.debounce[id];
  if (X.inFlight[id]) return X.inFlight[id];
  const norm = (v) => JSON.stringify(v == null ? '' : v);
  X.inFlight[id] = (async () => {
    for (;;) {
      const value = X.answers[id], sent = norm(value);
      X.state[id] = 'saving';
      if (DBX === X) dbExamPaint(id);
      const { error } = await EducMindDB.saveAnswer(X.attempt.id, id, value == null ? '' : value);
      if (error) {
        X.state[id] = 'error';
        delete X.inFlight[id];
        console.warn('Lưu câu trả lời:', error.message);
        if (DBX === X) {
          dbExamPaint(id);
          /* Máy chủ báo đã hết giờ hoặc lượt đã nộp: kết thúc lượt làm trên màn hình. */
          if (/time window has ended|attempt is locked/i.test(error.message || '')) dbExamFinish('Đã hết thời gian làm bài.');
          else toast('Chưa lưu được câu trả lời: ' + dbErrText(error));
        }
        return;
      }
      if (norm(X.answers[id]) === sent) { X.state[id] = 'saved'; break; }
      if (X.debounce[id]) { X.state[id] = 'dirty'; break; }   // người dùng còn đang gõ: bộ hẹn giờ sẽ gọi lưu tiếp
    }
    delete X.inFlight[id];
    if (DBX === X) dbExamPaint(id);
  })();
  return X.inFlight[id];
}
/* Gửi mọi câu trả lời đang chờ lưu (hoặc lần trước lưu lỗi) và chờ xong. Trả về danh sách mã câu vẫn chưa lưu được. */
async function dbExamFlush(X) {
  if (DBX === X) for (const id of Object.keys(X.state)) if (X.state[id] === 'dirty' || X.state[id] === 'error') dbExamSave(id);
  await Promise.all(Object.values(X.inFlight));
  return Object.keys(X.state).filter((id) => X.state[id] !== 'saved');
}
function dbExamStartTimer() {
  const X = DBX;
  clearInterval(X.tick);
  X.tick = setInterval(() => {
    if (DBX !== X) return clearInterval(X.tick);
    if (sess) sess.t = Date.now();   // đang làm bài được coi là đang hoạt động (không bị đăng xuất vì ngồi nghĩ lâu)
    const el = document.getElementById('db-exam-timer'), left = X.endsAt - dbNow();
    if (el) { el.textContent = dbExamClock(); el.classList.toggle('warn', left <= 60000); }
    if (left <= 0 && !X.finishing) dbExamFinish('Hết giờ làm bài.');
  }, 1000);
}
/* Dừng lượt làm trên màn hình. flush = true: gửi nốt các câu đang chờ lưu (không chờ kết quả). */
function dbExamStop(flush) {
  const X = DBX;
  if (!X) return;
  clearInterval(X.tick);
  Object.values(X.debounce).forEach(clearTimeout);
  if (flush) for (const id of Object.keys(X.state)) if (X.state[id] === 'dirty') dbExamSave(id);
  DBX = null;
}
/* Nộp bài: gọi RPC (dùng được cả khi đã hết giờ) rồi mở trang kết quả của lượt vừa nộp. */
async function dbExamFinish(reason) {
  const X = DBX;
  if (!X || X.finishing) return;
  X.finishing = true;
  clearInterval(X.tick);
  await dbExamFlush(X).catch(() => []);
  let done = null;
  try { done = await dbCall(EducMindDB.submitAttempt(X.attempt.id)); }
  catch (e) { console.error(e); X.finishing = false; dbExamStartTimer(); toast('Chưa nộp được bài: ' + dbErrText(e)); return; }
  if (DBX === X) DBX = null;
  DB.dialog = null;
  toast((reason ? reason + ' ' : '') + (done && done.status === 'GRADED' ? 'Bài đã được nộp và chấm xong.' : 'Bài đã được nộp.'));
  await dbGo('assessments', { id: X.assessment.id, attempt: X.attempt.id });
}
DB_ACT.examSubmit = () => {
  if (!DBX) return;
  const blank = DBX.questions.filter((q) => dbExamBlank(DBX.answers[q.question_id])).length;
  dbConfirm('Nộp bài?', (blank ? `Em còn <b>${blank}</b> câu chưa trả lời. ` : 'Em đã trả lời mọi câu. ') + 'Sau khi nộp, em không sửa được lượt làm này.', 'Nộp bài', async () => {
    const X = DBX;
    if (!X || X.finishing) return false;
    const pending = await dbExamFlush(X);
    if (pending.length && X.endsAt - dbNow() > 0) throw new Error('Còn ' + pending.length + ' câu trả lời chưa lưu được. Hãy kiểm tra mạng rồi bấm Nộp bài lần nữa.');
    X.finishing = true;
    clearInterval(X.tick);
    try { await dbCall(EducMindDB.submitAttempt(X.attempt.id)); } catch (e) { X.finishing = false; dbExamStartTimer(); throw e; }
    if (DBX === X) DBX = null;
    toast('Đã nộp bài.');
    await dbGo('assessments', { id: X.assessment.id, attempt: X.attempt.id });
    return false;
  });
};
/* Đóng thẻ khi còn câu trả lời chưa lưu: trình duyệt hỏi lại trước khi rời trang. */
window.addEventListener('beforeunload', (ev) => {
  if (DBX && Object.values(DBX.state).some((s) => s === 'dirty' || s === 'saving')) { ev.preventDefault(); ev.returnValue = ''; }
});
