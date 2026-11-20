/* EducMind · js/db/03-classes.js
   Trang Lớp học: giáo viên tạo / sửa / xóa lớp, xem mã lớp, thêm và gỡ học sinh; học sinh vào lớp bằng mã. */

DB_PAGES.classes = {
  noClass: true,
  title: () => (dbIsTeacher() ? 'Lớp học phụ trách' : 'Lớp của em'),
  sub: () => (dbIsTeacher() ? 'Mỗi lớp có một mã lớp. Học sinh dùng mã này để tự vào lớp.' : 'Vào lớp bằng mã do giáo viên cung cấp.'),
  async load() {
    await dbLoadClasses();
    if (DB.classId && (!DB.course || DB.course.class_id !== DB.classId)) await dbLoadCourse();
    const ids = DB.classes.map((c) => c.id);
    const [members, courses] = await Promise.all([dbCallIn(EducMindDB.listMembers, ids), dbCall(EducMindDB.listCoursesForClasses(ids))]);
    const coursesByClass = Object.fromEntries(courses.map((course) => [course.class_id, course]));
    if (dbIsTeacher()) {
      const [invites, profiles, archived] = await Promise.all([dbCallIn(EducMindDB.listInvites, ids), dbCallIn(EducMindDB.listProfiles, members.map((m) => m.student_id)), dbCall(EducMindDB.listArchivedClasses())]);
      return { members, invites, profiles: dbById(profiles), courses: coursesByClass, archived };
    }
    const teachers = await dbCallIn(EducMindDB.listProfiles, DB.classes.map((c) => c.owner_teacher_id));
    return { members, profiles: dbById(teachers), courses: coursesByClass };
  },
  view(d) { return dbIsTeacher() ? dbClassesTeacher(d) : dbClassesStudent(d); },
};

const dbClassMeta = (c) => [c.grade ? 'Khối ' + h(c.grade) : '', h(c.school_year || '')].filter(Boolean).join(' · ');
/* Mã lớp đang dùng: mã mới nhất chưa bị thu hồi và chưa hết hạn. */
function dbActiveCode(invites, classId) {
  const now = dbNow();
  const inv = (invites || []).find((i) => i.class_id === classId && !i.revoked_at && (!i.expires_at || new Date(i.expires_at).getTime() > now));
  return inv ? inv.code : '';
}

function dbClassesTeacher(d) {
  const byClass = dbGroup(d.members, 'class_id');
  const cards = DB.classes.map((c) => {
    const n = (byClass[c.id] || []).length, code = dbActiveCode(d.invites, c.id);
    const subject = (d.courses || {})[c.id]?.title || '';
    return `<div class="classcard${c.id === DB.classId ? ' selected' : ''}">
      <div class="classcard-top">
        <button type="button" class="classcard-name" data-act="selectClass" data-id="${h(c.id)}" ${c.id === DB.classId ? 'aria-current="true"' : ''}><b>${h(c.name)}</b></button>
        <div class="classcard-actions">${dbBtn('Sửa', 'editClass', { id: c.id }, 'light mini')}${dbBtn('Xóa', 'archiveClass', { id: c.id }, 'light mini danger-soft')}</div>
      </div>
      <div class="meta">Môn học: <b>${h(subject || 'Chưa thiết lập')}</b></div>
      <div class="meta">${dbClassMeta(c) || 'Chưa ghi khối / năm học'}</div>
      <div class="meta"><b>${n}</b> học sinh · Mã lớp <b class="db-code">${h(code || '—')}</b></div>
    </div>`;
  }).join('');
  const cur = dbClass();
  return `
  <section class="panel" aria-labelledby="db-h-classes">
    <h2 id="db-h-classes">Danh sách lớp</h2>
    <p class="lead">${DB.classes.length ? DB.classes.length + ' lớp · bấm vào tên lớp để chọn lớp làm việc.' : 'Chưa có lớp nào. Hãy tạo lớp đầu tiên ở khung bên dưới.'}</p>
    ${cards ? `<div class="grid db-class-grid">${cards}</div>` : ''}
  </section>
  <section class="panel" aria-labelledby="db-h-newclass">
    <h2 id="db-h-newclass">Tạo lớp mới</h2>
    <form data-act="createClass" class="db-form-row" novalidate>
      ${dbField('Tên lớp', 'db-class-name', `<input id="db-class-name" name="name" maxlength="100" placeholder="Ví dụ: 10A1" required>`)}
      ${dbField('Môn học', 'db-class-subject', `<input id="db-class-subject" name="subject" maxlength="120" placeholder="Ví dụ: Toán, Ngữ văn, Vật lí" required>`)}
      ${dbField('Khối', 'db-class-grade', `<input id="db-class-grade" name="grade" type="number" min="${EDUCMIND_GRADE_MIN}" max="${EDUCMIND_GRADE_MAX}" inputmode="numeric" placeholder="${EDUCMIND_GRADE_RANGE_LABEL}">`)}
      ${dbField('Năm học', 'db-class-year', `<input id="db-class-year" name="year" maxlength="20" placeholder="2026-2027">`)}
      <button type="submit" class="btn">Tạo lớp</button>
      ${dbFormError()}
    </form>
  </section>
  ${cur ? dbClassMembersPanel(cur, d) : ''}${dbArchivedClassesPanel(d)}`;
}

/* Lớp đã lưu trữ (deleted_at khác rỗng): chỉ giáo viên thấy, bấm “Mở lại” để khôi phục. */
function dbArchivedClassesPanel(d) {
  const list = d.archived || [];
  if (!list.length) return '';
  const rows = list.map((c) => `<tr><th scope="row">${h(c.name)}</th><td>${dbClassMeta(c) || '—'}</td><td>${dbDateTime(c.deleted_at)}</td><td class="db-cell-actions">${dbBtn('Mở lại', 'restoreClass', { id: c.id }, 'mini')}</td></tr>`);
  return `
  <section class="panel" aria-labelledby="db-h-archived">
    <h2 id="db-h-archived">Lớp đã lưu trữ</h2>
    <p class="lead">Lớp đã xóa vẫn được giữ trong cơ sở dữ liệu. Bấm “Mở lại” để lớp xuất hiện trở lại với giáo viên và học sinh.</p>
    ${dbTable(['Lớp', 'Khối · năm học', 'Đã lưu trữ lúc', '<span class="sr">Thao tác</span>'], rows, 'Lớp đã lưu trữ')}
  </section>`;
}

function dbClassMembersPanel(c, d) {
  const code = dbActiveCode(d.invites, c.id);
  const list = (d.members || []).filter((m) => m.class_id === c.id);
  const rows = list.map((m) => {
    const p = d.profiles[m.student_id];
    return `<tr><th scope="row">${h(dbName(p))}</th><td>${h(p ? p.email : '')}</td><td>${dbDateTime(m.joined_at)}</td><td class="db-cell-actions">${dbBtn('Gỡ khỏi lớp', 'removeMember', { id: m.student_id }, 'light mini danger-soft')}</td></tr>`;
  });
  return `
  <section class="panel" aria-labelledby="db-h-members">
    <div class="row between">
      <div><h2 id="db-h-members">Học sinh lớp ${h(c.name)}</h2><p class="lead">${list.length} học sinh</p></div>
      <div class="db-codebox"><span class="muted">Mã lớp</span><b class="db-code" id="db-join-code">${h(code || '—')}</b>${code ? dbBtn('Sao chép', 'copyCode', { code }, 'light mini') : ''}${dbBtn('Tạo mã mới', 'regenCode', { id: c.id }, 'light mini')}</div>
    </div>
    <form data-act="addStudent" class="db-form-row db-class-member-add" novalidate>
      ${dbField('Thêm học sinh bằng email', 'db-add-email', `<input id="db-add-email" name="email" type="email" placeholder="email học sinh đã đăng ký" autocomplete="off" required>`)}
      <button type="submit" class="btn light">Thêm vào lớp</button>
      ${dbBtn('Tạo tài khoản học sinh', 'createStudentAccount', { id: c.id, name: c.name }, 'light')}
      ${dbFormError()}
    </form>
    <div class="db-class-import">
      <div><b>Thêm học sinh bằng file Excel</b><p class="muted">Dùng đúng các cột STT, Họ và tên, Email. Học sinh cần có tài khoản đăng ký bằng email trong tệp; tên hiển thị trong lớp lấy từ tài khoản.</p></div>
      <div class="row">
        ${dbBtn('Tải file mẫu Excel', 'downloadClassStudentsTemplate', {}, 'light')}
        ${dbBtn('Chọn file Excel', 'pickClassStudentsFile', {}, 'light')}
        <input id="db-class-students-file" class="sr" type="file" accept=".xlsx,.xls,.csv" data-change="importClassStudents" aria-label="Chọn file danh sách học sinh">
      </div>
      <div id="db-class-import-status" class="muted" role="status" aria-live="polite"></div>
    </div>
    ${rows.length ? dbTable(['Họ và tên', 'Email', 'Vào lớp lúc', '<span class="sr">Thao tác</span>'], rows, 'Học sinh của lớp') : dbEmpty('Lớp chưa có học sinh. Gửi mã lớp cho học sinh, thêm bằng email hoặc tạo tài khoản cho các em.')}
  </section>`;
}

function dbClassesStudent(d) {
  const joined = Object.fromEntries((d.members || []).map((m) => [m.class_id, m.joined_at]));
  const cards = DB.classes.map((c) => `<div class="classcard${c.id === DB.classId ? ' selected' : ''}">
      <div class="classcard-top"><button type="button" class="classcard-name" data-act="selectClass" data-id="${h(c.id)}" ${c.id === DB.classId ? 'aria-current="true"' : ''}><b>${h(c.name)}</b></button></div>
      <div class="meta">${dbClassMeta(c)}</div>
      <div class="meta">Môn học: <b>${h(((d.courses || {})[c.id] || {}).title || 'Chưa thiết lập')}</b></div>
      <div class="meta">Giáo viên: <b>${h(dbName(d.profiles[c.owner_teacher_id]))}</b></div>
      ${joined[c.id] ? `<div class="meta">Vào lớp lúc ${dbDateTime(joined[c.id])}</div>` : ''}
    </div>`).join('');
  return `
  <section class="panel" aria-labelledby="db-h-join">
    <h2 id="db-h-join">Vào lớp bằng mã</h2>
    <form data-act="joinClass" class="db-form-row" novalidate>
      ${dbField('Mã lớp', 'db-join-code-input', `<input id="db-join-code-input" name="code" maxlength="12" placeholder="Ví dụ: 3FA9C2D1" autocomplete="off" autocapitalize="characters" required>`)}
      <button type="submit" class="btn">Vào lớp</button>
      ${dbFormError()}
    </form>
  </section>
  <section class="panel" aria-labelledby="db-h-classes">
    <h2 id="db-h-classes">Lớp đang học</h2>
    ${cards ? `<p class="lead">Bấm vào tên lớp để chọn lớp đang xem.</p><div class="grid db-class-grid">${cards}</div>` : dbEmpty('Em chưa vào lớp nào.')}
  </section>`;
}

/* ===== Thao tác ===== */
DB_ACT.selectClass = (el) => dbSetClass(el.dataset.id, 'classes');
DB_ACT.copyCode = async (el) => {
  try { await navigator.clipboard.writeText(el.dataset.code); toast('Đã sao chép mã lớp ' + el.dataset.code + '.'); }
  catch (_) { toast('Không sao chép tự động được. Mã lớp: ' + el.dataset.code); }
};
DB_ACT.regenCode = (el) => {
  const c = DB.classes.find((x) => x.id === el.dataset.id);
  if (!c) return;
  dbConfirm('Tạo mã lớp mới cho ' + h(c.name) + '?', 'Mã lớp hiện tại sẽ ngừng dùng ngay: học sinh chưa vào lớp sẽ cần mã mới. Học sinh đã vào lớp không bị ảnh hưởng.', 'Tạo mã mới', async () => {
    const code = await dbCall(EducMindDB.regenClassCode(c.id));
    toast('Mã lớp mới: ' + code + '. Mã cũ không dùng được nữa.');
  });
};
DB_ACT.restoreClass = (el) => dbRun(el, async () => {
  const c = (DB.data.archived || []).find((x) => x.id === el.dataset.id);
  if (!c) throw new Error('Không tìm thấy lớp cần mở lại.');
  await dbCall(EducMindDB.restoreClass(c.id));
}, 'Đã mở lại lớp.');
function dbReadClassForm(v) {
  const name = (v.name || '').trim();
  if (!name) throw new Error('Nhập tên lớp.');
  if (name.length > 100) throw new Error('Tên lớp tối đa 100 ký tự.');
  const subject = (v.subject || '').trim();
  if (!subject) throw new Error('Nhập tên môn học.');
  if (subject.length > 120) throw new Error('Tên môn học tối đa 120 ký tự.');
  let grade = null;
  if (v.grade !== '' && v.grade != null) {
    grade = Number(v.grade);
    if (!educmindGradeIsValid(grade)) throw new Error(`Khối là số nguyên từ ${EDUCMIND_GRADE_MIN} đến ${EDUCMIND_GRADE_MAX} (có thể để trống).`);
  }
  return { name, subject, grade, year: (v.year || '').trim() || null };
}
DB_ACT.createClass = (form) => dbRun(form, async (v) => {
  const c = dbReadClassForm(v);
  const grade = dbResolveClassGrade(c.name, c.grade);
  const made = await dbCall(EducMindDB.createClassWithSubject(c.name, grade, c.year, c.subject));
  const row = Array.isArray(made) ? made[0] : made;
  DB.classId = row.class_id;
  try { localStorage.setItem('educmind.db.class', DB.classId); } catch (_) {}
  DB.course = null;
  toast('Đã tạo lớp ' + c.name + '. Mã lớp: ' + row.join_code);
});
DB_ACT.editClass = async (el) => {
  const c = DB.classes.find((x) => x.id === el.dataset.id);
  if (!c) return;
  const course = (DB.data.courses || {})[c.id] || null;
  dbOpenDialog({
    title: 'Sửa lớp ' + h(c.name), okLabel: 'Lưu thay đổi',
    body: dbField('Tên lớp', 'db-ec-name', `<input id="db-ec-name" name="name" maxlength="100" value="${h(c.name)}" required>`)
      + dbField('Môn học', 'db-ec-subject', `<input id="db-ec-subject" name="subject" maxlength="120" value="${h(course ? course.title : '')}" required>`)
      + dbField('Khối', 'db-ec-grade', `<input id="db-ec-grade" name="grade" type="number" min="${EDUCMIND_GRADE_MIN}" max="${EDUCMIND_GRADE_MAX}" value="${h(c.grade == null ? '' : c.grade)}">`)
      + dbField('Năm học', 'db-ec-year', `<input id="db-ec-year" name="year" maxlength="20" value="${h(c.school_year || '')}">`),
    onOk: async (v) => {
      const x = dbReadClassForm(v);
      await dbCall(EducMindDB.updateClassWithSubject(c.id, { name: x.name, grade: x.grade, school_year: x.year, subject: x.subject }));
      toast('Đã lưu thông tin lớp.');
    },
  });
};
DB_ACT.archiveClass = (el) => {
  const c = DB.classes.find((x) => x.id === el.dataset.id);
  if (!c) return;
  dbConfirm('Xóa lớp ' + h(c.name) + '?', 'Lớp sẽ biến mất khỏi danh sách của giáo viên và học sinh. Dữ liệu (bài học, bài nộp, điểm) vẫn được giữ trong cơ sở dữ liệu nhưng không mở lại được từ giao diện.', 'Xóa lớp', async () => {
    const r = await dbCall(EducMindDB.archiveClass(c.id));
    if (!r.length) throw new Error('Không xóa được lớp này.');
    if (DB.classId === c.id) { DB.classId = ''; DB.course = null; }
    toast('Đã xóa lớp ' + c.name + '.');
  }, true);
};
DB_ACT.addStudent = (form) => dbRun(form, async (v) => {
  const email = (v.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Nhập đúng địa chỉ email của học sinh.');
  const r = await dbCall(EducMindDB.addStudentByEmail(DB.classId, email));
  if (r === 'ADDED') return void toast('Đã thêm ' + email + ' vào lớp.');
  throw new Error({
    ALREADY_MEMBER: 'Học sinh này đã ở trong lớp.',
    NOT_FOUND: 'Chưa có tài khoản nào dùng email này. Học sinh cần đăng ký tài khoản trước, hoặc tự vào lớp bằng mã lớp.',
    NOT_A_STUDENT: 'Email này thuộc tài khoản giáo viên nên không thêm vào lớp như học sinh được.',
  }[r] || 'Không thêm được học sinh (' + r + ').');
});
DB_ACT.downloadClassStudentsTemplate = () => {
  DBTF.exportExcel('Mau_them_hoc_sinh_vao_lop.xlsx', [{
    name: 'Danh sách học sinh',
    headers: ['STT', 'Họ và tên', 'Email'],
    rows: [],
    widths: [8, 32, 38],
    notes: ['Nhập mỗi học sinh trên một dòng. Email phải thuộc tài khoản học sinh đã đăng ký.'],
  }], { title: 'Danh sách học sinh thêm vào lớp' });
  toast('Đã tải file mẫu Excel.');
};
DB_ACT.pickClassStudentsFile = () => document.getElementById('db-class-students-file')?.click();
DB_ACT.importClassStudents = async (el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  const classId = DB.classId;
  if (!dbIsTeacher() || !DB.classes.some((c) => c.id === classId)) throw new Error('Không tìm thấy lớp đang chọn.');
  const status = document.getElementById('db-class-import-status');
  if (status) status.textContent = 'Đang đọc và thêm học sinh…';
  el.disabled = true;
  try {
    const rows = await readRows(file);
    const headerIndex = rows.findIndex((row) => row.some((cell) => nz(cell) === 'email') && row.some((cell) => nz(cell) === 'stt'));
    if (headerIndex < 0) throw new Error('Không tìm thấy tiêu đề STT và Email. Hãy dùng file mẫu Excel.');
    const headers = rows[headerIndex].map(nz);
    const nameIndex = headers.findIndex((header) => header === 'ho va ten' || header === 'ho ten');
    const emailIndex = headers.indexOf('email');
    const numberIndex = headers.indexOf('stt');
    if (numberIndex < 0 || nameIndex < 0 || emailIndex < 0) throw new Error('Tệp cần có đủ các cột STT, Họ và tên, Email.');
    const report = { added: [], notFound: [], alreadyMember: [], notStudent: [], skipped: [], failed: [] };
    const seen = new Set(), candidates = [];
    rows.slice(headerIndex + 1).forEach((row, index) => {
      if (!row.some((cell) => String(cell == null ? '' : cell).trim())) return;
      const line = headerIndex + index + 2;
      const name = String(row[nameIndex] == null ? '' : row[nameIndex]).trim();
      const email = String(row[emailIndex] == null ? '' : row[emailIndex]).trim().toLowerCase();
      const number = String(row[numberIndex] == null ? '' : row[numberIndex]).trim() || String(line - headerIndex - 1);
      const student = { number, name, email };
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        report.skipped.push({ ...student, reason: !name ? 'Thiếu họ và tên.' : 'Email không hợp lệ.' });
        return;
      }
      if (seen.has(email)) {
        report.skipped.push({ ...student, reason: 'Email bị lặp trong tệp.' });
        return;
      }
      seen.add(email);
      student.line = line;
      candidates.push(student);
    });
    if (!candidates.length && !report.skipped.length) throw new Error('Không có dòng dữ liệu học sinh trong tệp.');
    for (const student of candidates) {
      try {
        const result = await dbCall(EducMindDB.addStudentByEmail(classId, student.email));
        if (result === 'ADDED') report.added.push(student);
        else if (result === 'NOT_FOUND') report.notFound.push(student);
        else if (result === 'ALREADY_MEMBER') report.alreadyMember.push(student);
        else if (result === 'NOT_A_STUDENT') report.notStudent.push(student);
        else report.failed.push({ ...student, reason: 'Máy chủ trả về kết quả không xác định (' + String(result) + ').' });
      } catch (error) {
        dbLogError(error);
        report.failed.push({ ...student, reason: dbErrText(error) });
      }
    }
    const list = (items) => items.length
      ? `<ul>${items.map((student) => `<li>Dòng ${h(student.line || student.number)} · ${h(student.name)} · ${h(student.email)}${student.reason ? ' — ' + h(student.reason) : ''}</li>`).join('')}</ul>`
      : '';
    const section = (title, items) => items.length ? `<p><b>${title} (${items.length})</b></p>${list(items)}` : '';
    const body = `<p>Đã kiểm tra ${candidates.length + report.skipped.length} dòng học sinh trong tệp <b>${h(file.name)}</b>.</p>
      ${section('Đã thêm vào lớp', report.added)}
      ${section('Chưa thể thêm vì email chưa có tài khoản học sinh', report.notFound)}
      ${section('Đã ở trong lớp', report.alreadyMember)}
      ${section('Email thuộc tài khoản không phải học sinh', report.notStudent)}
      ${section('Dòng bị bỏ qua', report.skipped)}
      ${section('Lỗi khi thêm', report.failed)}
      ${report.notFound.length ? '<p class="muted">Các em trong danh sách chưa có tài khoản với email tương ứng nên không được thêm vào lớp. Hãy yêu cầu các em đăng ký rồi tải lại tệp để thêm.</p>' : ''}`;
    el.value = '';
    if (status) status.textContent = '';
    dbOpenDialog({ title: 'Kết quả thêm học sinh', wide: true, body });
    await dbReload();
  } finally {
    el.disabled = false;
    if (el.isConnected) el.value = '';
    const currentStatus = document.getElementById('db-class-import-status');
    if (currentStatus) currentStatus.textContent = '';
  }
};
/* Giáo viên tạo tài khoản học sinh: email + họ tên + mật khẩu ban đầu do giáo viên đặt, thêm thẳng vào lớp. */
DB_ACT.createStudentAccount = (el) => {
  const classId = el.dataset.id, className = el.dataset.name || '';
  dbOpenDialog({
    title: 'Tạo tài khoản học sinh' + (className ? ' — lớp ' + className : ''),
    body: `<p class="muted">Mật khẩu ban đầu do bạn tự đặt và thông báo cho học sinh. Các em nên đổi mật khẩu ngay sau khi đăng nhập.</p>
      ${dbField('Email của học sinh', 'db-sa-email', `<input id="db-sa-email" name="email" type="email" placeholder="vidu@hocsinh.edu.vn" autocomplete="off" required>`)}
      ${dbField('Họ và tên', 'db-sa-name', `<input id="db-sa-name" name="full_name" maxlength="120" placeholder="Nguyễn Văn A" required>`)}
      ${dbField('Mật khẩu ban đầu (tối thiểu 6 ký tự)', 'db-sa-pw', `<input id="db-sa-pw" name="password" type="text" maxlength="72" placeholder="Ít nhất 6 ký tự" autocomplete="off" required>`)}`,
    okLabel: 'Tạo tài khoản',
    onOk: async (v) => {
      const email = (v.email || '').trim().toLowerCase(), name = (v.full_name || '').trim(), pw = v.password || '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Nhập đúng địa chỉ email của học sinh.');
      if (name.length < 2) throw new Error('Nhập họ tên học sinh.');
      if (pw.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
      await dbCall(EducMindDB.createStudentAccount(email, name, pw, classId || null));
      toast('Đã tạo tài khoản cho ' + name + ' và thêm vào lớp.');
    },
  });
};
DB_ACT.removeMember = (el) => {
  const p = (DB.data.profiles || {})[el.dataset.id], c = dbClass();
  dbConfirm('Gỡ học sinh khỏi lớp?', `${h(dbName(p))} sẽ không còn thấy nội dung của lớp ${h(c ? c.name : '')}. Bài đã nộp và điểm vẫn được giữ.`, 'Gỡ khỏi lớp', async () => {
    const r = await dbCall(EducMindDB.removeMember(DB.classId, el.dataset.id));
    if (!r.length) throw new Error('Không gỡ được học sinh này.');
    toast('Đã gỡ học sinh khỏi lớp.');
  }, true);
};
DB_ACT.joinClass = (form) => dbRun(form, async (v) => {
  const code = (v.code || '').trim().toUpperCase();
  if (!code) throw new Error('Nhập mã lớp.');
  const classId = await dbCall(EducMindDB.joinClass(code));
  DB.classId = classId; DB.course = null;
  try { localStorage.setItem('educmind.db.class', DB.classId); } catch (_) {}
  toast('Đã vào lớp.');
});
