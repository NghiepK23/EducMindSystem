/* EducMind · js/db/02-shell.js
   Khung giao diện của chế độ dữ liệu thật: thanh trên, thanh điều hướng, ô chọn lớp, thông báo và hộp thoại tài khoản.
   Lưu ý: Dùng lại các lớp CSS của bản gốc (.top, .side, .nav, .head, .panel, …) nên giao diện giống chế độ demo. */

/* Danh mục điều hướng: [tên nhóm, [[khóa trang, nhãn, biểu tượng], …]] */
const DB_NAV_T = [
  ['', [['home', 'Tổng quan', 'dashboard'], ['schedule', 'Lịch & cần làm', 'calendar']]],
  ['Dạy học', [['content', 'Bài học & mục tiêu', 'lessons'], ['assignments', 'Bài tập', 'navAsg'], ['questions', 'Ngân hàng câu hỏi', 'questions'], ['assessments', 'Bài kiểm tra', 'assessments'], ['ai', 'AI tạo câu hỏi', 'spark'], ['games', 'Trò chơi', 'play']]],
  ['Đánh giá học tập', [['progress', 'Mức độ nắm vững', 'mastery'], ['gaps', 'Lỗ hổng kiến thức', 'gaps'], ['recommend', 'Gợi ý học tập', 'recommend'], ['report', 'Báo cáo tiến bộ', 'trend']]],
  ['Quản lý', [['classes', 'Lớp học phụ trách', 'classes'], ['history', 'Lịch sử chỉnh sửa', 'calendar']]],
];
const DB_NAV_S = [
  ['', [['home', 'Tổng quan', 'dashboard'], ['schedule', 'Lịch & cần làm', 'calendar']]],
  ['Học tập', [['lessons', 'Bài học', 'lessons'], ['assignments', 'Bài tập', 'assignments'], ['assessments', 'Bài kiểm tra', 'assessments'], ['games', 'Trò chơi', 'play']]],
  ['Kết quả', [['progress', 'Mức nắm vững', 'mastery'], ['gaps', 'Lỗ hổng kiến thức', 'gaps'], ['recommend', 'Gợi ý học tập', 'recommend'], ['report', 'Báo cáo tiến bộ', 'trend']]],
  ['Lớp học', [['classes', 'Lớp của em', 'classes']]],
];

function dbShell(P, body) {
  const T = dbIsTeacher();
  const unread = DB.notifs.filter((n) => !n.is_read).length;
  const bellLabel = 'Thông báo' + (unread ? ', ' + unread + ' chưa xem' : '');
  const nav = (T ? DB_NAV_T : DB_NAV_S).map(([g, items]) => `<div class="grp${g ? '' : ' grp-bare'}">${g ? `<h2>${g}</h2>` : ''}<div class="items">${items.map(([k, label, icon]) =>
    `<button type="button" class="nav" id="nav-${k}" ${DB.page === k ? 'aria-current="page"' : ''} aria-label="${label}" title="${label}" data-act="go" data-page="${k}">${ic(icon, 18)}<span>${label}</span></button>`).join('')}</div></div>`).join('');
  const title = typeof P.title === 'function' ? P.title() : P.title;
  const sub = typeof P.sub === 'function' ? P.sub() : P.sub;
  const classSelect = !P.noClass && !P.hideClass && DB.classes.length
    ? `<div class="selectbox class-select"><label for="classSelect">${T ? 'Lớp đang chọn' : 'Lớp'}</label><select id="classSelect" data-change="setClass">${DB.classes.map((c) => `<option value="${h(c.id)}" ${c.id === DB.classId ? 'selected' : ''}>${h(c.name)}</option>`).join('')}</select></div>`
    : '';
  const iconBtn = (label, icon, attrs, extra, cls) => `<button type="button" class="btn light icon-only ${cls || ''}" data-iconified="1" ${attrs} aria-label="${label}" title="${label}">${ic(icon, 18)}<span class="sr">${label}</span>${extra || ''}</button>`;
  app.innerHTML = `
  <header class="top">
    ${brandLogoHtml()}
    <span class="spacer"></span>
    <div class="user"><span class="avatar" aria-hidden="true">${h(dbInitials(DB.me.full_name || DB.me.email))}</span><span>${h(dbName(DB.me))} · ${T ? 'Giáo viên' : 'Học sinh'}</span></div>
    ${iconBtn(bellLabel, 'bell', 'data-act="openNotifs" id="db-bell"', unread ? `<span class="nb" aria-hidden="true">${unread > 9 ? '9+' : unread}</span>` : '', 'notif-btn')}
    ${themeBtn()}
    ${iconBtn('Tài khoản', 'user', 'data-act="openAccount"')}
    ${iconBtn('Đăng xuất', 'logout', 'onclick="logout()"')}
  </header>
  <div class="layout ${T ? 'teacher-layout' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${DB.dialog ? 'has-dialog' : ''}" style="--sidebar-width:${sidebarWidth}px">
    <nav class="side" aria-label="Điều hướng chính">${nav}</nav>
    <button type="button" class="side-toggle" onclick="toggleSidebar()" aria-label="${sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'} thanh điều hướng" title="${sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'} thanh điều hướng" aria-expanded="${!sidebarCollapsed}"><span aria-hidden="true">${sidebarCollapsed ? '»' : '«'}</span></button>
    <main class="main" id="main">
      <div class="head">
        <div><h1 id="pageTitle" tabindex="-1">${h(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
        ${classSelect}
      </div>
      <div class="view">${body}</div>${dbDialogHtml()}
    </main>
  </div>`;
  applyLayer4Background();
}

/* ===== Thông báo ===== */
const DB_NOTIF_EVERY = 60000;
async function dbLoadNotifications() {
  if (!dbActive()) return;
  try {
    const list = await dbCall(EducMindDB.listNotifications(30));
    if (!dbActive()) return;
    const before = DB.notifs.filter((n) => !n.is_read).length, after = list.filter((n) => !n.is_read).length;
    DB.notifs = list;
    if (before !== after) dbPaintBell();
  } catch (e) { console.warn('Không tải được thông báo:', e.message || e); }
}
/* Chỉ cập nhật con số trên chuông, không vẽ lại cả trang (tránh làm mất nội dung người dùng đang nhập). */
function dbPaintBell() {
  const b = document.getElementById('db-bell');
  if (!b) return;
  const unread = DB.notifs.filter((n) => !n.is_read).length, label = 'Thông báo' + (unread ? ', ' + unread + ' chưa xem' : '');
  b.setAttribute('aria-label', label); b.title = label;
  const sr = b.querySelector('.sr');
  if (sr) sr.textContent = label;
  let nb = b.querySelector('.nb');
  if (unread) { if (!nb) { nb = document.createElement('span'); nb.className = 'nb'; nb.setAttribute('aria-hidden', 'true'); b.appendChild(nb); } nb.textContent = unread > 9 ? '9+' : String(unread); }
  else if (nb) nb.remove();
}
function dbStartNotifications() {
  dbLoadNotifications();
  DB.timers.push(setInterval(dbLoadNotifications, DB_NOTIF_EVERY));
  /* Realtime: chuông tự cập nhật khi có thông báo mới; dự phòng tự nạp lại định kỳ. */
  if (typeof dbLiveStart === 'function') dbLiveStart();
}
/* Thông báo do máy chủ tạo, payload.page cho biết nên mở trang nào. */
function dbNotifTarget(n) {
  const p = n.payload || {}, T = dbIsTeacher();
  const map = {
    grading: p.assessment_id ? ['assessments', { id: p.assessment_id, tab: 'attempts' }] : ['assignments', { id: p.assignment_id }],
    results: p.assessment_id ? ['assessments', { id: p.assessment_id }] : ['assignments', { id: p.assignment_id }],
    lessons: [T ? 'content' : 'lessons', {}],
    assignments: ['assignments', p.assignment_id ? { id: p.assignment_id } : {}],
    assessments: ['assessments', p.assessment_id ? { id: p.assessment_id } : {}],
    recommend: ['recommend', {}],
    ai: ['ai', {}],
    students: ['classes', {}],
    dashboard: ['home', {}],
  };
  const t = map[p.page] || ['home', {}];
  Object.keys(t[1]).forEach((k) => t[1][k] == null && delete t[1][k]);
  return { page: t[0], arg: t[1], classId: p.class_id || '' };
}
DB_ACT.openNotifs = async () => {
  await dbLoadNotifications();
  const rows = DB.notifs.map((n) => `<button type="button" class="db-notif${n.is_read ? '' : ' unread'}" data-act="openNotif" data-id="${h(n.id)}">
      <b>${h(n.title)}</b>${n.content ? `<span class="muted">${h(n.content)}</span>` : ''}<span class="muted db-notif-time">${dbDateTime(n.created_at)}${n.is_read ? '' : ' · chưa xem'}</span></button>`).join('');
  dbOpenDialog({
    title: 'Thông báo', wide: true,
    body: (DB.notifs.some((n) => !n.is_read) ? `<div class="row" style="justify-content:flex-end">${dbBtn('Đánh dấu tất cả đã xem', 'readAllNotifs', {}, 'light mini')}</div>` : '') + (rows ? `<div class="db-notifs">${rows}</div>` : dbEmpty('Chưa có thông báo nào.')),
  });
};
DB_ACT.readAllNotifs = (el) => dbRun(el, async () => {
  await dbCall(EducMindDB.markAllNotificationsRead());
  DB.notifs.forEach((n) => { n.is_read = true; });
  DB.dialog = null; render();
  return false;
}, 'Đã đánh dấu tất cả thông báo là đã xem.');
DB_ACT.openNotif = async (el) => {
  const n = DB.notifs.find((x) => x.id === el.dataset.id);
  if (!n) return;
  if (!n.is_read) { n.is_read = true; EducMindDB.markNotificationRead(n.id).then(({ error }) => error && console.warn(error.message)); }
  const t = dbNotifTarget(n);
  DB.dialog = null;
  if (t.classId && t.classId !== DB.classId && DB.classes.some((c) => c.id === t.classId)) await dbSetClass(t.classId, t.page, t.arg);
  else await dbGo(t.page, t.arg);
};

/* ===== Tài khoản ===== */
DB_ACT.openAccount = () => dbOpenDialog({
  title: 'Tài khoản', okLabel: 'Lưu thay đổi',
  body: `<div class="facts"><div><span>Email</span><b>${h(DB.me.email)}</b></div><div><span>Vai trò</span><b>${dbIsTeacher() ? 'Giáo viên' : 'Học sinh'}</b></div></div>
    ${dbField('Họ và tên', 'db-acc-name', `<input id="db-acc-name" name="full_name" maxlength="120" value="${h(DB.me.full_name)}" autocomplete="name">`)}
    ${dbField('Mật khẩu mới', 'db-acc-pw', `<input id="db-acc-pw" name="pw" type="password" autocomplete="new-password">`, `Để trống nếu không đổi. Tối thiểu ${PW_MIN} ký tự.`)}
    ${dbField('Nhập lại mật khẩu mới', 'db-acc-pw2', `<input id="db-acc-pw2" name="pw2" type="password" autocomplete="new-password">`)}
    ${dbIsTeacher() ? `<div class="field"><span class="db-label">Tạo câu hỏi bằng AI</span>${dbBtn('Quản lý API key Gemini', 'aiKeySettings', {}, 'light')}</div>` : ''}`,
  onOk: async (v) => {
    if (!v.full_name) throw new Error('Nhập họ và tên.');
    if (v.pw || v.pw2) {
      if (v.pw.length < PW_MIN) throw new Error('Mật khẩu mới cần ít nhất ' + PW_MIN + ' ký tự.');
      if (v.pw !== v.pw2) throw new Error('Hai lần nhập mật khẩu không khớp.');
    }
    if (v.full_name !== DB.me.full_name) DB.me = await dbCall(EducMindDB.renameMe(v.full_name));
    if (v.pw) { const { error } = await supabaseClient.auth.updateUser({ password: v.pw }); if (error) throw new Error('Không đổi được mật khẩu: ' + dbErrText(error)); }
    toast(v.pw ? 'Đã lưu họ tên và mật khẩu mới.' : 'Đã lưu thay đổi.');
  },
});

DB_ACT.aiKeySettings = async () => {
  const status = await dbCall(EducMindDB.aiCredentials('status'));
  dbOpenDialog({
    title: 'API key Gemini',
    okLabel: 'Lưu API key',
    body: `<p class="lead">${status.configured ? `Đã lưu key kết thúc bằng <b>…${h(status.key_hint)}</b>.` : 'Chưa có API key Gemini được lưu.'}</p>
      <p class="muted">Nhập key của dự án Google AI Studio. Key được mã hóa trên máy chủ; ứng dụng không gửi key này xuống màn hình sau khi lưu.</p>
      ${dbField('API key Gemini', 'db-ai-key', `<input id="db-ai-key" name="api_key" type="password" maxlength="256" autocomplete="off" required>`, 'Để thay key hiện tại, nhập key mới vào đây.') }
      ${status.configured ? `<div class="row">${dbBtn('Xóa API key đã lưu', 'aiKeyDelete', {}, 'light mini danger-soft')}</div>` : ''}`,
    onOk: async (v) => {
      const apiKey = (v.api_key || '').trim();
      if (!apiKey) throw new Error('Hãy nhập API key Gemini cần lưu.');
      await dbCall(EducMindDB.aiCredentials('save', apiKey));
      toast('Đã lưu API key Gemini riêng cho tài khoản.');
    },
  });
};

DB_ACT.aiKeyDelete = () => dbConfirm(
  'Xóa API key Gemini?',
  'Bạn sẽ không thể tạo câu hỏi bằng AI cho đến khi lưu key mới.',
  'Xóa API key',
  async () => {
    await dbCall(EducMindDB.aiCredentials('delete'));
    toast('Đã xóa API key Gemini khỏi tài khoản.');
  },
  true,
);
