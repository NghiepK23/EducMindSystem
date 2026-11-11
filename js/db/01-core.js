/* EducMind · js/db/01-core.js
   Chế độ dữ liệu thật (đăng nhập bằng Supabase): trạng thái chung, hàm tiện ích, bộ điều phối thao tác và hàm vẽ màn hình.
   Lưu ý: Các tệp trong js/db/ chỉ chạy khi người dùng đăng nhập bằng Supabase (sess.backend). Dữ liệu luôn đọc / ghi qua EducMindDB
   (js/03-supabase.js); không dùng dữ liệu mẫu trong bộ nhớ của chế độ demo. */

/* ===== Trạng thái ===== */
const DB = {
  me: null,        // hồ sơ người đang đăng nhập: { id, email, full_name, role }
  classes: [],     // các lớp người này nhìn thấy
  classId: '',     // lớp đang chọn
  course: null,    // khóa học của lớp đang chọn (mỗi lớp dùng một khóa học chứa toàn bộ nội dung)
  page: 'home',    // trang đang mở (khóa trong DB_PAGES)
  arg: {},         // tham số của trang, ví dụ { id: mã bài tập đang xem }
  data: null,      // dữ liệu đã nạp cho trang hiện tại (null = chưa nạp xong lần nào)
  loading: false,
  loadError: '',
  dialog: null,    // hộp thoại đang mở
  notifs: [],      // thông báo gần nhất
  seq: 0,          // số thứ tự lần nạp; kết quả của lần nạp cũ bị bỏ qua
  clockSkew: 0,    // giờ máy chủ trừ giờ máy người dùng (mili giây)
  resetForms: false,
  timers: [],      // các bộ hẹn giờ cần dừng khi đăng xuất
};
/* Mỗi tệp trang đăng ký trang của mình vào DB_PAGES và các thao tác vào DB_ACT. */
const DB_PAGES = {};   // khóa trang -> { title, sub, load(): Promise<data>, view(data): html, noClass }
const DB_ACT = {};     // tên thao tác -> hàm (phần tử, sự kiện)

const dbActive = () => !!(logged && sess && sess.backend && DB.me);
const dbIsTeacher = () => !!DB.me && DB.me.role === 'TEACHER';
const dbClass = () => DB.classes.find((c) => c.id === DB.classId) || null;

/* ===== Hàm tiện ích ===== */
/* Thoát ký tự HTML cho MỌI dữ liệu đưa vào giao diện (cả trong thuộc tính dùng nháy đơn lẫn nháy kép). */
const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dbNum = (v) => { const n = Number(v); return Number.isFinite(n) ? String(Math.round(n * 100) / 100).replace('.', ',') : ''; };
const dbPad = (n) => String(n).padStart(2, '0');
/* Ngày giờ theo giờ của máy người dùng: 14/11/2026 08:30 */
function dbDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : `${dbPad(d.getDate())}/${dbPad(d.getMonth() + 1)}/${d.getFullYear()} ${dbPad(d.getHours())}:${dbPad(d.getMinutes())}`;
}
/* Giá trị cho ô <input type="datetime-local"> và ngược lại. */
function dbToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getFullYear()}-${dbPad(d.getMonth() + 1)}-${dbPad(d.getDate())}T${dbPad(d.getHours())}:${dbPad(d.getMinutes())}`;
}
function dbFromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}
/* Giờ máy chủ: đồng hồ của máy người dùng có thể sai, nên mọi so sánh hạn nộp / giờ làm bài dùng dbNow() (đã bù độ lệch đo lúc đăng nhập). */
const dbNow = () => Date.now() + (DB.clockSkew || 0);
async function dbSyncClock() {
  try {
    const t0 = Date.now();
    const server = await dbCall(EducMindDB.serverNow());
    const t1 = Date.now();
    const skew = new Date(server).getTime() - (t0 + t1) / 2;
    if (Number.isFinite(skew)) DB.clockSkew = Math.abs(skew) < 1500 ? 0 : Math.round(skew);
  } catch (e) { console.warn('Không đọc được giờ máy chủ, dùng giờ của máy:', e.message || e); }
}
const dbById = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));
const dbGroup = (list, key) => (list || []).reduce((m, x) => { (m[x[key]] = m[x[key]] || []).push(x); return m; }, {});
const dbInitials = (name) => String(name || '?').trim().split(/\s+/).slice(-2).map((w) => w[0] || '').join('').toUpperCase() || '?';
const dbName = (p) => (p && (p.full_name || p.email)) || 'Không rõ';

/* ----- Lỗi từ máy chủ -> thông báo tiếng Việt ----- */
const DB_ERRORS = [
  [/Invalid or expired class code/i, 'Mã lớp không đúng hoặc đã hết hạn.'],
  [/Only teachers can create a class/i, 'Chỉ tài khoản giáo viên mới tạo được lớp.'],
  [/Only students can join a class/i, 'Chỉ tài khoản học sinh mới vào lớp bằng mã.'],
  [/Only students can take an assessment/i, 'Chỉ học sinh mới làm bài kiểm tra.'],
  [/Assessment (closed|unavailable)/i, 'Bài kiểm tra hiện không mở.'],
  [/Assessment time window has ended/i, 'Đã hết thời gian làm bài, câu trả lời này không được ghi nhận.'],
  [/Submitted attempt is locked/i, 'Lượt làm đã nộp, không sửa được nữa.'],
  [/Assessment questions are locked after the first attempt/i, 'Đã có học sinh làm bài nên không đổi được danh sách câu hỏi và trọng số (chỉ đổi được thứ tự).'],
  [/Maximum attempts reached/i, 'Đã hết số lượt làm bài.'],
  [/Late submission is not allowed/i, 'Bài tập này không nhận bài nộp muộn.'],
  [/Submission status is not valid for current time/i, 'Trạng thái bài nộp không khớp với thời điểm hiện tại. Hãy tải lại trang rồi nộp lại.'],
  [/Score exceeds assignment maximum/i, 'Điểm vượt quá điểm tối đa của bài tập.'],
  [/Score must be between 0 and the question weight/i, 'Điểm phải nằm trong khoảng từ 0 đến trọng số của câu.'],
  [/Score cannot be negative/i, 'Điểm không được âm.'],
  [/Max score is lower than an existing score/i, 'Điểm tối đa mới thấp hơn điểm đã chấm của một bài nộp.'],
  [/Learning objective must belong to the same course/i, 'Mục tiêu phải thuộc cùng lớp với nội dung này.'],
  [/Only an open knowledge gap can be dismissed/i, 'Chỉ bỏ qua được lỗ hổng đang mở.'],
  [/Students cannot (change|submit) (grades|grading)/i, 'Học sinh không được thay đổi điểm.'],
  [/(Attempt|Assignment|Assessment|Class|Knowledge gap) not found/i, 'Không tìm thấy dữ liệu hoặc bạn không có quyền.'],
  [/Cannot coerce the result to a single JSON object/i, 'Không tìm thấy dữ liệu hoặc bạn không có quyền thực hiện thao tác này.'],
  [/row-level security|permission denied/i, 'Bạn không có quyền thực hiện thao tác này.'],
  [/violates foreign key constraint/i, 'Không xóa được vì dữ liệu này đang được dùng ở nơi khác (ví dụ đã có kết quả học tập).'],
  [/duplicate key value/i, 'Dữ liệu này đã tồn tại.'],
  [/assignments_check|late_close_at/i, 'Hạn nộp muộn phải sau hạn nộp.'],
  [/assessments_check|close_at/i, 'Thời điểm đóng phải sau thời điểm mở.'],
  [/violates check constraint/i, 'Dữ liệu chưa hợp lệ. Hãy kiểm tra lại các ô đã nhập.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.'],
  [/JWT expired|invalid JWT/i, 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'],
];
function dbErrText(e) {
  const raw = String((e && (e.message || e.error_description)) || e || 'Lỗi không rõ');
  const hit = DB_ERRORS.find(([re]) => re.test(raw));
  return hit ? hit[1] : raw;
}
/* Chờ một lệnh của EducMindDB; có lỗi thì ném ra để thao tác dừng lại và hiện thông báo. */
async function dbCall(promise) {
  const { data, error } = await promise;
  if (error) { const err = new Error(dbErrText(error)); err.raw = error; throw err; }
  return data;
}
/* Truy vấn theo danh sách mã (in.(...)): chia nhỏ để địa chỉ yêu cầu không quá dài; danh sách rỗng thì không gọi máy chủ. */
async function dbCallIn(fn, ids, size = 60) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  let out = [];
  for (let i = 0; i < uniq.length; i += size) out = out.concat(await dbCall(fn(uniq.slice(i, i + size))));
  return out;
}

/* ===== Thành phần giao diện nhỏ ===== */
const dbEmpty = (text) => `<div class="empty db-empty">${text}</div>`;
const dbPill = (text, tone) => `<span class="pill ${tone || 'plain'}">${text}</span>`;
const dbStatusPill = (status) => (status === 'PUBLISHED' ? dbPill(ic('check', 14) + 'Đã xuất bản', 'good') : dbPill('Bản nháp', 'plain'));
/* Nút thao tác: act là tên trong DB_ACT, data là các thuộc tính data-* kèm theo. */
function dbBtn(label, act, data, cls) {
  const d = Object.entries(data || {}).map(([k, v]) => ` data-${k}="${h(v)}"`).join('');
  return `<button type="button" class="btn ${cls || ''}" data-act="${act}"${d}>${label}</button>`;
}
function dbField(label, id, control, hint) {
  return `<div class="field"><label for="${id}">${label}</label>${control}${hint ? `<div class="muted db-hint">${hint}</div>` : ''}</div>`;
}
const dbFormError = () => `<div class="notice db-form-error" role="alert" hidden></div>`;
function dbTable(heads, rows, caption) {
  return `<div class="tablewrap"><table>${caption ? `<caption class="sr">${caption}</caption>` : ''}<thead><tr>${heads.map((x) => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
/* Mức nắm vững theo ba bậc của hệ thống: dưới 40% Cần ôn, 40–69% Đang tiến bộ, từ 70% Vững. */
function dbMasteryPill(score) {
  if (score == null) return dbPill('Chưa có dữ liệu', 'plain');
  const v = Number(score);
  return tierPill(v) + ` <span class="muted">${pct(v)}%</span>`;
}

/* ===== Điều hướng và nạp dữ liệu ===== */
async function dbLoad() {
  const my = ++DB.seq, P = DB_PAGES[DB.page];
  DB.loading = true; DB.loadError = '';
  try {
    const d = P && P.load ? await P.load() : {};
    if (my !== DB.seq) return false;
    DB.data = d || {};
  } catch (e) {
    if (my !== DB.seq) return false;
    console.error('Nạp trang', DB.page, e);
    DB.loadError = dbErrText(e);
  }
  DB.loading = false;
  return true;
}
/* Mở một trang: vẽ ngay khung "đang tải", nạp dữ liệu, rồi vẽ lại. */
async function dbGo(page, arg) {
  if (!DB_PAGES[page]) page = 'home';
  const cur = DB_PAGES[DB.page];
  if (cur && cur.leave && page !== DB.page) cur.leave();
  DB.page = page; DB.arg = arg || {}; DB.data = null; DB.dialog = null; DB.resetForms = true;
  focusId = 'pageTitle';
  render();
  window.scrollTo(0, 0);
  if (await dbLoad()) render();
}
/* Nạp lại dữ liệu của trang đang mở (sau khi ghi thành công). */
async function dbReload() {
  if (await dbLoad()) render();
}
/* Đổi lớp đang chọn: nạp khóa học của lớp rồi nạp lại trang. */
async function dbLoadCourse() {
  DB.course = null;
  if (!DB.classId) return;
  const list = await dbCall(EducMindDB.listCourses(DB.classId));
  DB.course = list[0] || null;
}
async function dbSetClass(id, page, arg) {
  DB.classId = id || '';
  try { localStorage.setItem('educmind.db.class', DB.classId); } catch (_) {}
  DB.course = null;
  try { await dbLoadCourse(); } catch (e) { console.error(e); }
  await dbGo(page || DB.page, arg || {});
}
async function dbLoadClasses() {
  DB.classes = await dbCall(EducMindDB.listClasses());
  if (!DB.classes.some((c) => c.id === DB.classId)) {
    let saved = '';
    try { saved = localStorage.getItem('educmind.db.class') || ''; } catch (_) {}
    DB.classId = (DB.classes.find((c) => c.id === saved) || DB.classes[0] || { id: '' }).id;
  }
}
/* Giáo viên: bảo đảm lớp đang chọn có khóa học trước khi tạo nội dung đầu tiên. */
async function dbEnsureCourse() {
  if (DB.course) return DB.course;
  const c = dbClass();
  if (!c) throw new Error('Hãy tạo hoặc chọn một lớp trước.');
  await dbLoadCourse();
  if (!DB.course) DB.course = await dbCall(EducMindDB.createCourse({ class_id: c.id, title: c.name }));
  return DB.course;
}

/* ===== Thao tác ===== */
function dbFormValues(form) {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) {
    if (el.disabled) continue;
    if (el.type === 'checkbox') { if (el.dataset.multi != null) { (out[el.name] = out[el.name] || []); if (el.checked) out[el.name].push(el.value); } else out[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = ''; }
    else out[el.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
  }
  return out;
}
/* Lỗi do người dùng nhập thiếu / sai (Error thường) chỉ hiện trên màn hình; lỗi từ máy chủ ghi mức cảnh báo; lỗi lập trình ghi mức lỗi. */
function dbLogError(e) {
  if (!e || e.name !== 'Error') console.error(e);
  else if (e.raw) console.warn('Supabase:', e.raw.code || '', e.raw.message || '');
}
function dbShowError(e, el) {
  const text = dbErrText(e);
  const scope = el && (el.closest('form') || el.closest('.panel') || el.closest('.dlg'));
  const box = scope && scope.querySelector('.db-form-error');
  if (box) { box.hidden = false; box.innerHTML = ic('alert', 16) + `<div>${h(text)}</div>`; box.scrollIntoView({ block: 'nearest' }); }
  toast(text);
}
/* Chạy một thao tác ghi: khóa nút trong lúc chờ, báo lỗi ngay tại chỗ (giữ nguyên nội dung đã nhập), thành công thì nạp lại trang.
   work trả về false để tự xử lý việc vẽ lại (không nạp lại trang). */
async function dbRun(el, work, okMsg) {
  const scope = (el && (el.tagName === 'FORM' ? el : el.closest('form'))) || el;
  const controls = scope ? [...(scope.matches('button, input, select, textarea') ? [scope] : scope.querySelectorAll('button, input, select, textarea'))].filter((x) => !x.disabled) : [];
  if (scope && scope.dataset.busy === '1') return;
  if (scope) scope.dataset.busy = '1';
  /* Đọc giá trị biểu mẫu TRƯỚC khi khóa các ô (ô bị khóa không được tính là dữ liệu của biểu mẫu). */
  const values = scope && scope.tagName === 'FORM' ? dbFormValues(scope) : {};
  controls.forEach((x) => { x.disabled = true; });
  const box = scope && scope.querySelector && scope.querySelector('.db-form-error');
  if (box) box.hidden = true;
  try {
    const r = await work(values);
    if (okMsg) toast(okMsg);
    if (r !== false) { DB.resetForms = true; await dbReload(); }
  } catch (e) {
    dbLogError(e);
    controls.forEach((x) => { x.disabled = false; });
    if (scope) delete scope.dataset.busy;
    dbShowError(e, el);
    return;
  }
  if (scope && scope.isConnected) { controls.forEach((x) => { x.disabled = false; }); delete scope.dataset.busy; }
}
/* Hộp thoại: { title, body (html), okLabel, danger, wide, onOk(values) }. onOk ném lỗi thì hộp thoại ở lại và hiện lỗi. */
function dbOpenDialog(d) { DB.dialog = d; render(); const f = document.querySelector('.db-dialog [autofocus], .db-dialog input, .db-dialog textarea, .db-dialog select, .db-dialog #db-dlg-ok'); if (f) f.focus(); }
function dbCloseDialog() { DB.dialog = null; render(); }
function dbConfirm(title, text, okLabel, onOk, danger) { dbOpenDialog({ title, body: `<p class="muted">${text}</p>`, okLabel, danger, onOk }); }
function dbDialogHtml() {
  const d = DB.dialog;
  if (!d) return '';
  return `<div class="ov db-dialog"><form class="dlg${d.wide ? ' db-dlg-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="db-dlg-t" data-act="dialogOk" novalidate>
    <h2 id="db-dlg-t" class="db-dlg-title">${d.title}</h2>${d.body || ''}${dbFormError()}
    <div class="row db-dlg-actions"><button type="button" class="btn light" data-act="dialogClose">${d.onOk ? 'Hủy' : 'Đóng'}</button>${d.onOk ? `<button type="submit" id="db-dlg-ok" class="btn ${d.danger ? 'danger' : ''}">${d.okLabel || 'Lưu'}</button>` : ''}</div>
  </form></div>`;
}
DB_ACT.dialogClose = () => dbCloseDialog();
DB_ACT.dialogOk = (form) => {
  const d = DB.dialog;
  if (!d || !d.onOk) return dbCloseDialog();
  return dbRun(form, async (v) => { const r = await d.onOk(v, form); if (DB.dialog === d) DB.dialog = null; return r; });
};
/* Nút điều hướng: data-page là trang cần mở, các data-* còn lại (ví dụ data-id, data-tab) thành tham số của trang. */
DB_ACT.go = (el) => { const { act, page, ...arg } = el.dataset; return dbGo(page, arg); };
DB_ACT.reload = () => dbGo(DB.page, DB.arg);
DB_ACT.setClass = (el) => dbSetClass(el.value);

/* Một bộ lắng nghe chung cho mọi nút / biểu mẫu có data-act, data-change, data-input (không dùng onclick chèn dữ liệu). */
function dbDispatch(name, el, ev) {
  const fn = DB_ACT[name];
  if (!fn) { console.error('Chưa có thao tác:', name); return; }
  /* Hết hạn do không hoạt động: authGuard() trong render() sẽ đưa về màn hình đăng nhập, thao tác không được thực hiện. */
  if (Date.now() - sess.t > SESS_IDLE * 60000) { render(); return; }
  sess.t = Date.now();
  try { const r = fn(el, ev); if (r && typeof r.catch === 'function') r.catch((e) => { dbLogError(e); dbShowError(e, el); }); }
  catch (e) { dbLogError(e); dbShowError(e, el); }
}
app.addEventListener('click', (ev) => {
  if (!dbActive()) return;
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'FORM' || el.disabled) return;
  ev.preventDefault();
  dbDispatch(el.dataset.act, el, ev);
});
app.addEventListener('submit', (ev) => {
  if (!dbActive()) return;
  const form = ev.target.closest('form[data-act]');
  if (!form) return;
  ev.preventDefault();
  dbDispatch(form.dataset.act, form, ev);
});
app.addEventListener('change', (ev) => {
  if (!dbActive()) return;
  const el = ev.target.closest('[data-change]');
  if (el) dbDispatch(el.dataset.change, el, ev);
});
app.addEventListener('input', (ev) => {
  if (!dbActive()) return;
  if (sess) sess.t = Date.now();
  const el = ev.target.closest('[data-input]');
  if (el) dbDispatch(el.dataset.input, el, ev);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && dbActive() && DB.dialog) dbCloseDialog();
});

/* ===== Vẽ màn hình (render() trong js/09-render.js gọi hàm này khi đăng nhập bằng Supabase) ===== */
function dbRender() {
  const P = DB_PAGES[DB.page] || DB_PAGES.home;
  /* Giữ nội dung đang nhập khi màn hình được vẽ lại vì lý do khác (đổi giao diện sáng / tối, thu gọn thanh bên, …). */
  const keep = {};
  const routeKey = DB.page + '|' + JSON.stringify(DB.arg) + '|' + (DB.dialog ? DB.dialog.title : '');
  if (!DB.resetForms && DB._routeKey === routeKey) {
    for (const el of app.querySelectorAll('#main input[id], #main textarea[id], #main select[id]')) {
      if (el.type === 'file') continue;
      keep[el.id] = el.type === 'checkbox' || el.type === 'radio' ? { c: el.checked } : { v: el.value };
    }
  }
  DB._routeKey = routeKey; DB.resetForms = false;
  let body;
  if (DB.loadError) body = `<section class="panel"><h2>Không tải được dữ liệu</h2><p class="lead">${h(DB.loadError)}</p>${dbBtn('Thử lại', 'reload')}</section>`;
  else if (DB.data == null) body = `<section class="panel db-loading" aria-busy="true"><p class="lead">Đang tải dữ liệu…</p></section>`;
  else if (!P.noClass && !DB.classId) body = dbNoClassHtml();
  else body = P.view(DB.data);
  dbShell(P, body);
  for (const [id, s] of Object.entries(keep)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if ('c' in s) el.checked = s.c; else if (el.value !== s.v) el.value = s.v;
  }
  /* Ô có data-apply: chạy lại thao tác data-change của nó để phần giao diện phụ thuộc (ví dụ phần đáp án theo dạng câu hỏi) khớp với giá trị vừa khôi phục. */
  for (const el of app.querySelectorAll('#main [data-apply][data-change]')) { const fn = DB_ACT[el.dataset.change]; if (fn) fn(el); }
  document.title = (typeof P.title === 'function' ? P.title() : P.title) + ' | EducMind';
}
function dbNoClassHtml() {
  return dbIsTeacher()
    ? `<section class="panel"><h2>Chưa có lớp nào</h2><p class="lead">Hãy tạo lớp đầu tiên, sau đó thêm bài học, bài tập và mời học sinh vào lớp bằng mã lớp.</p>${dbBtn('Tạo lớp', 'go', { page: 'classes' })}</section>`
    : `<section class="panel"><h2>Em chưa vào lớp nào</h2><p class="lead">Nhập mã lớp do giáo viên cung cấp để vào lớp và xem bài học, bài tập.</p>${dbBtn('Vào lớp bằng mã', 'go', { page: 'classes' })}</section>`;
}

/* ===== Bắt đầu và kết thúc phiên ===== */
/* Gọi sau khi đăng nhập hoặc khôi phục phiên Supabase thành công (js/31-supabase-screens.js). */
async function dbStart(profile) {
  dbReset();
  DB.me = profile;
  DB.page = 'home'; DB.arg = {}; DB.data = null;
  render();
  try {
    await Promise.all([dbSyncClock(), dbLoadClasses()]);
    await dbLoadCourse();
  } catch (e) { console.error(e); DB.loadError = dbErrText(e); }
  dbStartNotifications();
  if (!DB.loadError) await dbLoad();
  render();
}
/* Xóa mọi dữ liệu của phiên khỏi bộ nhớ (đăng xuất, hết phiên). */
function dbReset() {
  DB.timers.forEach((t) => clearInterval(t));
  Object.assign(DB, { me: null, classes: [], classId: '', course: null, page: 'home', arg: {}, data: null, loading: false, loadError: '', dialog: null, notifs: [], timers: [], resetForms: true, _routeKey: '' });
  DB.seq++;
  if (typeof dbExamStop === 'function') dbExamStop();
}
