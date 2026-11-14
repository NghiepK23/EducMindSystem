/* EducMind · js/db/04-content.js
   Nội dung học tập: Chủ đề → Bài học → Mục tiêu. Giáo viên soạn và xuất bản; học sinh xem bài đã xuất bản kèm mức nắm vững. */

/* Nạp cây nội dung của lớp đang chọn. Dùng chung cho nhiều trang (bài tập, câu hỏi, đánh giá) để hiện tên bài học / mục tiêu. */
async function dbLoadContent() {
  if (!DB.course) return { topics: [], lessons: [], objectives: [], resources: [] };
  const [topics, lessons, resources] = await Promise.all([dbCall(EducMindDB.listTopics(DB.course.id)), dbCall(EducMindDB.listLessons(DB.course.id)), dbCall(EducMindDB.listResources(DB.course.id))]);
  const topicIds = new Set(topics.map((t) => t.id));
  const live = lessons.filter((l) => topicIds.has(l.topic_id));
  const objectives = await dbCallIn(EducMindDB.listObjectives, live.map((l) => l.id));
  return { topics, lessons: live, objectives, resources };
}
/* Thùng rác của lớp: chủ đề / bài học / bài tập / câu hỏi đã xóa mềm, chờ khôi phục. */
async function dbLoadTrash() {
  if (!DB.course) return { trash: [] };
  const [topics, lessons, assignments, questions] = await Promise.all([
    dbCall(EducMindDB.listDeletedTopics(DB.course.id)), dbCall(EducMindDB.listDeletedLessons(DB.course.id)),
    dbCall(EducMindDB.listDeletedAssignments(DB.course.id)), dbCall(EducMindDB.listDeletedQuestions(DB.course.id)),
  ]);
  return { trash: [
    ...topics.map((x) => ({ ...x, type: 'topic', label: 'Chủ đề' })),
    ...lessons.map((x) => ({ ...x, type: 'lesson', label: 'Bài học' })),
    ...assignments.map((x) => ({ ...x, type: 'assignment', label: 'Bài tập' })),
    ...questions.map((x) => ({ ...x, type: 'question', label: 'Câu hỏi', title: x.content })),
  ] };
}
/* Dung lượng tệp dạng dễ đọc: 1,2 MB / 340 KB. */
const dbFileSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
/* Nhãn mục tiêu: "MT1 · Nhận biết mạng LAN" */
const dbObjLabel = (o) => (o ? `${h(o.code)} · ${h(o.description)}` : 'Mục tiêu đã xóa');
/* Danh sách ô chọn mục tiêu, nhóm theo bài học. name là tên trường của biểu mẫu, picked là tập mã mục tiêu đang chọn. */
function dbObjectivePicker(content, name, picked, onlyLesson) {
  const byLesson = dbGroup(content.objectives, 'lesson_id');
  const lessons = content.lessons.filter((l) => (byLesson[l.id] || []).length && (!onlyLesson || l.id === onlyLesson));
  if (!lessons.length) return `<p class="muted">Chưa có mục tiêu nào. Hãy thêm mục tiêu ở trang “Bài học &amp; mục tiêu” trước.</p>`;
  return `<div class="db-objpick">${lessons.map((l) => `<fieldset><legend>${h(l.title)}</legend>${byLesson[l.id].map((o) =>
    `<label class="objrow"><input type="checkbox" name="${name}" data-multi value="${h(o.id)}" ${picked.has(o.id) ? 'checked' : ''}><span>${dbObjLabel(o)}</span></label>`).join('')}</fieldset>`).join('')}</div>`;
}
/* Đồng bộ bảng liên kết mục tiêu (assignment_objectives / question_objectives): thêm cái mới chọn, gỡ cái bỏ chọn. */
async function dbSyncLinks(current, wanted, add, remove) {
  const cur = new Set(current), want = new Set(wanted);
  const toAdd = [...want].filter((x) => !cur.has(x)), toRemove = [...cur].filter((x) => !want.has(x));
  if (toRemove.length) await remove(toRemove);
  if (toAdd.length) await add(toAdd);
}

/* ===== Giáo viên: Bài học & mục tiêu ===== */
DB_PAGES.content = {
  title: 'Bài học & mục tiêu',
  sub: 'Học sinh chỉ thấy bài học khi cả chủ đề và bài học đều đã xuất bản.',
  load: async () => ({ ...(await dbLoadContent()), ...(await dbLoadTrash()) }),
  view(d) {
    const lessonsBy = dbGroup(d.lessons, 'topic_id'), objBy = dbGroup(d.objectives, 'lesson_id');
    const topic = d.topics.find((t) => t.id === DB.arg.topicId);
    const lesson = topic && d.lessons.find((l) => l.id === DB.arg.lessonId && l.topic_id === topic.id);
    if (lesson) return dbContentLessonView(d, topic, lesson, objBy[lesson.id] || []);
    if (topic) return dbContentTopicView(d, topic, lessonsBy[topic.id] || [], objBy);
    return dbContentRootView(d, lessonsBy, objBy);
  },
};

function dbContentRootView(d, lessonsBy, objBy) {
  const cards = d.topics.map((t, i) => {
    const lessons = lessonsBy[t.id] || [];
    const objectiveCount = lessons.reduce((n, l) => n + (objBy[l.id] || []).length, 0);
    return `<button type="button" class="folder-tile" data-act="openContentTopic" data-id="${h(t.id)}">
      <span class="folder-icon">${ic('lessons', 20)}</span><span><b>${h(t.title)}</b>
        <span class="muted">${dbStatusPill(t.status)} · ${lessons.length} bài học · ${objectiveCount} mục tiêu${t.description ? '<br>' + h(t.description) : ''}</span>
      </span><span class="sr">Mở chủ đề ${i + 1}</span>
    </button>`;
  }).join('');
  return `<section class="panel" aria-labelledby="db-h-topic">
    <div class="row between"><div><h2 id="db-h-topic">Thư mục nội dung</h2><p class="lead">${d.topics.length ? d.topics.length + ' chủ đề · ' + d.lessons.length + ' bài học · ' + d.objectives.length + ' mục tiêu' : 'Lớp chưa có nội dung. Bắt đầu bằng việc thêm một chủ đề.'}</p></div></div>
    <form data-act="createTopic" class="db-form-row" novalidate>
      ${dbField('Tên chủ đề mới', 'db-new-topic', `<input id="db-new-topic" name="title" maxlength="200" placeholder="Nhập tên chủ đề" required>`)}
      <button type="submit" class="btn">${ic('plus', 16)}Thêm chủ đề</button>${dbFormError()}
    </form>
    <label class="db-check db-seq-toggle"><input type="checkbox" data-change="toggleSequential" ${DB.course && DB.course.sequential_unlock ? 'checked' : ''}> Mở bài học tuần tự: học sinh chỉ mở được bài sau khi nắm vững (≥ 0,8) mọi mục tiêu của bài trước</label>
  </section>
  <div class="folder-grid" aria-label="Danh sách chủ đề">${cards || `<div class="folder-empty">Chưa có chủ đề. Thêm chủ đề để bắt đầu xây dựng nội dung.</div>`}</div>
  ${dbTrashPanel(d)}`;
}

function dbContentTopicView(d, topic, lessons, objBy) {
  const rows = lessons.map((l) => `<button type="button" class="folder-lesson-row" data-act="openContentLesson" data-id="${h(l.id)}" data-topic-id="${h(topic.id)}">
    <span class="lesson-name"><b>${h(l.title)}</b><small>${(objBy[l.id] || []).length} mục tiêu cần đạt · ${h(l.status === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp')}</small></span>${ic('arrow', 17)}
  </button>`).join('');
  const published = topic.status === 'PUBLISHED';
  return `<div class="folder-wrap">
    <nav class="folder-crumb" aria-label="Đường dẫn"><button type="button" data-act="openContentRoot">Thư mục nội dung</button><span aria-hidden="true">›</span><b>${h(topic.title)}</b></nav>
    <section class="panel">
      <div class="row between"><div><h2>${h(topic.title)}</h2><p class="lead">${dbStatusPill(topic.status)} · ${lessons.length} bài học${topic.description ? ' · ' + h(topic.description) : ''}</p></div>
        <div class="row">${dbBtn(published ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleTopic', { id: topic.id }, published ? 'light mini' : 'mini')}${dbBtn('Sửa chủ đề', 'editTopic', { id: topic.id }, 'light mini')}${dbBtn('Xóa', 'deleteTopic', { id: topic.id }, 'light mini danger-soft')}</div>
      </div>
      <div class="topic-lessons">${rows || `<div class="folder-empty">Chủ đề chưa có bài học. Thêm bài học bên dưới để bắt đầu.</div>`}</div>
      <form data-act="createLesson" data-topic="${h(topic.id)}" class="db-form-row db-add-row" novalidate>
        ${dbField('Tên bài học mới', 'db-nl-' + h(topic.id), `<input id="db-nl-${h(topic.id)}" name="title" maxlength="200" placeholder="Nhập tên bài học" required>`)}
        <button type="submit" class="btn light">${ic('plus', 16)}Thêm bài học</button>${dbFormError()}
      </form>
    </section>
  </div>`;
}

function dbContentLessonView(d, topic, lesson, objectives) {
  const tab = DB.arg.tab === 'resources' ? 'resources' : 'objectives';
  const tabs = `<div class="folder-tabs split-2" role="tablist" aria-label="Nội dung bài học">
    <button type="button" role="tab" aria-selected="${tab === 'objectives'}" data-act="selectContentTab" data-tab="objectives">${ic('target', 16)}<span>Mục tiêu</span></button>
    <button type="button" role="tab" aria-selected="${tab === 'resources'}" data-act="selectContentTab" data-tab="resources">${ic('file', 16)}<span>Tài liệu</span></button>
  </div>`;
  const body = tab === 'resources' ? dbLessonResources(lesson, (d.resources || []).filter((r) => r.lesson_id === lesson.id)) : dbLessonObjectives(lesson, objectives);
  const published = lesson.status === 'PUBLISHED';
  return `<div class="folder-wrap">
    <nav class="folder-crumb" aria-label="Đường dẫn"><button type="button" data-act="openContentRoot">Thư mục nội dung</button><span aria-hidden="true">›</span><button type="button" data-act="openContentTopic" data-id="${h(topic.id)}">${h(topic.title)}</button><span aria-hidden="true">›</span><b>${h(lesson.title)}</b></nav>
    <section class="panel lesson-workspace">
      <div class="lesson-workspace-head">
        <div class="row between"><div><h2>${h(lesson.title)}</h2><p class="lead">${dbStatusPill(lesson.status)} · ${h(topic.title)}</p>${lesson.description ? `<p class="muted">${h(lesson.description)}</p>` : ''}</div>
          <div class="row">${dbBtn(published ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleLesson', { id: lesson.id }, published ? 'light mini' : 'mini')}${dbBtn('Sửa bài học', 'editLesson', { id: lesson.id }, 'light mini')}${dbBtn('Xóa', 'deleteLesson', { id: lesson.id }, 'light mini danger-soft')}</div>
        </div>${tabs}
      </div>
      <div class="lesson-workspace-body">${body}</div>
    </section>
  </div>`;
}

function dbLessonObjectives(lesson, objectives) {
  const rows = objectives.map((o) => `<li><span class="db-obj-code">${h(o.code)}</span><span class="db-obj-text">${h(o.description)}</span>
    <span class="row">${dbBtn('Sửa', 'editObjective', { id: o.id }, 'light mini')}${dbBtn('Xóa', 'deleteObjective', { id: o.id }, 'light mini danger-soft')}</span></li>`).join('');
  return `<section class="panel">
    <div class="row between"><div><h3>Mục tiêu cần đạt</h3><p class="lead">Mục tiêu được dùng để gắn câu hỏi và theo dõi mức độ nắm vững.</p></div><span class="pill plain">${objectives.length} mục tiêu</span></div>
    ${rows ? `<ul class="db-objectives">${rows}</ul>` : `<div class="folder-empty">Chưa có mục tiêu cho bài học này.</div>`}
    <form data-act="createObjective" data-lesson="${h(lesson.id)}" class="db-form-row db-add-row" novalidate>
      ${dbField('Mã', 'db-oc-' + h(lesson.id), `<input id="db-oc-${h(lesson.id)}" name="code" maxlength="20" value="${h(dbNextObjectiveCode(objectives))}" class="db-input-code" required>`)}
      ${dbField('Mục tiêu mới', 'db-od-' + h(lesson.id), `<input id="db-od-${h(lesson.id)}" name="description" maxlength="500" placeholder="Nhập điều học sinh cần đạt" required>`)}
      <button type="submit" class="btn light">${ic('plus', 16)}Thêm mục tiêu</button>${dbFormError()}
    </form>
  </section>`;
}
/* ===== Xem trước tài liệu =====
   Nhận dạng nhóm tệp theo ĐUÔI TỆP trước (trình duyệt hay để trống MIME với .h, .cpp, .py…),
   rồi mới tới MIME. Nhóm 'office' và 'other' không xem trước được trong trình duyệt → tải xuống. */
const DB_FILE_KINDS = {
  image: 'png jpg jpeg gif webp avif bmp svg',
  pdf: 'pdf',
  video: 'mp4 webm ogv mov m4v',
  audio: 'mp3 wav ogg oga m4a aac flac opus',
  code: 'txt csv md json js ts jsx tsx html htm css scss less py java c cpp cc cxx h hpp hh cs php rb go rs sql xml yml yaml sh bat ps1 ini toml cfg lua kt swift r pl vue dart gradle log env',
  office: 'doc docx xls xlsx ppt pptx docm xlsm pptm odt ods odp rtf epub',
};
function dbFileKind(name, mime) {
  const ext = (String(name || '').split('.').pop() || '').toLowerCase();
  const m = String(mime || '').toLowerCase();
  for (const k of ['image', 'pdf', 'video', 'audio', 'office']) {
    if (DB_FILE_KINDS[k].split(' ').includes(ext)) return k;
  }
  if (DB_FILE_KINDS.code.split(' ').includes(ext)) return 'code';
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('text/')) return 'code';
  return 'other';
}
/* Mã video YouTube từ nhiều dạng liên kết: watch?v=, youtu.be/, shorts/, embed/, live/. */
function dbYoutubeId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
  return m ? m[1] : '';
}
/* Thân hộp thoại xem trước cho tệp đã có URL (đã ký) hoặc không xem trước được. */
function dbPreviewBody(kind, url, name, dlAct, path) {
  const dl = dbBtn('Tải xuống', dlAct, { path, name }, 'light');
  const cap = `<p class="muted">${h(name)}</p>`;
  if (kind === 'image') return `<div class="db-preview"><img src="${h(url)}" alt="${h(name)}">${cap}<div class="row">${dl}</div></div>`;
  if (kind === 'pdf') return `<div class="db-preview"><iframe class="db-preview-frame" src="${h(url)}" title="${h(name)}"></iframe>${cap}<div class="row">${dl}</div></div>`;
  if (kind === 'video') return `<div class="db-preview"><video class="db-preview-media" controls src="${h(url)}"></video>${cap}<p class="muted">Nếu trình duyệt không phát được định dạng này, hãy tải xuống và mở bằng phần mềm máy tính.</p><div class="row">${dl}</div></div>`;
  if (kind === 'audio') return `<div class="db-preview"><audio class="db-preview-media" controls src="${h(url)}"></audio>${cap}<div class="row">${dl}</div></div>`;
  if (kind === 'code') return `<div class="db-preview"><pre class="db-preview-code" id="db-preview-code">Đang tải nội dung tệp…</pre>${cap}<div class="row">${dl}</div></div>`;
  return `<div class="db-preview"><div class="db-link-card">${ic('overview', 18)}<div><b>Không xem trước được tệp này</b><div class="muted">Định dạng Word / Excel / PowerPoint và một số tệp khác không xem trực tiếp được trong trình duyệt. Bấm “Tải xuống” rồi mở bằng phần mềm máy tính.</div></div></div><div class="row">${dl}</div></div>`;
}
function dbPreviewFillCode(url) {
  fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))).then((t) => {
    const box = document.getElementById('db-preview-code');
    if (box) box.textContent = t.length > 200000 ? t.slice(0, 200000) + '\n\n… (chỉ hiển thị phần đầu)' : t;
  }).catch(() => {
    const box = document.getElementById('db-preview-code');
    if (box) box.textContent = 'Không đọc được nội dung tệp này — hãy tải xuống để xem.';
  });
}

/* Tài liệu đính kèm bài học: tệp giáo viên tải lên, liên kết (YouTube/Canva/web) giáo viên thêm;
   cả hai vai trò đều xem trước / tải xuống / mở được. */
function dbLessonResources(l, resources) {
  const items = (resources || []).map((r) => {
    const isLink = r.kind === 'LINK';
    const yt = isLink ? dbYoutubeId(r.url) : '';
    const meta = isLink ? (yt ? 'YouTube' : 'Liên kết') : (r.file_size_bytes == null ? '' : dbFileSize(r.file_size_bytes));
    return `<li class="db-file">
    <span class="db-file-name">${ic(isLink && yt ? 'play' : 'overview', 14)}<span class="db-file-title">${h(r.file_name)}</span>${isLink ? `<span class="muted db-file-url">${h(String(r.url || '').replace(/^https?:\/\//, '').slice(0, 60))}</span>` : ''}</span>
    <span class="muted db-file-meta">${meta}</span>
    <span class="row db-file-actions">${dbBtn('Xem trước', 'previewResource', { kind: isLink ? 'LINK' : 'FILE', path: r.storage_path || '', url: r.url || '', name: r.file_name, mime: r.mime_type || '' }, 'light mini')}${isLink
      ? dbBtn('Mở', 'openResourceLink', { url: r.url }, 'light mini')
      : dbBtn('Tải xuống', 'downloadResource', { path: r.storage_path, name: r.file_name }, 'light mini')}${dbIsTeacher() ? dbBtn('Xóa', 'deleteResource', { id: r.id, name: r.file_name }, 'light mini danger-soft') : ''}</span>
  </li>`;
  }).join('');
  return `<div class="db-files"><span class="db-label">Tài liệu${dbIsTeacher() ? '' : ' của bài học'}</span>
    ${items ? `<ul class="db-filelist">${items}</ul>` : '<p class="muted">Chưa có tài liệu nào.</p>'}
    ${dbIsTeacher() ? `<form data-act="uploadResource" data-lesson="${h(l.id)}" class="db-form-row db-add-row" novalidate>
      <input type="file" id="db-rf-${h(l.id)}" name="file" class="db-input-file" aria-label="Chọn tệp tài liệu cho bài học ${h(l.title)}">
      <button type="submit" class="btn light">Tải tài liệu lên</button><span class="muted">Mọi định dạng (doc, xlsx, pptx, tệp code, video, âm thanh…), tối đa 50 MB.</span>${dbFormError()}
    </form>
    <form data-act="addResourceLink" data-lesson="${h(l.id)}" class="db-form-row db-add-row" novalidate>
      ${dbField('Thêm liên kết (YouTube, Canva, trang web…)', 'db-rl-' + h(l.id), `<input id="db-rl-${h(l.id)}" name="url" type="url" placeholder="https://…" required>`)}
      ${dbField('Tên hiển thị', 'db-rlt-' + h(l.id), `<input id="db-rlt-${h(l.id)}" name="title" maxlength="200" placeholder="Để trống = tự đặt tên">`)}
      <button type="submit" class="btn light">Thêm liên kết</button>${dbFormError()}
    </form>` : ''}
  </div>`;
}
/* Thùng rác của lớp (chỉ giáo viên): mục đã xóa mềm, bấm Khôi phục để đưa trở lại. */
function dbTrashPanel(d) {
  const list = d.trash || [];
  const rows = list.map((x) => `<tr>
    <th scope="row">${h(String(x.title || '').slice(0, 90))}</th>
    <td>${x.label}</td>
    <td>${dbDateTime(x.deleted_at)}</td>
    <td class="db-cell-actions">${dbBtn('Khôi phục', 'restoreItem', { id: x.id }, 'mini')}</td>
  </tr>`);
  return `
  <section class="panel" aria-labelledby="db-h-trash">
    <h2 id="db-h-trash">Thùng rác</h2>
    <p class="lead">Mục đã xóa vẫn được giữ trong cơ sở dữ liệu. Bấm “Khôi phục” để đưa trở lại. Lớp đã lưu trữ được khôi phục ở trang “Lớp học phụ trách”.</p>
    ${rows.length ? dbTable(['Mục', 'Loại', 'Đã xóa lúc', '<span class="sr">Thao tác</span>'], rows, 'Mục đã xóa') : dbEmpty('Thùng rác trống.')}
  </section>`;
}

/* Mã gợi ý cho mục tiêu tiếp theo của bài học: MT1, MT2, … (mã không trùng trong cùng một bài học). */
function dbNextObjectiveCode(objectives) {
  const used = new Set(objectives.map((o) => o.code));
  let n = objectives.length + 1;
  while (used.has('MT' + n)) n++;
  return 'MT' + n;
}
const dbNextOrder = (list) => list.reduce((m, x) => Math.max(m, x.display_order || 0), 0) + 1;

DB_ACT.openContentRoot = () => { DB.arg = {}; render(); };
DB_ACT.openContentTopic = (el) => { DB.arg = { topicId: el.dataset.id }; render(); };
DB_ACT.openContentLesson = (el) => { DB.arg = { topicId: el.dataset.topicId, lessonId: el.dataset.id }; render(); };
DB_ACT.selectContentTab = (el) => { DB.arg = { ...DB.arg, tab: el.dataset.tab }; render(); };

DB_ACT.createTopic = (form) => dbRun(form, async (v) => {
  if (!v.title) throw new Error('Nhập tên chủ đề.');
  const course = await dbEnsureCourse();
  await dbCall(EducMindDB.createTopic({ course_id: course.id, title: v.title, display_order: dbNextOrder(DB.data.topics || []) }));
}, 'Đã thêm chủ đề (bản nháp).');
DB_ACT.toggleTopic = (el) => dbRun(el, async () => {
  const t = DB.data.topics.find((x) => x.id === el.dataset.id);
  await dbCall(EducMindDB.updateTopic(t.id, { status: t.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }));
  toast(t.status === 'PUBLISHED' ? 'Đã gỡ xuất bản chủ đề.' : 'Đã xuất bản chủ đề.');
});
/* Bật/tắt mở bài học tuần tự cho khóa học của lớp đang chọn. */
DB_ACT.toggleSequential = (el) => dbRun(el, async () => {
  const course = await dbEnsureCourse();
  await dbCall(EducMindDB.updateCourse(course.id, { sequential_unlock: el.checked }));
  DB.course.sequential_unlock = el.checked;
  toast(el.checked ? 'Đã bật mở bài học tuần tự.' : 'Đã tắt mở bài học tuần tự.');
});
DB_ACT.editTopic = (el) => {
  const t = DB.data.topics.find((x) => x.id === el.dataset.id);
  dbOpenDialog({
    title: 'Sửa chủ đề', okLabel: 'Lưu thay đổi',
    body: dbField('Tên chủ đề', 'db-et-title', `<input id="db-et-title" name="title" maxlength="200" value="${h(t.title)}" required>`)
      + dbField('Mô tả', 'db-et-desc', `<textarea id="db-et-desc" name="description" rows="3" maxlength="1000">${h(t.description)}</textarea>`),
    onOk: async (v) => {
      if (!v.title) throw new Error('Nhập tên chủ đề.');
      await dbCall(EducMindDB.updateTopic(t.id, { title: v.title, description: v.description || '' }));
      toast('Đã lưu chủ đề.');
    },
  });
};
DB_ACT.deleteTopic = (el) => {
  const t = DB.data.topics.find((x) => x.id === el.dataset.id);
  if (DB.data.lessons.some((l) => l.topic_id === t.id)) return toast('Hãy xóa hoặc chuyển các bài học trong chủ đề này trước.');
  dbConfirm('Xóa chủ đề?', `Chủ đề “${h(t.title)}” sẽ bị ẩn khỏi lớp.`, 'Xóa chủ đề', async () => {
    await dbCall(EducMindDB.updateTopic(t.id, { deleted_at: new Date().toISOString() }));
    if (DB.arg.topicId === t.id) DB.arg = {};
    toast('Đã xóa chủ đề.');
  }, true);
};
DB_ACT.createLesson = (form) => dbRun(form, async (v) => {
  if (!v.title) throw new Error('Nhập tên bài học.');
  const course = await dbEnsureCourse(), topicId = form.dataset.topic;
  await dbCall(EducMindDB.createLesson({ course_id: course.id, topic_id: topicId, title: v.title, display_order: dbNextOrder(DB.data.lessons.filter((l) => l.topic_id === topicId)) }));
}, 'Đã thêm bài học (bản nháp).');
DB_ACT.toggleLesson = (el) => dbRun(el, async () => {
  const l = DB.data.lessons.find((x) => x.id === el.dataset.id);
  const topic = DB.data.topics.find((t) => t.id === l.topic_id);
  await dbCall(EducMindDB.updateLesson(l.id, { status: l.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }));
  toast(l.status === 'PUBLISHED' ? 'Đã gỡ xuất bản bài học.' : topic && topic.status !== 'PUBLISHED' ? 'Đã xuất bản bài học. Học sinh sẽ thấy bài khi chủ đề cũng được xuất bản.' : 'Đã xuất bản bài học.');
});
DB_ACT.editLesson = (el) => {
  const l = DB.data.lessons.find((x) => x.id === el.dataset.id);
  dbOpenDialog({
    title: 'Sửa bài học', okLabel: 'Lưu thay đổi',
    body: dbField('Tên bài học', 'db-el-title', `<input id="db-el-title" name="title" maxlength="200" value="${h(l.title)}" required>`)
      + dbField('Mô tả', 'db-el-desc', `<textarea id="db-el-desc" name="description" rows="3" maxlength="2000">${h(l.description)}</textarea>`)
      + dbField('Chủ đề', 'db-el-topic', `<select id="db-el-topic" name="topic_id">${DB.data.topics.map((t) => `<option value="${h(t.id)}" ${t.id === l.topic_id ? 'selected' : ''}>${h(t.title)}</option>`).join('')}</select>`),
    onOk: async (v) => {
      if (!v.title) throw new Error('Nhập tên bài học.');
      await dbCall(EducMindDB.updateLesson(l.id, { title: v.title, description: v.description || '', topic_id: v.topic_id }));
      toast('Đã lưu bài học.');
    },
  });
};
DB_ACT.deleteLesson = (el) => {
  const l = DB.data.lessons.find((x) => x.id === el.dataset.id);
  dbConfirm('Xóa bài học?', `Bài học “${h(l.title)}” sẽ bị ẩn khỏi lớp. Bài tập, bài kiểm tra và kết quả học tập đã có vẫn được giữ.`, 'Xóa bài học', async () => {
    await dbCall(EducMindDB.updateLesson(l.id, { deleted_at: new Date().toISOString() }));
    if (DB.arg.lessonId === l.id) DB.arg = { topicId: l.topic_id };
    toast('Đã xóa bài học.');
  }, true);
};
function dbReadObjective(v) {
  if (!v.code) throw new Error('Nhập mã mục tiêu (ví dụ MT1).');
  if (!v.description) throw new Error('Nhập nội dung mục tiêu.');
  return { code: v.code, description: v.description };
}
DB_ACT.createObjective = (form) => dbRun(form, async (v) => {
  const o = dbReadObjective(v), lessonId = form.dataset.lesson;
  if (DB.data.objectives.some((x) => x.lesson_id === lessonId && x.code === o.code)) throw new Error('Mã ' + o.code + ' đã có trong bài học này.');
  await dbCall(EducMindDB.createObjective({ lesson_id: lessonId, ...o }));
}, 'Đã thêm mục tiêu.');
DB_ACT.editObjective = (el) => {
  const o = DB.data.objectives.find((x) => x.id === el.dataset.id);
  dbOpenDialog({
    title: 'Sửa mục tiêu', okLabel: 'Lưu thay đổi',
    body: dbField('Mã', 'db-eo-code', `<input id="db-eo-code" name="code" maxlength="20" value="${h(o.code)}" required>`)
      + dbField('Nội dung mục tiêu', 'db-eo-desc', `<textarea id="db-eo-desc" name="description" rows="3" maxlength="500" required>${h(o.description)}</textarea>`),
    onOk: async (v) => {
      const x = dbReadObjective(v);
      if (DB.data.objectives.some((y) => y.lesson_id === o.lesson_id && y.id !== o.id && y.code === x.code)) throw new Error('Mã ' + x.code + ' đã có trong bài học này.');
      await dbCall(EducMindDB.updateObjective(o.id, x));
      toast('Đã lưu mục tiêu.');
    },
  });
};
DB_ACT.deleteObjective = (el) => {
  const o = DB.data.objectives.find((x) => x.id === el.dataset.id);
  dbConfirm('Xóa mục tiêu?', `“${dbObjLabel(o)}”. Mục tiêu đã gắn với bài tập, câu hỏi hoặc đã có kết quả học tập thì không xóa được.`, 'Xóa mục tiêu', async () => {
    const r = await dbCall(EducMindDB.deleteObjective(o.id));
    if (!r.length) throw new Error('Không xóa được mục tiêu này.');
    toast('Đã xóa mục tiêu.');
  }, true);
};

/* ===== Tài liệu ===== */
DB_ACT.uploadResource = (form) => dbRun(form, async () => {
  const input = form.querySelector('input[type="file"]');
  const file = input && input.files[0];
  if (!file) throw new Error('Chọn tệp tài liệu trước khi tải lên.');
  if (file.size > 50 * 1048576) throw new Error('Tệp tài liệu tối đa 50 MB.');
  const course = await dbEnsureCourse();
  const safe = dbSafeFileName(file.name);
  const path = DB.classId + '/' + Date.now() + '-' + safe;
  /* Thẻ tiến trình: hết byte → chuyển sang giai đoạn máy chủ lưu, ẩn khi xong/lỗi. */
  dbUploadShow(file.name);
  try {
    await dbCall(EducMindDB.uploadResourceFile(path, file, file.type || 'application/octet-stream', dbUploadProgress));
    dbUploadSaving();
    try {
      await dbCall(EducMindDB.createResource({ course_id: course.id, lesson_id: form.dataset.lesson, file_name: String(file.name).slice(0, 200), storage_path: path, file_size_bytes: file.size, mime_type: file.type || 'application/octet-stream', uploaded_by: sess.userId }));
    } catch (e) {
      try { await EducMindDB.removeResourceFile(path); } catch (_) {}
      throw e;
    }
  } finally {
    dbUploadHide();
  }
}, 'Đã tải tài liệu lên.');
DB_ACT.deleteResource = (el) => {
  const r = (DB.data.resources || []).find((x) => x.id === el.dataset.id);
  if (!r) return;
  dbConfirm('Xóa tài liệu?', `${r.kind === 'LINK' ? 'Liên kết' : 'Tệp'} “${h(r.file_name)}” sẽ bị xóa vĩnh viễn và không khôi phục được.`, 'Xóa tài liệu', async () => {
    if (r.storage_path) { try { await EducMindDB.removeResourceFile(r.storage_path); } catch (_) {} }
    await dbCall(EducMindDB.deleteResource(r.id));
    toast('Đã xóa tài liệu.');
  }, true);
};
DB_ACT.downloadResource = async (el) => {
  const { data, error } = await EducMindDB.resourceFileUrl(el.dataset.path, el.dataset.name);
  if (error) return toast('Không tạo được liên kết tải xuống: ' + (error.message || ''));
  window.open(data.signedUrl, '_blank');
};
DB_ACT.downloadSubmission = async (el) => {
  const { data, error } = await EducMindDB.submissionFileUrl(el.dataset.path, el.dataset.name);
  if (error) return toast('Không tạo được liên kết tải xuống: ' + (error.message || ''));
  window.open(data.signedUrl, '_blank');
};

/* ===== Xem trước & liên kết tài liệu ===== */
DB_ACT.openResourceLink = (el) => { window.open(String(el.dataset.url || ''), '_blank', 'noopener'); };
DB_ACT.previewResource = async (el) => {
  const d = el.dataset;
  if (d.kind === 'LINK') {
    const yt = dbYoutubeId(d.url);
    const open = dbBtn('Mở liên kết', 'openResourceLink', { url: d.url }, '');
    dbOpenDialog({
      title: d.name, wide: true,
      body: yt
        ? `<div class="db-preview"><iframe class="db-preview-frame db-preview-video" src="https://www.youtube.com/embed/${h(yt)}" title="${h(d.name)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="row">${open}</div></div>`
        : `<div class="db-preview"><div class="db-link-card">${ic('overview', 18)}<div><b>${h(d.name)}</b><div class="muted">${h(d.url)}</div></div></div><p class="muted">Trang này không cho phép nhúng trực tiếp — bấm “Mở liên kết” để mở trong thẻ mới.</p><div class="row">${open}</div></div>`,
    });
    return;
  }
  const { data, error } = await EducMindDB.resourceFileUrl(d.path);
  if (error || !data) return toast('Không tạo được liên kết xem tệp: ' + ((error && error.message) || ''));
  const kind = dbFileKind(d.name, d.mime);
  dbOpenDialog({ title: d.name, wide: true, body: dbPreviewBody(kind, data.signedUrl, d.name, 'downloadResource', d.path) });
  if (kind === 'code') dbPreviewFillCode(data.signedUrl);
};
DB_ACT.previewSubmission = async (el) => {
  const d = el.dataset;
  const { data, error } = await EducMindDB.submissionFileUrl(d.path);
  if (error || !data) return toast('Không tạo được liên kết xem tệp: ' + ((error && error.message) || ''));
  const kind = dbFileKind(d.name, '');
  dbOpenDialog({ title: d.name, wide: true, body: dbPreviewBody(kind, data.signedUrl, d.name, 'downloadSubmission', d.path) });
  if (kind === 'code') dbPreviewFillCode(data.signedUrl);
};
DB_ACT.addResourceLink = (form) => dbRun(form, async (v) => {
  const raw = String(v.url || '').trim();
  let u;
  try { u = new URL(raw); } catch (_) { throw new Error('Liên kết không hợp lệ. Hãy dán địa chỉ bắt đầu bằng http:// hoặc https://.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Chỉ chấp nhận liên kết http:// hoặc https://.');
  const yt = dbYoutubeId(raw);
  const title = String(v.title || '').trim() || (yt ? 'Video YouTube' : u.hostname.replace(/^www\./, ''));
  const course = await dbEnsureCourse();
  await dbCall(EducMindDB.createResource({
    course_id: course.id, lesson_id: form.dataset.lesson, kind: 'LINK', url: raw,
    file_name: title.slice(0, 200), storage_path: null, file_size_bytes: null,
    mime_type: yt ? 'text/x-youtube' : 'text/x-link', uploaded_by: sess.userId,
  }));
}, 'Đã thêm liên kết.');

/* ===== Thùng rác ===== */
DB_ACT.restoreItem = (el) => dbRun(el, async () => {
  const it = (DB.data.trash || []).find((x) => x.id === el.dataset.id);
  if (!it) throw new Error('Không tìm thấy mục cần khôi phục.');
  const fn = { topic: EducMindDB.restoreTopic, lesson: EducMindDB.restoreLesson, assignment: EducMindDB.restoreAssignment, question: EducMindDB.restoreQuestion }[it.type];
  await dbCall(fn(it.id));
  if (it.type === 'lesson' && (DB.data.trash || []).some((x) => x.type === 'topic' && x.id === it.topic_id)) {
    await dbReload();
    toast('Đã khôi phục bài học. Chủ đề của bài học cũng đang bị xóa — hãy khôi phục cả chủ đề để học sinh thấy được.');
    return false;
  }
}, 'Đã khôi phục mục này.');

/* ===== Học sinh: Bài học ===== */
DB_PAGES.lessons = {
  title: 'Bài học',
  sub: 'Các bài học giáo viên đã xuất bản, kèm mức nắm vững của em ở từng mục tiêu.',
  async load() {
    const content = await dbLoadContent();
    const [mastery, courses] = await Promise.all([
      dbCallIn(EducMindDB.listMastery, content.objectives.map((o) => o.id)),
      DB.classId ? dbCall(EducMindDB.listCourses(DB.classId)) : [],
    ]);
    return { ...content, mastery: Object.fromEntries(mastery.map((m) => [m.objective_id, m])), seq: !!(courses[0] && courses[0].sequential_unlock) };
  },
  view(d) {
    if (!d.topics.length) return `<section class="panel">${dbEmpty('Giáo viên chưa xuất bản bài học nào cho lớp này.')}</section>`;
    const lessonsBy = dbGroup(d.lessons, 'topic_id'), objBy = dbGroup(d.objectives, 'lesson_id');
    const resBy = dbGroup(d.resources || [], 'lesson_id');
    /* Mở tuần tự: bài học bị khóa cho tới khi mọi mục tiêu của bài liền trước đạt ≥ 0,8.
       Bài không có mục tiêu thì không chặn bài sau. Thứ tự: theo chủ đề rồi theo bài học (display_order). */
    const locked = {};
    if (d.seq) {
      const flat = d.topics.flatMap((t) => lessonsBy[t.id] || []);
      let prevOk = true;
      for (const l of flat) {
        locked[l.id] = !prevOk;
        const objs = objBy[l.id] || [];
        prevOk = objs.length === 0 || objs.every((o) => Number(((d.mastery[o.id] || {}).mastery_score) || 0) >= 0.8);
      }
    }
    return d.topics.map((t, i) => {
      const lessons = lessonsBy[t.id] || [];
      return `<details class="topic-folder">
        <summary><span class="topic-mark">${String(i + 1).padStart(2, '0')}</span><span class="topic-title">${h(t.title)}</span><span class="pill plain">${lessons.length} bài học</span></summary>
        <div class="topic-lessons">${t.description ? `<p class="muted">${h(t.description)}</p>` : ''}
          ${lessons.map((l) => `<details class="scope-lesson">
            <summary><span><b>${h(l.title)}</b> ${locked[l.id] ? dbPill('Đang khóa', 'need') : ''}</span>${ic(locked[l.id] ? 'lock' : 'arrow', 16)}</summary>
            ${locked[l.id]
              ? `<div class="db-lock-note">${ic('lock', 16)} Bài học đang khóa — hãy nắm vững (≥ 0,8) mọi mục tiêu của bài trước để mở bài này.</div>`
              : `<div class="db-lesson" id="db-l-${h(l.id)}">
                  ${l.description ? `<p class="muted">${h(l.description)}</p>` : ''}
                  ${(objBy[l.id] || []).length ? `<ul class="db-objectives">${objBy[l.id].map((o) => `<li><span class="db-obj-code">${h(o.code)}</span><span class="db-obj-text">${h(o.description)}</span><span>${dbMasteryPill(d.mastery[o.id] ? d.mastery[o.id].mastery_score : null)}</span></li>`).join('')}</ul>` : `<p class="muted">Chưa có mục tiêu cho bài học này.</p>`}
                  ${dbLessonResources(l, resBy[l.id] || [])}
                </div>`}
          </details>`).join('') || `<div class="folder-empty">Chủ đề chưa có bài học được xuất bản.</div>`}
        </div>
      </details>`;
    }).join('');
  },
};
