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
function dbResolveClassGrade(className, grade) {
  if (grade != null && grade !== '') {
    const value = Number(grade);
    if (Number.isInteger(value) && value >= 1 && value <= 12) return value;
    throw new Error('Khối là số nguyên từ 1 đến 12.');
  }
  const match = String(className || '').trim().match(/^(1[0-2]|[1-9])[\s-]*[A-Za-z]{1,2}[\s-]*\d{1,2}$/);
  if (!match) throw new Error('Không xác định được khối từ tên lớp. Hãy nhập khối lớp (1–12) để tạo khóa học.');
  return Number(match[1]);
}
const dbDefaultCourseTitle = (className, grade) => `Tin học ${dbResolveClassGrade(className, grade)}`;

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
/* Hai ô ngày/giờ thay cho datetime-local: kích thước ổn định, dễ thao tác và
   vẫn gửi về form một giá trị local dạng YYYY-MM-DDTHH:mm. */
function dbDatetimeField(id, name, iso, attr = '', minIso = null) {
  const local = dbToLocalInput(iso);
  const [date = '', time = ''] = local.split('T');
  const d = date ? date.split('-') : ['', '', ''];
  const dateText = d[0] && d[1] && d[2] ? `${dbPad(d[2])}/${dbPad(d[1])}/${d[0]}` : 'Chọn ngày';
  const timeText = time || '--:--';
  const disabled = /disabled/.test(attr) ? ' disabled' : '';
  return `<span class="db-datetime" data-datetime="${h(id)}">
    <input id="${h(id)}" name="${h(name)}" type="hidden" value="${h(local)}">
    <input type="hidden" data-datetime-min value="${h(minIso ? dbToLocalInput(minIso) : '')}">
    <button type="button" class="db-datetime-trigger" data-db-datetime-open="${h(id)}"${disabled} aria-label="Chọn ngày và giờ">
      <span class="db-datetime-icon">${ic('calendar', 22)}</span>
      <span class="db-datetime-value"><b>${h(dateText)}</b><small>${h(timeText)}</small></span>
      <span class="db-datetime-chevron" aria-hidden="true">⌄</span>
    </button>
  </span>`;
}
function dbSyncDatetime(el) {
  const box = el.closest ? el.closest('[data-datetime]') : null;
  if (!box) return;
  const hidden = box.querySelector('input[type="hidden"]');
  if (!hidden) return;
  dbDatetimePaint(box, hidden.value);
}
function dbDatetimePaint(box, local) {
  if (!box) return;
  const hidden = box.querySelector('input[type="hidden"]');
  if (hidden) hidden.value = local || '';
  const trigger = box.querySelector('.db-datetime-trigger');
  if (!trigger) return;
  const [date = '', time = ''] = (local || '').split('T');
  const p = date.split('-');
  const dateText = p.length === 3 ? `${dbPad(p[2])}/${dbPad(p[1])}/${p[0]}` : 'Chọn ngày';
  const value = trigger.querySelector('.db-datetime-value');
  if (value) value.innerHTML = `<b>${h(dateText)}</b><small>${h(time || '--:--')}</small>`;
}
let dbDateTimePop = null;
function dbDatetimeClose() {
  if (dbDateTimePop?.el?.parentNode) dbDateTimePop.el.remove();
  dbDateTimePop = null;
  document.removeEventListener('mousedown', dbDatetimeOutside, true);
  document.removeEventListener('keydown', dbDatetimeKey, true);
}
function dbDatetimeOutside(e) {
  if (!dbDateTimePop) return;
  if (dbDateTimePop.el.contains(e.target) || e.target.closest('[data-db-datetime-open]')) return;
  dbDatetimeClose();
}
function dbDatetimeKey(e) {
  if (e.key === 'Escape') dbDatetimeClose();
}
function dbDatetimeOpen(trigger) {
  if (trigger.disabled) return;
  if (dbDateTimePop?.trigger === trigger) { dbDatetimeClose(); return; }
  dbDatetimeClose();
  const box = trigger.closest('[data-datetime]');
  const hidden = box.querySelector('input[type="hidden"]');
  let [date = '', time = ''] = (hidden.value || '').split('T');
  let d = date ? new Date(`${date}T00:00:00`) : new Date();
  if (isNaN(d)) d = new Date();
  if (!time) time = '09:00';
  const minInput = box.querySelector('[data-datetime-min]');
  const minLocal = minInput?.value || '';
  dbDateTimePop = { trigger, box, hidden, y: d.getFullYear(), m: d.getMonth(), date, time, minLocal, el: null };
  const el = document.createElement('div');
  el.className = 'db-datetime-pop';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Chọn ngày và giờ');
  document.body.appendChild(el);
  dbDateTimePop.el = el;
  dbDatetimePaintPop();
  dbDatetimePlace();
  document.addEventListener('mousedown', dbDatetimeOutside, true);
  document.addEventListener('keydown', dbDatetimeKey, true);
}
function dbDatetimePlace() {
  if (!dbDateTimePop) return;
  const r = dbDateTimePop.trigger.getBoundingClientRect();
  const el = dbDateTimePop.el;
  const w = el.offsetWidth || 380;
  const h = el.offsetHeight || 470;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  let top = r.bottom + 10;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 10);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}
function dbDatetimePaintPop() {
  if (!dbDateTimePop) return;
  const p = dbDateTimePop;
  const y = p.y, m = p.m;
  const min = p.minLocal ? new Date(p.minLocal) : null;
  const minDay = min && !isNaN(min)
    ? new Date(min.getFullYear(), min.getMonth(), min.getDate()).getTime()
    : -Infinity;
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const total = Math.ceil((lead + new Date(y, m + 1, 0).getDate()) / 7) * 7;
  const dow = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  let cells = '';
  const minIso = min && !isNaN(min)
    ? `${min.getFullYear()}-${dbPad(min.getMonth() + 1)}-${dbPad(min.getDate())}`
    : '';
  if (p.date === minIso) {
    const parts = p.time.split(':');
    let h = Number(parts[0] || 0), minute = Number(parts[1] || 0);
    const minH = min.getHours(), minM = min.getMinutes();
    if (h < minH || (h === minH && minute < minM)) {
      h = minH; minute = minM;
      p.time = `${dbPad(h)}:${dbPad(minute)}`;
    }
  }
  for (let i = 0; i < total; i++) {
    const day = i - lead + 1;
    const d = new Date(y, m, day);
    const iso = `${d.getFullYear()}-${dbPad(d.getMonth() + 1)}-${dbPad(d.getDate())}`;
    const out = d.getMonth() !== m;
    const disabled = d.getTime() < minDay;
    cells += `<button type="button" class="db-dp-day${out ? ' is-out' : ''}${iso === p.date ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}" data-db-date="${iso}" aria-label="${dbPad(d.getDate())}/${dbPad(d.getMonth() + 1)}/${d.getFullYear()}${disabled ? ' — không thể chọn' : ''}"${disabled ? ' disabled' : ''}>${d.getDate()}</button>`;
  }
  const [hour = '09', minute = '00'] = p.time.split(':');
  const timeMinimum = p.minLocal ? new Date(p.minLocal) : null;
  const timeMinIso = timeMinimum && !isNaN(timeMinimum)
    ? `${timeMinimum.getFullYear()}-${dbPad(timeMinimum.getMonth() + 1)}-${dbPad(timeMinimum.getDate())}`
    : '';
  const isMinDate = !!timeMinIso && p.date === timeMinIso;
  const hourMin = isMinDate && timeMinimum ? timeMinimum.getHours() : 0;
  const minuteMin = isMinDate && timeMinimum && Number(hour) === timeMinimum.getHours() ? timeMinimum.getMinutes() : 0;
  let canPrev = true;
  if (timeMinimum) {
    canPrev = y > timeMinimum.getFullYear() || (y === timeMinimum.getFullYear() && m > timeMinimum.getMonth());
  }
  p.el.innerHTML = `
    <div class="db-dp-head">
      <button type="button" class="db-dp-nav" data-db-month="-1" aria-label="Tháng trước"${canPrev ? '' : ' disabled'}>‹</button>
      <b>Tháng ${m + 1} năm ${y}</b>
      <button type="button" class="db-dp-nav" data-db-month="1" aria-label="Tháng sau">›</button>
    </div>
    <div class="db-dp-calendar">
      ${dow.map((v) => `<span class="db-dp-dow">${v}</span>`).join('')}
      ${cells}
    </div>
    <div class="db-dp-time">
      <label><span>Giờ</span><input type="number" min="${hourMin}" max="23" value="${h(hour)}" data-db-hour inputmode="numeric"></label>
      <label><span>Phút</span><input type="number" min="${minuteMin}" max="59" value="${h(minute)}" data-db-minute inputmode="numeric"></label>
    </div>
    <div class="db-dp-actions">
      <button type="button" class="btn light" data-db-clear>Đặt lại</button>
      <button type="button" class="btn" data-db-apply>Xong</button>
    </div>`;
  dbDatetimePlace();
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
/* Tên tệp dùng cho khóa Storage: Supabase Storage chỉ cho phép ký tự ASCII
   [A-Za-z0-9_/!.*'() &$=@;:+,?-] — tên có dấu tiếng Việt bị từ chối ("Invalid key").
   Bỏ dấu, thay ký tự lạ bằng '-', giữ nguyên đuôi tệp; tên hiển thị vẫn dùng tên gốc. */
function dbSafeFileName(name) {
  const s = String(name || 'tep');
  const dot = s.lastIndexOf('.');
  let base = (dot > 0 ? s.slice(0, dot) : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  base = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[.\-_]+|[.\-_]+$/g, '').slice(0, 80) || 'tep';
  const ext = dot > 0 ? s.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]+/g, '') : '';
  return ext ? base + '.' + ext : base;
}

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
  [/Assignment unavailable/i, 'Không tìm thấy bài tập hoặc bạn không có quyền truy cập.'],
  [/Assignment needs questions or instructions before publication/i, 'Hãy thêm ít nhất một câu hỏi hoặc nhập yêu cầu bài tập trước khi xuất bản.'],
  [/Assignment questions are locked after the first submission/i, 'Đã có học sinh nộp bài nên không thể đổi câu hỏi của bài tập.'],
  [/Question is not (part of this assignment|in the assignment course)/i, 'Câu hỏi không thuộc bài tập này hoặc không cùng lớp.'],
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
  if (dbIsTeacher() && page === 'games') {
    toast('Trò chơi chỉ dành cho học sinh. Giáo viên có thể xem trước câu hỏi trong trang Bài tập.');
    page = 'assignments'; arg = {};
  }
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
  if (!DB.course) DB.course = await dbCall(EducMindDB.createCourse({ class_id: c.id, title: dbDefaultCourseTitle(c.name, c.grade) }));
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
  if (scope) for (const part of scope.querySelectorAll('[data-datetime-part]')) dbSyncDatetime(part);
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

/* ===== Thẻ tiến trình tải tệp =====
   Nổi góc dưới cùng, nằm ngoài vùng render nên không bị mất khi giao diện vẽ lại.
   Trình tự: dbUploadShow(tên tệp) → dbUploadProgress(đã gửi, tổng) trong lúc tải byte
   → dbUploadSaving() khi máy chủ lưu → dbUploadHide() khi xong hoặc lỗi. */
function dbUploadCard() {
  let n = document.getElementById('db-upload');
  if (!n) {
    n = document.createElement('div');
    n.id = 'db-upload';
    n.className = 'db-upload';
    n.hidden = true;
    n.setAttribute('role', 'status');
    n.setAttribute('aria-live', 'polite');
    n.innerHTML = '<div class="db-upload-name"></div><div class="db-upload-track"><div class="db-upload-fill"></div></div><div class="db-upload-text"></div>';
    document.body.appendChild(n);
  }
  return n;
}
function dbUploadShow(name) {
  const n = dbUploadCard();
  n.classList.remove('db-upload-db');
  n.querySelector('.db-upload-name').textContent = name;
  n.querySelector('.db-upload-fill').style.width = '0%';
  n.querySelector('.db-upload-text').textContent = 'Đang tải lên… 0%';
  n.hidden = false;
}
function dbUploadProgress(loaded, total) {
  const n = dbUploadCard();
  const pct = Math.round(Math.max(0, Math.min(1, total > 0 ? loaded / total : 0)) * 100);
  n.querySelector('.db-upload-fill').style.width = pct + '%';
  n.querySelector('.db-upload-text').textContent = 'Đang tải lên… ' + pct + '%';
}
function dbUploadSaving() {
  const n = dbUploadCard();
  n.classList.add('db-upload-db');
  n.querySelector('.db-upload-text').textContent = 'Đang lưu vào cơ sở dữ liệu…';
}
function dbUploadHide() {
  const n = document.getElementById('db-upload');
  if (n) n.hidden = true;
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
  const dtOpen = ev.target.closest('[data-db-datetime-open]');
  if (dtOpen) { ev.preventDefault(); dbDatetimeOpen(dtOpen); return; }
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
/* Popup được gắn trực tiếp vào body nên nằm ngoài #app. Lắng nghe riêng
   các thao tác của popup để chọn ngày, đổi tháng, đặt lại và xác nhận đều hoạt động. */
document.addEventListener('click', (ev) => {
  if (!dbDateTimePop) return;
  const target = ev.target;
  if (dbDateTimePop.el && dbDateTimePop.el.contains(target)) ev.preventDefault();

  if (target.closest('[data-db-date]')) {
    dbDateTimePop.date = target.closest('[data-db-date]').dataset.dbDate;
    dbDatetimePaintPop();
    return;
  }
  if (target.closest('[data-db-month]')) {
    const delta = Number(target.closest('[data-db-month]').dataset.dbMonth);
    const m = dbDateTimePop.m + delta;
    dbDateTimePop.y += m < 0 ? -1 : m > 11 ? 1 : 0;
    dbDateTimePop.m = (m + 12) % 12;
    dbDatetimePaintPop();
    return;
  }
  if (target.closest('[data-db-clear]')) {
    dbDatetimePaint(dbDateTimePop.box, '');
    dbDatetimeClose();
    return;
  }
  if (target.closest('[data-db-apply]')) {
    const hour = dbDateTimePop.el.querySelector('[data-db-hour]');
    const minute = dbDateTimePop.el.querySelector('[data-db-minute]');
    const h = Math.max(0, Math.min(23, Number(hour?.value ?? 0)));
    const m = Math.max(0, Math.min(59, Number(minute?.value ?? 0)));
    dbDateTimePop.time = `${dbPad(h)}:${dbPad(m)}`;
    if (!dbDateTimePop.date) {
      const now = new Date();
      const maxDay = new Date(dbDateTimePop.y, dbDateTimePop.m + 1, 0).getDate();
      const day = dbDateTimePop.y === now.getFullYear() && dbDateTimePop.m === now.getMonth()
        ? Math.min(now.getDate(), maxDay)
        : 1;
      dbDateTimePop.date = `${dbDateTimePop.y}-${dbPad(dbDateTimePop.m + 1)}-${dbPad(day)}`;
    }
    if (dbDateTimePop.minLocal) {
      const selected = new Date(`${dbDateTimePop.date}T${dbDateTimePop.time}:00`);
      const minimum = new Date(dbDateTimePop.minLocal);
      if (!isNaN(selected) && !isNaN(minimum) && selected < minimum) {
        toast('Thời gian phải từ ' + dbDateTime(minimum.toISOString()) + ' trở đi.');
        return;
      }
    }
    dbDatetimePaint(dbDateTimePop.box, `${dbDateTimePop.date}T${dbDateTimePop.time}`);
    dbDatetimeClose();
  }
});
document.addEventListener('input', (ev) => {
  if (!dbDateTimePop) return;
  const target = ev.target;
  if (!target.matches('[data-db-hour],[data-db-minute]')) return;
  const hourInput = dbDateTimePop.el.querySelector('[data-db-hour]');
  const minuteInput = dbDateTimePop.el.querySelector('[data-db-minute]');
  let h = Math.max(0, Math.min(23, Number(hourInput?.value || 0)));
  let m = Math.max(0, Math.min(59, Number(minuteInput?.value || 0)));
  const minimum = dbDateTimePop.minLocal ? new Date(dbDateTimePop.minLocal) : null;
  const minIso = minimum && !isNaN(minimum)
    ? `${minimum.getFullYear()}-${dbPad(minimum.getMonth() + 1)}-${dbPad(minimum.getDate())}`
    : '';
  if (minimum && dbDateTimePop.date === minIso) {
    if (h < minimum.getHours()) h = minimum.getHours();
    if (h === minimum.getHours() && m < minimum.getMinutes()) m = minimum.getMinutes();
  }
  hourInput.value = dbPad(h);
  minuteInput.value = dbPad(m);
  dbDateTimePop.time = `${dbPad(h)}:${dbPad(m)}`;
  const minuteMin = h === (minimum?.getHours() ?? -1) && dbDateTimePop.date === minIso
    ? minimum.getMinutes()
    : 0;
  minuteInput.min = String(minuteMin);
});
app.addEventListener('change', (ev) => {
  if (!dbActive()) return;
  if (ev.target.matches('[data-datetime-part]')) dbSyncDatetime(ev.target);
  const el = ev.target.closest('[data-change]');
  if (el) dbDispatch(el.dataset.change, el, ev);
});
app.addEventListener('input', (ev) => {
  if (!dbActive()) return;
  if (sess) sess.t = Date.now();
  if (ev.target.matches('[data-datetime-part]')) dbSyncDatetime(ev.target);
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
  if (typeof dbLiveStop === 'function') dbLiveStop();
  Object.assign(DB, { me: null, classes: [], classId: '', course: null, page: 'home', arg: {}, data: null, loading: false, loadError: '', dialog: null, notifs: [], timers: [], resetForms: true, _routeKey: '' });
  DB.seq++;
  if (typeof dbExamStop === 'function') dbExamStop();
}
